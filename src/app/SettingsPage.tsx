import { useState, type ChangeEvent } from 'react';
import { Download, KeyRound, ShieldAlert, Trash2, Upload, Wifi } from 'lucide-react';
import { Button, Card, SectionHeader } from '../components/ui';
import { testAIConnection } from '../services/aiGrader';
import {
  exportBackupPayload,
  getAIConfig,
  importListeningSets,
  importReadingPassages,
  importTranslationItems,
  importVocabItems,
  importWritingPrompts,
  resetAllLocalData,
  restoreBackupPayload,
  saveAIConfig,
} from '../services/storage';
import type {
  AIConfig,
  ExportBackupPayload,
  ListeningSet,
  ReadingPassage,
  TranslationItem,
  VocabItem,
  WritingPrompt,
} from '../types/cet4';

type ImportTarget = 'vocab' | 'writing' | 'translation' | 'reading' | 'listening';

export function SettingsPage() {
  const [aiCfg, setAiCfg] = useState<AIConfig>(() => getAIConfig());
  const [aiStatus, setAiStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const [importTarget, setImportTarget] = useState<ImportTarget>('vocab');
  const [dataNotice, setDataNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSaveAI = () => {
    saveAIConfig(aiCfg);
    setAiStatus({ type: 'ok', text: 'AI 配置已保存到当前浏览器（仅存于本机 localStorage）。' });
  };

  const handleTestAI = async () => {
    setTesting(true);
    setAiStatus(null);
    const res = await testAIConnection(aiCfg);
    setAiStatus({ type: res.ok ? 'ok' : 'err', text: res.message });
    setTesting(false);
  };

  const handleImportBank = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new Error('题库 JSON 顶层必须是数组（[...]）。');
      }

      let count = 0;
      if (importTarget === 'vocab') count = await importVocabItems(parsed as VocabItem[]);
      if (importTarget === 'writing') count = await importWritingPrompts(parsed as WritingPrompt[]);
      if (importTarget === 'translation')
        count = await importTranslationItems(parsed as TranslationItem[]);
      if (importTarget === 'reading') count = await importReadingPassages(parsed as ReadingPassage[]);
      if (importTarget === 'listening') count = await importListeningSets(parsed as ListeningSet[]);

      setDataNotice({ type: 'ok', text: `成功导入 ${count} 条自定义数据，已合并到本地题库。` });
    } catch (err) {
      setDataNotice({
        type: 'err',
        text: err instanceof Error ? err.message : '导入失败，请检查 JSON 格式是否符合契约。',
      });
    }
  };

  const handleExportBackup = async () => {
    try {
      const payload = await exportBackupPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cet4-prep-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDataNotice({ type: 'ok', text: '学习记录与自定义题库备份已导出（不含本地大音频与 API Key）。' });
    } catch (err) {
      setDataNotice({
        type: 'err',
        text: err instanceof Error ? err.message : '导出备份失败。',
      });
    }
  };

  const handleRestoreBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text()) as ExportBackupPayload;
      await restoreBackupPayload(payload);
      setDataNotice({ type: 'ok', text: '备份已恢复！刷新页面即可看到最新学习进度。' });
    } catch (err) {
      setDataNotice({
        type: 'err',
        text: err instanceof Error ? err.message : '恢复备份失败，请确认文件正确。',
      });
    }
  };

  const handleReset = async () => {
    if (!window.confirm('确认清空所有学习记录、错词本与自定义导入数据吗？此操作不可撤销。')) {
      return;
    }
    await resetAllLocalData();
    setDataNotice({ type: 'ok', text: '已清空全部本地学习数据（已保留内置示例题库）。' });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHeader
        title="设置与数据中心"
        subtitle="配置可选 AI 批改服务、导入自定义题库或备份学习进度"
      />

      {/* AI 批改设置 */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">AI 批改配置（可选）</h2>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 leading-relaxed flex gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>隐私与安全提示：</strong>
            API Key 仅保存在当前设备的浏览器本地，不会上传到 GitHub 或任何第三方中转服务器；启用 AI 批改时，你的作文/译文将由浏览器直连你填写的端点。部分接口可能因服务端 CORS 限制无法浏览器直连；留空则默认使用免费离线范文对照模式。
          </div>
        </div>

        <div className="grid gap-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">API Base URL（OpenAI 兼容）</span>
            <input
              type="text"
              value={aiCfg.baseUrl}
              onChange={(e) => setAiCfg({ ...aiCfg, baseUrl: e.target.value })}
              placeholder="https://api.deepseek.com/v1"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">API Key</span>
            <input
              type="password"
              value={aiCfg.apiKey}
              onChange={(e) => setAiCfg({ ...aiCfg, apiKey: e.target.value })}
              placeholder="sk-...（留空即使用纯离线范文模式）"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">模型名称（Model）</span>
            <input
              type="text"
              value={aiCfg.model}
              onChange={(e) => setAiCfg({ ...aiCfg, model: e.target.value })}
              placeholder="deepseek-chat"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={handleSaveAI}>保存配置</Button>
          <Button variant="secondary" onClick={handleTestAI} disabled={testing}>
            <Wifi className="h-4 w-4" />
            {testing ? '测试连接中...' : '测试连接'}
          </Button>
        </div>

        {aiStatus && (
          <p
            className={`text-sm ${
              aiStatus.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {aiStatus.text}
          </p>
        )}
      </Card>

      {/* 自定义题库导入与备份 */}
      <Card className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">题库导入与学习记录备份</h2>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={importTarget}
            onChange={(e) => setImportTarget(e.target.value as ImportTarget)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="vocab">导入单词表 JSON</option>
            <option value="writing">导入写作题 JSON</option>
            <option value="translation">导入翻译题 JSON</option>
            <option value="reading">导入阅读题 JSON</option>
            <option value="listening">导入听力题 JSON</option>
          </select>

          <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Upload className="h-4 w-4" />
            选择 JSON 文件导入
            <input type="file" accept=".json,application/json" onChange={handleImportBank} className="hidden" />
          </label>
        </div>

        <hr className="border-slate-100" />

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="secondary" onClick={handleExportBackup}>
            <Download className="h-4 w-4" />
            导出全量备份 JSON
          </Button>

          <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Upload className="h-4 w-4" />
            从备份恢复
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleRestoreBackup}
              className="hidden"
            />
          </label>

          <Button variant="danger" onClick={handleReset}>
            <Trash2 className="h-4 w-4" />
            清空本地数据
          </Button>
        </div>

        {dataNotice && (
          <p
            className={`text-sm ${
              dataNotice.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {dataNotice.text}
          </p>
        )}
      </Card>
    </div>
  );
}
