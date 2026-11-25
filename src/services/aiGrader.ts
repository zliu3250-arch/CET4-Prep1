import type {
  AIConfig,
  AIGradeResponse,
  AIGradeResult,
  TranslationItem,
  WritingPrompt,
} from '../types/cet4';
import { getAIConfig, hasValidAIConfig } from './storage';

const REQUEST_TIMEOUT_MS = 35_000;

function normalizeEndpoint(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  if (clean.endsWith('/chat/completions')) {
    return clean;
  }
  return `${clean}/chat/completions`;
}

function parseValidScore15(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const n = typeof raw === 'number' ? raw : Number(raw.trim());
  if (!Number.isFinite(n) || n < 0 || n > 15) return null;
  return Math.round(n * 2) / 2;
}

function parseGradeJson(rawText: string): AIGradeResult | null {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const score15 = parseValidScore15(parsed.score15);
    const overallComment =
      typeof parsed.overallComment === 'string' ? parsed.overallComment.trim() : '';
    if (score15 === null || !overallComment) return null;

    const score106 = Math.round(score15 * 7.1 * 10) / 10;

    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((s): s is string => typeof s === 'string')
      : [];

    const issues = Array.isArray(parsed.issues)
      ? parsed.issues
          .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
          .map((item) => ({
            original: String(item.original ?? ''),
            suggestion: String(item.suggestion ?? ''),
            reason: String(item.reason ?? ''),
          }))
          .filter((item) => item.original || item.suggestion)
      : [];

    return {
      score15,
      score106,
      overallComment,
      strengths,
      issues,
      polishedVersion: typeof parsed.polishedVersion === 'string' ? parsed.polishedVersion : '',
    };
  } catch {
    return null;
  }
}

async function callOpenAICompatible(
  systemPrompt: string,
  userPrompt: string,
  overrideConfig?: AIConfig,
): Promise<AIGradeResponse> {
  const cfg = overrideConfig ?? getAIConfig();
  if (!overrideConfig && !hasValidAIConfig()) {
    return {
      ok: false,
      errorCode: 'no_key',
      message: '尚未配置 AI API Key。请前往「设置」填入你自己的端点与 Key，或直接使用离线范文对照自评。',
    };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(normalizeEndpoint(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: cfg.model.trim(),
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        errorCode: 'auth_error',
        message: `鉴权失败（HTTP ${response.status}）：请检查 API Key 或模型名称是否正确。`,
      };
    }

    if (response.status === 429) {
      return {
        ok: false,
        errorCode: 'rate_limit',
        message: '请求过于频繁或额度不足（HTTP 429），请稍后重试或检查账户余额。',
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        errorCode: 'cors_or_network',
        message: `服务端返回错误（HTTP ${response.status}），请检查 Base URL 与模型配置。`,
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return {
        ok: false,
        errorCode: 'parse_error',
        message: 'AI 返回内容为空，请切换模型后重试。',
      };
    }

    const parsed = parseGradeJson(content);
    if (!parsed) {
      return {
        ok: false,
        errorCode: 'parse_error',
        message: 'AI 返回格式非标准 JSON，无法自动解析，请重试或查看离线范文对照。',
      };
    }

    return { ok: true, result: parsed };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ok: false,
        errorCode: 'timeout',
        message: 'AI 批改超时（超过 35 秒），请检查网络或切换响应更快的模型。',
      };
    }
    return {
      ok: false,
      errorCode: 'cors_or_network',
      message:
        '网络请求失败或被目标服务 CORS 跨域策略拦截。浏览器直连仅支持允许跨域的端点（如 DeepSeek、OpenRouter 等），请检查 Base URL 或继续使用离线范文自评。',
    };
  } finally {
    window.clearTimeout(timer);
  }
}

const JSON_OUTPUT_SCHEMA_INSTRUCTION = `你是一位严谨的大学英语四级（CET-4）阅卷老师。请用中文给出点评，并严格只输出一个合法 JSON 对象（不要输出 Markdown 代码块以外的多余说明），字段如下：
{
  "score15": 11.5,
  "overallComment": "总体评价（2-3句话，紧扣四级评分标准：切题、连贯、语法、词汇）",
  "strengths": ["亮点1", "亮点2"],
  "issues": [
    { "original": "原句或错误表达", "suggestion": "修改建议", "reason": "错误原因简述" }
  ],
  "polishedVersion": "保留考生原意的四级高分润色版本（完整英文）"
}`;

