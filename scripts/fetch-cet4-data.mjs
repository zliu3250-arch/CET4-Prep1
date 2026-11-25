/**
 * 从公开开源仓库抓取并整理：
 * 1. CET-4 词频排序核心词库（exam-data/CETVocabulary + KyleBing/english-vocabulary 词性补全）
 * 2. 近五年（2021–2025）英语四级真题：写作、翻译、阅读（选词填空/长篇匹配/仔细阅读）、听力 + 真题在线听力音频元数据
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'data');
fs.mkdirSync(OUT_DIR, { recursive: true });

const UA = { 'User-Agent': 'CET4-Prep-DataSync/1.0' };

async function fetchText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function cleanOptionText(raw) {
  const m = String(raw || '').trim().match(/^([A-O])[).、\s]+([\s\S]*)$/);
  if (m) return { label: m[1].toUpperCase(), text: m[2].trim() };
  return { label: '', text: String(raw || '').trim() };
}

function detectWritingCategory(directions) {
  const d = directions.toLowerCase();
  if (/letter|email|proposal|notice|invitation|application|recommend|apolog/.test(d)) {
    return '应用文';
  }
  if (/chart|graph|table|picture|cartoon|drawing|diagram/.test(d)) {
    return '图画/图表';
  }
  if (/phenomenon|trend|nowadays|increasingly|more and more/.test(d)) {
    return '现象分析';
  }
  return '议论文';
}

function extractTranslationHints(zhText) {
  const hints = [];
  const re = /([\u4e00-\u9fa5]{2,8})\s*[（(]([A-Za-z][A-Za-z\s'-]{1,40})[)）]/g;
  let m;
  while ((m = re.exec(zhText)) !== null) {
    hints.push({ zh: m[1].trim(), en: m[2].trim() });
  }
  return hints;
}

function extractLocateHint(analysis) {
  if (!analysis) return undefined;
  const m = analysis.match(/【定位】([^\n]+)/);
  return m ? m[1].trim() : undefined;
}

const VOCAB_SKIP_CATS = new Set(['数词、代词与限定词', '介词、连词与感叹词', '人称与称谓']);
const VOCAB_SKIP_WORDS = new Set([
  'will', 'would', 'could', 'should', 'might', 'must', 'shall',
  'have', 'make', 'take', 'give', 'come', 'know', 'think', 'look', 'want', 'find', 'tell',
  'work', 'call', 'good', 'year', 'time', 'people', 'world', 'life', 'hand', 'part', 'place',
  'case', 'week', 'company', 'system', 'program', 'question', 'number', 'night', 'point',
  'home', 'water', 'room', 'mother', 'area', 'money', 'story', 'fact', 'month', 'right',
  'book', 'word', 'business', 'side', 'kind', 'head', 'house', 'friend', 'father', 'power',
  'hour', 'game', 'line', 'member', 'city', 'name', 'team', 'minute', 'idea', 'body', 'back',
  'parent', 'face', 'level', 'office', 'door', 'health', 'person', 'art', 'war', 'history',
  'party', 'morning', 'reason', 'girl', 'guy', 'food', 'moment', 'air', 'teacher', 'force',
  'foot', 'boy', 'age', 'eye', 'job', 'day', 'man', 'way', 'thing', 'child', 'woman',
  'school', 'state', 'family', 'student', 'group', 'country', 'problem', 'need', 'feel',
  'become', 'leave', 'mean', 'keep', 'begin', 'seem', 'help', 'talk', 'turn', 'start',
  'show', 'hear', 'play', 'move', 'live', 'hold', 'bring', 'happen', 'write', 'sit', 'stand',
  'lose', 'pay', 'meet', 'continue', 'set', 'learn', 'change', 'lead', 'watch', 'follow',
  'stop', 'speak', 'read', 'spend', 'grow', 'open', 'walk', 'win', 'remember', 'love', 'buy',
  'wait', 'die', 'send', 'build', 'stay', 'fall', 'cut', 'kill', 'pass', 'sell', 'pull',
  'return', 'eat', 'cover', 'catch', 'draw', 'choose', 'well', 'just', 'very', 'more',
  'most', 'also', 'only', 'even', 'still', 'then', 'here', 'there', 'much', 'many', 'some',
  'such', 'than', 'them', 'they', 'this', 'that', 'with', 'from', 'into', 'over', 'after',
  'before', 'about', 'under', 'again', 'never', 'always', 'often', 'every', 'other',
]);

function buildVocab(examData, kyleBing, maxCount = 4000) {
  const posMap = new Map();
  for (const item of kyleBing) {
    if (!item?.word || !Array.isArray(item.translations)) continue;
    const types = [...new Set(item.translations.map((t) => t.type).filter(Boolean))];
    if (types.length > 0) {
      posMap.set(String(item.word).toLowerCase(), types.map((t) => (t.endsWith('.') ? t : `${t}.`)).join('/'));
    }
  }

  const list = examData['词汇表'] || [];
  const seen = new Set();
  const result = [];

  for (const row of list) {
    if (result.length >= maxCount) break;
    // 排除纯六级词与过基础 A1/虚词，按四级真题考查概率（综合得分）排序
    if (row['六级']) continue;
    if (row['CEFR等级'] === 'A1') continue;
    if (VOCAB_SKIP_CATS.has(row['分类名称'])) continue;

    const word = String(row['单词'] || '').trim();
    if (!word || !/^[A-Za-z]{4,}$/.test(word)) continue;
    const lower = word.toLowerCase();
    if (VOCAB_SKIP_WORDS.has(lower) || seen.has(lower)) continue;
    seen.add(lower);

    const meaning = String(row['释义'] || '').trim();
    if (!meaning) continue;

    const tags = [];
    if (row['词频'] >= 100) tags.push('必考超高频');
    else if (row['词频'] >= 30) tags.push('高频核心');
    else tags.push('核心考词');
    if (row['CEFR等级']) tags.push(String(row['CEFR等级']));
    if (row['学术词汇']) tags.push('学术');

    result.push({
      id: `cet4-${result.length + 1}`,
      word,
      phonetic: row['英式音标'] ? String(row['英式音标']).split(';')[0].trim() : undefined,
      pos: posMap.get(lower) || 'core',
      meaning,
      tags: tags.slice(0, 3),
    });
  }

  // 若高频词表不足 4000 词，用标准四级大纲词表（KyleBing CET-4）顺延补齐至 4000 词
  for (const item of kyleBing) {
    if (result.length >= maxCount) break;
    const word = String(item?.word || '').trim();
    if (!word || !/^[A-Za-z]{3,}$/.test(word)) continue;
    const lower = word.toLowerCase();
    if (VOCAB_SKIP_WORDS.has(lower) || seen.has(lower)) continue;
    const translations = Array.isArray(item.translations) ? item.translations : [];
    const meaning = translations
      .map((t) => `${t.type ? `${t.type}.` : ''}${t.translation || ''}`)
      .filter(Boolean)
      .join('；')
      .trim();
    if (!meaning) continue;
    seen.add(lower);
    result.push({
      id: `cet4-${result.length + 1}`,
      word,
      pos: posMap.get(lower) || 'cet4',
      meaning,
      tags: ['大纲冲刺'],
    });
  }

  return result;
}

async function runPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await fn(items[cur], cur);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function main() {
  console.log('1/3 正在抓取四级核心词库...');
  const [examData, kyleBing] = await Promise.all([
    fetchJson('https://raw.githubusercontent.com/exam-data/CETVocabulary/main/cet_reranked.json'),
    fetchJson('https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/json/3-CET4-%E9%A1%BA%E5%BA%8F.json'),
  ]);
  const vocab = buildVocab(examData, kyleBing);
  fs.writeFileSync(path.join(OUT_DIR, 'vocab-cet4.json'), JSON.stringify(vocab));
  console.log(`   已生成 vocab-cet4.json（${vocab.length} 词）`);

  console.log('2/3 正在抓取 2021–2026 官方四级真题与听力音频索引...');
  const [bankListing, audioJsText] = await Promise.all([
    fetchJson('https://api.github.com/repos/gongyining0601/cet4/contents/bank'),
    fetchText('https://raw.githubusercontent.com/123xzw999/cet4-exam-quiz/main/data/audio.js'),
  ]);

  const audioWin = {};
  new Function('window', audioJsText)(audioWin);
  const audioMap = audioWin.__CET4_AUDIO || {};

  // 选取 2021-2026 年全部官方真题，按时间倒序（最新在前）
  const paperFiles = bankListing
    .filter((f) => /^cet4-202[1-6]-\d{2}-\d\.js$/.test(f.name))
    .map((f) => f.name)
    .sort()
    .reverse();

  console.log(`   共发现 ${paperFiles.length} 套 2021–2026 年官方真题，并发下载解析中...`);

  const papers = await runPool(paperFiles, 6, async (fileName) => {
    const jsText = await fetchText(`https://raw.githubusercontent.com/gongyining0601/cet4/main/bank/${fileName}`);
    const win = { CET4_BANKS: [] };
    new Function('window', jsText)(win);
    return win.CET4_BANKS[0];
  });

  const writings = [];
  const translations = [];
  const readings = [];
  const listenings = [];
  const seenAudioKey = new Set();

  for (const paper of papers) {
    if (!paper || !paper.id) continue;
    const pid = String(paper.id);
    const label = String(paper.source || pid);

    // 1. 写作
    if (paper.writing?.prompt) {
      const directions = String(paper.writing.prompt).trim();
      const sampleEssay = String(paper.writing.sample || '').trim();
      writings.push({
        id: `writing-${pid}`,
        title: `${label} · 写作真题`,
        category: detectWritingCategory(directions),
        directions,
        minWords: 120,
        maxWords: 180,
        suggestedMinutes: 30,
        outlineTips: [
          '第一段：紧扣题干 Directions 亮明核心观点或写信/提案目的（2–3 句）',
          '第二段：分 2–3 个角度展开论证或提出具体可行措施（使用 First / Moreover / Finally 等逻辑衔接）',
          '第三段：总结全文、重申立场或表达期待（2 句）',
        ],
        usefulExpressions: [
          'From my perspective, it is imperative that...',
          'There are several compelling reasons accounting for this.',
          'First and foremost, ... / Furthermore, ...',
          'Not only does it..., but it also...',
          'In conclusion, only by doing so can we...',
        ],
        sampleEssay: sampleEssay || '（本套真题暂缺参考范文，可提交后使用 AI 批改或对照自评清单检查。）',
        keyPoints: [
          '审题完整回应 Directions 全部要求',
          '三段式结构清晰、衔接词自然',
          '词数控制在 120–180 词区间，避免拼写与主谓一致错误',
        ],
      });
    }

    // 2. 翻译
    if (paper.translation?.prompt) {
      const sourceText = String(paper.translation.prompt).trim();
      const referenceTranslation = String(paper.translation.sample || '').trim();
      const hints = extractTranslationHints(sourceText);
      translations.push({
        id: `trans-${pid}`,
        title: `${label} · 翻译真题`,
        topic: `${pid.slice(0, 4)}年真题`,
        sourceText,
        hints:
          hints.length > 0
            ? hints
            : [{ zh: '提示', en: '本套真题原文无括号提示词，可先尝试整段翻译再对照参考译文' }],
        referenceTranslation: referenceTranslation || '（本套真题暂缺参考译文）',
        keyPhrases: hints.map((h) => `${h.zh}：${h.en}`),
        suggestedMinutes: 30,
      });
    }

    const qs = Array.isArray(paper.questions) ? paper.questions : [];

    // 3. 阅读：选词填空（banked_cloze）
    const clozeQs = qs.filter((q) => q.type === 'cloze').sort((a, b) => a.qno - b.qno);
    if (paper.clozePassage && clozeQs.length > 0) {
      const wordBank = (clozeQs[0].options || []).map(cleanOptionText).filter((o) => o.label);
      const rawCloze = String(paper.clozePassage).replace(/__(\d+)__/g, '[$1]');
      const paragraphs = rawCloze
        .split(/\n+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text) => ({ text }));

      readings.push({
        id: `read-cloze-${pid}`,
        title: `${label} · 选词填空`,
        type: 'banked_cloze',
        suggestedMinutes: 8,
        paragraphs,
        wordBank: wordBank.map((w) => ({ label: w.label, word: w.text })),
        questions: clozeQs.map((q) => ({
          id: q.id || `cloze-${pid}-${q.qno}`,
          number: q.qno,
          stem: `第 ${q.qno} 空`,
          options: wordBank,
          answer: String(q.answer || '').trim().toUpperCase(),
          explanation: String(q.analysis || '').trim(),
        })),
      });
    }

    // 4. 阅读：长篇匹配（matching）
    const matchQs = qs.filter((q) => q.type === 'match').sort((a, b) => a.qno - b.qno);
    if (Array.isArray(paper.matchParagraphs) && paper.matchParagraphs.length > 0 && matchQs.length > 0) {
      const paraOptions = paper.matchParagraphs.map((mp) => ({
        label: String(mp.label || '').trim().toUpperCase(),
        text: `第 ${mp.label} 段`,
      }));
      readings.push({
        id: `read-match-${pid}`,
        title: `${label} · 长篇匹配${paper.matchIntro ? `（${String(paper.matchIntro).slice(0, 24)}）` : ''}`,
        type: 'matching',
        suggestedMinutes: 15,
        paragraphs: paper.matchParagraphs.map((mp) => ({
          label: String(mp.label || '').trim().toUpperCase(),
          text: String(mp.text || '').trim(),
        })),
        questions: matchQs.map((q) => ({
          id: q.id || `match-${pid}-${q.qno}`,
          number: q.qno,
          stem: String(q.stem || '').trim(),
          options: paraOptions,
          answer: String(q.answer || '').trim().toUpperCase(),
          explanation: String(q.analysis || '').trim(),
          locateHint: extractLocateHint(q.analysis),
        })),
      });
    }

    // 5. 阅读：仔细阅读（careful，每套 2 篇：46-50 & 51-55）
    const carefulQs = qs.filter((q) => q.type === 'reading').sort((a, b) => a.qno - b.qno);
    if (paper.readingPassages && carefulQs.length > 0) {
      const groups = [
        { name: '仔细阅读 Passage 1', list: carefulQs.filter((q) => q.qno <= 50), key: '46' },
        { name: '仔细阅读 Passage 2', list: carefulQs.filter((q) => q.qno > 50), key: '51' },
      ];
      for (const g of groups) {
        if (g.list.length === 0) continue;
        const firstQno = String(g.list[0].qno);
        const passageText = String(paper.readingPassages[firstQno] || paper.readingPassages[g.key] || '').trim();
        if (!passageText) continue;
        const paragraphs = passageText
          .split(/\n+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((text) => ({ text }));

        readings.push({
          id: `read-careful-${pid}-${g.key}`,
          title: `${label} · ${g.name}`,
          type: 'careful',
          suggestedMinutes: 10,
          paragraphs,
          questions: g.list.map((q) => ({
            id: q.id || `careful-${pid}-${q.qno}`,
            number: q.qno,
            stem: String(q.stem || '').trim(),
            options: (q.options || []).map(cleanOptionText),
            answer: String(q.answer || '').trim().toUpperCase(),
            explanation: String(q.analysis || '').trim(),
            locateHint: extractLocateHint(q.analysis),
          })),
        });
      }
    }

    // 6. 听力（去重：第3套若复用第1/2套听力则只收录有独立音频的套卷）
    const listeningQs = qs.filter((q) => q.type === 'listening').sort((a, b) => a.qno - b.qno);
    const audioInfo = audioMap[pid];
    if (listeningQs.length > 0 && audioInfo && audioInfo.ok && !seenAudioKey.has(pid)) {
      seenAudioKey.add(pid);
      const transcript = listeningQs.map((q) => {
        const loc = extractLocateHint(q.analysis);
        return {
          speaker: `第 ${q.qno} 题定位句`,
          text: loc || String(q.stem || ''),
        };
      });

      listenings.push({
        id: `listen-${pid}`,
        title: `${label} · 真题听力完整套卷（1–25 题）`,
        section: '听力篇章',
        audioUrl: `/hls-proxy/cet4/${audioInfo.aid}/index.m3u8`,
        audioPieces: Array.isArray(audioInfo.pieces) ? audioInfo.pieces : [],
        transcript,
        questions: listeningQs.map((q) => ({
          id: q.id || `listen-${pid}-${q.qno}`,
          number: q.qno,
          stem: String(q.stem || '').trim(),
          options: (q.options || []).map(cleanOptionText),
          answer: String(q.answer || '').trim().toUpperCase(),
          explanation: String(q.analysis || '').trim(),
        })),
      });
    }
  }

  console.log('3/3 正在写入 public/data/*.json ...');
  fs.writeFileSync(path.join(OUT_DIR, 'writing-2021-2025.json'), JSON.stringify(writings));
  fs.writeFileSync(path.join(OUT_DIR, 'translation-2021-2025.json'), JSON.stringify(translations));
  fs.writeFileSync(path.join(OUT_DIR, 'reading-2021-2025.json'), JSON.stringify(readings));
  fs.writeFileSync(path.join(OUT_DIR, 'listening-2021-2025.json'), JSON.stringify(listenings));

  console.log('=== 数据同步完成 ===');
  console.log(`词汇: ${vocab.length} 词`);
  console.log(`写作: ${writings.length} 套真题`);
  console.log(`翻译: ${translations.length} 套真题`);
  console.log(`阅读: ${readings.length} 篇真题（含选词填空/长篇匹配/仔细阅读）`);
  console.log(`听力: ${listenings.length} 套真题（均含在线真实听力音频流）`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
