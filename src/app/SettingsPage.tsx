import { useState, type ChangeEvent } from 'react';
import {
  ArrowLeft,
  Download,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wifi,
} from 'lucide-react';
import { Badge, Button, Card, SectionHeader } from '../components/ui';
import { fetchAvailableModels, testAIConnection } from '../services/aiGrader';
import {
  createAccount,
  deleteAccount,
  exportBackupPayload,
  getAccounts,
  getActiveAccount,
  getAIConfig,
  importListeningSets,
  importReadingPassages,
  importTranslationItems,
  importVocabItems,
  importWritingPrompts,
  renameAccount,
  resetAllLocalData,
  restoreBackupPayload,
  saveAIConfig,
  setActiveAccount,
} from '../services/storage';
import type {
  AIConfig,
  ExportBackupPayload,
  ListeningSet,
  ReadingPassage,
  TranslationItem,
  UserAccount,
  VocabItem,
  WritingPrompt,
} from '../types/cet4';

type ImportTarget = 'vocab' | 'writing' | 'translation' | 'reading' | 'listening';

export function SettingsPage({
  onAccountChange,
  onBack,
  backLabel = '返回上一页',
}: {
  onAccountChange?: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const [accounts, setAccounts] = useState<UserAccount[]>(() => getAccounts());
  const [activeAcc, setActiveAcc] = useState<UserAccount>(() => getActiveAccount());
  const [newAccName, setNewAccName] = useState('');
  const [renameText, setRenameText] = useState(() => getActiveAccount().name);
  const [accountNotice, setAccountNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );

  const [aiCfg, setAiCfg] = useState<AIConfig>(() => getAIConfig());
  const [aiStatus, setAiStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const syncAccountState = () => {
    const nextAcc = getActiveAccount();
    setAccounts(getAccounts());
    setActiveAcc(nextAcc);
    setRenameText(nextAcc.name);
    setAiCfg(getAIConfig());
    setAiStatus(null);
    setAvailableModels([]);
    onAccountChange?.();
  };

  const handleSwitchAccount = (accountId: string) => {
    setActiveAccount(accountId);
    syncAccountState();
    setAccountNotice({ type: 'ok', text: `已切换到账号「${getActiveAccount().name}」，AI 与学习进度已自动隔离加载。` });
  };

  const handleCreateAccount = () => {
    try {
      const created = createAccount(newAccName);
      setNewAccName('');
      syncAccountState();
      setAccountNotice({
        type: 'ok',
        text: `已创建并切换到新账号「${created.name}」，请在下方为其配置专属 API Key。`,
      });
    } catch (err) {
      setAccountNotice({
        type: 'err',
        text: err instanceof Error ? err.message : '创建账号失败。',
      });
    }
  };

  const handleRenameAccount = () => {
    try {
      const updated = renameAccount(activeAcc.id, renameText);
      syncAccountState();
      setAccountNotice({ type: 'ok', text: `当前账号已更名为「${updated.name}」。` });
    } catch (err) {
      setAccountNotice({
        type: 'err',
        text: err instanceof Error ? err.message : '重命名失败。',
      });
    }
  };

  const handleDeleteAccount = (acc: UserAccount) => {
    if (
      !window.confirm(
        `确认删除账号「${acc.name}」吗？该账号下的专属 AI 配置、错词本与练习记录将被永久清除。`,
      )
    ) {
      return;
    }
    try {
      deleteAccount(acc.id);
      syncAccountState();
      setAccountNotice({ type: 'ok', text: `已删除账号「${acc.name}」。` });
    } catch (err) {
      setAccountNotice({
        type: 'err',
        text: err instanceof Error ? err.message : '删除账号失败。',
      });
    }
  };

  const handleLoadModels = async () => {
    setLoadingModels(true);
    setAiStatus(null);
    const res = await fetchAvailableModels(aiCfg);
    setAvailableModels(res.models);
    setAiStatus({ type: res.ok ? 'ok' : 'err', text: res.message });
    setLoadingModels(false);
  };

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
      syncAccountState();
      onAccountChange?.();
      setDataNotice({ type: 'ok', text: '备份已恢复并立即生效！当前账号的学习进度与题库已同步更新。' });
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
        subtitle="管理个人学习账号、独立 AI 批改配置、自定义题库与进度备份"
        action={
          onBack ? (
            <Button type="button" variant="secondary" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
          ) : undefined
        }
      />

      {/* 多用户账号管理 */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">个人账号管理（每人独立配置与 API）</h2>
          </div>
          <Badge tone="indigo">当前登录：{activeAcc.name}</Badge>
        </div>

        <p className="text-xs text-slate-500">
          每个账号拥有完全独立的 API Key、模型配置、错词本、草稿与模考记录，互不干扰。
        </p>

        {/* 已有账号列表 */}
        <div className="flex flex-wrap gap-2">
          {accounts.map((acc) => {
            const isCurrent = acc.id === activeAcc.id;
            return (
              <div
                key={acc.id}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs sm:text-sm ${
                  isCurrent
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => !isCurrent && handleSwitchAccount(acc.id)}
                  className="cursor-pointer"
                >
                  {acc.name}
                </button>
                {accounts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(acc)}
                    className="ml-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    title={`删除账号 ${acc.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 新建账号 + 重命名当前账号 */}
        <div className="grid gap-3 sm:grid-cols-2 pt-1">
          <div className="flex gap-2">
            <input
              type="text"
              value={newAccName}
              onChange={(e) => setNewAccName(e.target.value)}
              placeholder="输入新账号名（如：小明）"
              className="flex-1 min-w-0 rounded-xl border border-slate-300 px-3 py-1.5 text-xs sm:text-sm focus:border-indigo-500 focus:outline-none"
            />
            <Button type="button" onClick={handleCreateAccount} className="shrink-0 text-xs px-3">
              <UserPlus className="h-3.5 w-3.5" />
              新建账号
            </Button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              placeholder="修改当前账号名称"
              className="flex-1 min-w-0 rounded-xl border border-slate-300 px-3 py-1.5 text-xs sm:text-sm focus:border-indigo-500 focus:outline-none"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleRenameAccount}
              className="shrink-0 text-xs px-3"
            >
              重命名
            </Button>
          </div>
        </div>

        {accountNotice && (
          <p
            className={`text-xs font-medium ${
              accountNotice.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {accountNotice.text}
          </p>
        )}
      </Card>

      {/* AI 批改设置 */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              AI 批改配置（仅对账号「{activeAcc.name}」生效）
            </h2>
          </div>
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
            <span className="font-medium text-slate-700">助手显示名称（自定义昵称）</span>
            <input
              type="text"
              value={aiCfg.displayName ?? ''}
              onChange={(e) => setAiCfg({ ...aiCfg, displayName: e.target.value })}
              placeholder="留空或自定义名称（如：四级训练ai）"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">API Base URL（OpenAI 兼容）</span>
            <input
              type="text"
              value={aiCfg.baseUrl}
              onChange={(e) => setAiCfg({ ...aiCfg, baseUrl: e.target.value })}
              placeholder="填入你的 OpenAI 兼容接口地址（如 https://api.deepseek.com/v1）"
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
          <div className="block text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-700">
                服务端模型 ID（Model，必须填接口支持的英文模型名）
              </span>
              <button
                type="button"
                onClick={() => void handleLoadModels()}
                disabled={loadingModels}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingModels ? 'animate-spin' : ''}`} />
                {loadingModels ? '获取中...' : '获取可用模型'}
              </button>
            </div>
            <input
              type="text"
              value={aiCfg.model}
              onChange={(e) => setAiCfg({ ...aiCfg, model: e.target.value })}
              placeholder="填入服务端模型 ID（如 deepseek-chat）"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none"
            />
            {availableModels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {availableModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAiCfg({ ...aiCfg, model: m })}
                    className={`rounded-lg border px-2 py-1 font-mono text-xs transition-colors cursor-pointer ${
                      aiCfg.model === m
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
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

        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-800">备份包含：</span>
          当前账号的单词进度、错词本、练习记录与自定义导入题库；
          <span className="font-semibold text-amber-700">不包含：</span>
          API Key（防泄露）与本地大体积 MP3 音频文件。
        </div>

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