export async function gradeWriting(params: {
  prompt: WritingPrompt;
  essay: string;
}): Promise<AIGradeResponse> {
  const trimmed = params.essay.trim();
  if (!trimmed) {
    return {
      ok: false,
      errorCode: 'parse_error',
      message: '请先输入作文内容再发起 AI 批改。',
    };
  }

  const userPrompt = [
    `【四级写作题目】${params.prompt.title}`,
    `【题目要求】${params.prompt.directions}`,
    `【字数要求】${params.prompt.minWords}-${params.prompt.maxWords} 词`,
    `【考生作文】\n${trimmed}`,
  ].join('\n\n');

  return callOpenAICompatible(JSON_OUTPUT_SCHEMA_INSTRUCTION, userPrompt);
}

export async function gradeTranslation(params: {
  item: TranslationItem;
  answer: string;
}): Promise<AIGradeResponse> {
  const trimmed = params.answer.trim();
  if (!trimmed) {
    return {
      ok: false,
      errorCode: 'parse_error',
      message: '请先输入译文内容再发起 AI 批改。',
    };
  }

  const userPrompt = [
    `【四级汉译英主题】${params.item.title}`,
    `【中文原文】\n${params.item.sourceText}`,
    `【参考译文】\n${params.item.referenceTranslation}`,
    `【考生译文】\n${trimmed}`,
  ].join('\n\n');

  return callOpenAICompatible(JSON_OUTPUT_SCHEMA_INSTRUCTION, userPrompt);
}

export async function fetchAvailableModels(
  cfg: Pick<AIConfig, 'baseUrl' | 'apiKey'>,
): Promise<{ ok: boolean; models: string[]; message: string }> {
  if (!cfg.baseUrl.trim() || !cfg.apiKey.trim()) {
    return { ok: false, models: [], message: '请先填写 Base URL 与 API Key。' };
  }
  const cleanBase = cfg.baseUrl.trim().replace(/\/+$/, '');
  const modelsUrl = cleanBase.endsWith('/models') ? cleanBase : `${cleanBase}/models`;
  try {
    const res = await fetch(modelsUrl, {
      headers: { Authorization: `Bearer ${cfg.apiKey.trim()}` },
    });
    if (!res.ok) {
      return { ok: false, models: [], message: `获取模型列表失败（HTTP ${res.status}）。` };
    }
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const models = (data.data ?? [])
      .map((m) => (typeof m.id === 'string' ? m.id.trim() : ''))
      .filter(Boolean);
    if (models.length === 0) {
      return { ok: false, models: [], message: '接口返回的可用模型列表为空。' };
    }
    return { ok: true, models, message: `已获取到 ${models.length} 个可用模型，点击下方标签即可选用。` };
  } catch {
    return { ok: false, models: [], message: '无法获取模型列表（可能是网络异常或跨域限制）。' };
  }
}

export async function testAIConnection(
  cfg: AIConfig,
): Promise<{ ok: boolean; message: string }> {
  if (!cfg.baseUrl.trim() || !cfg.apiKey.trim() || !cfg.model.trim()) {
    return { ok: false, message: '请完整填写 Base URL、API Key 与服务端模型 ID。' };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(normalizeEndpoint(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: cfg.model.trim(),
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with OK' }],
      }),
      signal: controller.signal,
    });

    if (res.ok) {
      const name = (cfg.displayName ?? '四级训练ai').trim() || '四级训练ai';
      return { ok: true, message: `「${name}」连接成功！现在可以在写作与翻译模块使用 AI 批改。` };
    }

    let detail = '';
    try {
      const errJson = (await res.json()) as { error?: { message?: string; code?: string } };
      const msg = errJson.error?.message?.trim() ?? '';
      const code = errJson.error?.code?.trim() ?? '';
      if (msg || code) {
        detail = `（服务端返回：${[code, msg].filter(Boolean).join(' - ')}）`;
      }
    } catch {
      // ignore body parse failure
    }

    return {
      ok: false,
      message: `连接失败（HTTP ${res.status}）${detail || '，请检查 API Key、Base URL 或模型 ID。'}`,
    };
  } catch {
    return {
      ok: false,
      message: '请求失败：可能是网络异常或该接口不支持浏览器 CORS 跨域直连。',
    };
  } finally {
    window.clearTimeout(timer);
  }
}
