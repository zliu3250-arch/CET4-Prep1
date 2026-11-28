import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  GraduationCap,
  Headphones,
  Home,
  Languages,
  PenLine,
  Settings,
  SpellCheck,
  UserCircle2,
} from 'lucide-react';
import { useHashRoute } from '../hooks/useHashRoute';
import { getAccounts, getActiveAccount, setActiveAccount } from '../services/storage';
import type { ModuleKey, UserAccount } from '../types/cet4';
import type { VocabQuickPreset } from '../features/vocab';
import { DashboardPage } from './DashboardPage';
import { SettingsPage } from './SettingsPage';

const VocabPage = lazy(() => import('../features/vocab'));
const WritingPage = lazy(() => import('../features/writing'));
const TranslationPage = lazy(() => import('../features/translation'));
const ReadingPage = lazy(() => import('../features/reading'));
const ListeningPage = lazy(() => import('../features/listening'));
const MockExamPage = lazy(() => import('../features/mock'));

const NAV_ITEMS: Array<{
  key: ModuleKey;
  label: string;
  shortLabel: string;
  icon: typeof Home;
}> = [
  { key: 'dashboard', label: '学习首页', shortLabel: '首页', icon: Home },
  { key: 'vocab', label: '词汇训练', shortLabel: '单词', icon: SpellCheck },
  { key: 'writing', label: '写作训练', shortLabel: '写作', icon: PenLine },
  { key: 'translation', label: '翻译训练', shortLabel: '翻译', icon: Languages },
  { key: 'reading', label: '阅读理解', shortLabel: '阅读', icon: BookOpen },
  { key: 'listening', label: '听力训练', shortLabel: '听力', icon: Headphones },
  { key: 'mock', label: '综合测试', shortLabel: '模考', icon: Award },
  { key: 'settings', label: '设置与导入', shortLabel: '设置', icon: Settings },
];

export function App() {
  const { route, navigate } = useHashRoute();
  const [accounts, setAccounts] = useState<UserAccount[]>(() => getAccounts());
  const [activeAccount, setActiveAccountState] = useState<UserAccount>(() => getActiveAccount());
  const [lastNonSettingsRoute, setLastNonSettingsRoute] = useState<ModuleKey>('dashboard');
  const [vocabQuickPreset, setVocabQuickPreset] = useState<VocabQuickPreset | null>(null);

  const handleStartQuickVocab = useCallback(() => {
    setVocabQuickPreset({
      tier: 800,
      mode: 'en_to_zh_choice',
      batchSize: 10,
      label: '10词快测',
    });
    navigate('vocab');
  }, [navigate]);

  const handleVocabPresetConsumed = useCallback(() => {
    setVocabQuickPreset(null);
  }, []);

  // 记录打开设置前正在使用的页面，便于点击返回键精准回到原界面
  useEffect(() => {
    if (route !== 'settings') {
      setLastNonSettingsRoute(route);
    }
  }, [route]);

  const handleBackFromSettings = useCallback(() => {
    navigate(lastNonSettingsRoute);
  }, [lastNonSettingsRoute, navigate]);

  const backTargetLabel =
    NAV_ITEMS.find((i) => i.key === lastNonSettingsRoute)?.label ?? '上一页';

  // 每次打开项目、切换模块或切换账号时，强制将视口复位到页面最顶端
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [route, activeAccount.id]);

  const refreshAccounts = useCallback(() => {
    setAccounts(getAccounts());
    setActiveAccountState(getActiveAccount());
  }, []);

  const handleQuickSwitchAccount = (accountId: string) => {
    const next = setActiveAccount(accountId);
    setActiveAccountState(next);
    setAccounts(getAccounts());
  };

  const renderPage = () => {
    switch (route) {
      case 'dashboard':
        return (
          <DashboardPage onNavigate={navigate} onStartQuickVocab={handleStartQuickVocab} />
        );
      case 'vocab':
        return (
          <VocabPage
            initialPreset={vocabQuickPreset}
            onPresetConsumed={handleVocabPresetConsumed}
          />
        );
      case 'writing':
        return <WritingPage />;
      case 'translation':
        return <TranslationPage />;
      case 'reading':
        return <ReadingPage />;
      case 'listening':
        return <ListeningPage />;
      case 'mock':
        return <MockExamPage />;
      case 'settings':
        return (
          <SettingsPage
            onAccountChange={refreshAccounts}
            onBack={handleBackFromSettings}
            backLabel={`返回${backTargetLabel}`}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* 桌面端左侧导航 */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900">CET4-Prep</p>
            <p className="text-xs text-slate-500">英语四级备考助手</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = route === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.key)}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100 space-y-2">
          <div className="rounded-xl bg-slate-50 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium">
                <UserCircle2 className="h-3.5 w-3.5 text-indigo-600" />
                当前学习账号
              </span>
              <button
                type="button"
                onClick={() => navigate('settings')}
                className="text-indigo-600 hover:underline cursor-pointer"
              >
                管理
              </button>
            </div>
            <select
              aria-label="切换学习账号"
              value={activeAccount.id}
              onChange={(e) => handleQuickSwitchAccount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
          <p className="px-1 text-[11px] text-slate-400">独立账号 · 独立 API 与进度</p>
        </div>
      </aside>

      {/* 移动端顶部栏 */}
      <header className="md:hidden safe-top sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur px-4 pb-2.5">
        {route === 'settings' ? (
          <button
            type="button"
            onClick={handleBackFromSettings}
            className="inline-flex h-10 items-center gap-1.5 -ml-1.5 rounded-xl px-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 cursor-pointer"
            aria-label={`返回${backTargetLabel}`}
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            <span>返回</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-slate-900">CET4-Prep</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('settings')}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 max-w-[110px] cursor-pointer"
            title="切换或管理学习账号"
          >
            <UserCircle2 className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
            <span className="truncate">{activeAccount.name}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('settings')}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg cursor-pointer ${
              route === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'
            }`}
            aria-label="设置"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* 主内容区域（按 activeAccount.id 重新挂载，切号后立即加载该账号独立进度与 API） */}
      <main className="flex-1 md:pl-60 pb-24 md:pb-8">
        <div key={activeAccount.id} className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-7">
          <Suspense
            fallback={
              <div className="py-16 text-center text-sm text-slate-500">正在加载模块...</div>
            }
          >
            {renderPage()}
          </Suspense>
        </div>
      </main>

      {/* 移动端底部 Tab 栏（适配刘海屏/手势条安全区） */}
      <nav className="md:hidden safe-bottom fixed bottom-0 inset-x-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="grid grid-cols-7">
          {NAV_ITEMS.filter((i) => i.key !== 'settings').map((item) => {
            const Icon = item.icon;
            const active = route === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.key)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] sm:text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                  active ? 'text-indigo-600' : 'text-slate-500'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
