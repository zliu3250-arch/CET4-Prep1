import { lazy, Suspense } from 'react';
import {
  BookOpen,
  GraduationCap,
  Headphones,
  Home,
  Languages,
  PenLine,
  Settings,
  SpellCheck,
} from 'lucide-react';
import { useHashRoute } from '../hooks/useHashRoute';
import type { ModuleKey } from '../types/cet4';
import { DashboardPage } from './DashboardPage';
import { SettingsPage } from './SettingsPage';

const VocabPage = lazy(() => import('../features/vocab'));
const WritingPage = lazy(() => import('../features/writing'));
const TranslationPage = lazy(() => import('../features/translation'));
const ReadingPage = lazy(() => import('../features/reading'));
const ListeningPage = lazy(() => import('../features/listening'));

const NAV_ITEMS: Array<{
  key: ModuleKey;
  label: string;
  shortLabel: string;
  icon: typeof Home;
}> = [
  { key: 'dashboard', label: '学习首页', shortLabel: '首页', icon: Home },
  { key: 'vocab', label: '单词拼写', shortLabel: '单词', icon: SpellCheck },
  { key: 'writing', label: '写作训练', shortLabel: '写作', icon: PenLine },
  { key: 'translation', label: '翻译训练', shortLabel: '翻译', icon: Languages },
  { key: 'reading', label: '阅读理解', shortLabel: '阅读', icon: BookOpen },
  { key: 'listening', label: '听力训练', shortLabel: '听力', icon: Headphones },
  { key: 'settings', label: '设置与导入', shortLabel: '设置', icon: Settings },
];

export function App() {
  const { route, navigate } = useHashRoute();

  const renderPage = () => {
    switch (route) {
      case 'dashboard':
        return <DashboardPage onNavigate={navigate} />;
      case 'vocab':
        return <VocabPage />;
      case 'writing':
        return <WritingPage />;
      case 'translation':
        return <TranslationPage />;
      case 'reading':
        return <ReadingPage />;
      case 'listening':
        return <ListeningPage />;
      case 'settings':
        return <SettingsPage />;
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

        <div className="p-4 border-t border-slate-100 text-xs text-slate-400">
          离线可用 · 本地存储
        </div>
      </aside>

      {/* 移动端顶部栏 */}
      <header className="md:hidden sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
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
        <button
          type="button"
          onClick={() => navigate('settings')}
          className={`rounded-lg p-1.5 cursor-pointer ${
            route === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'
          }`}
          aria-label="设置"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 md:pl-60 pb-20 md:pb-8">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-7">
          <Suspense
            fallback={
              <div className="py-16 text-center text-sm text-slate-500">正在加载模块...</div>
            }
          >
            {renderPage()}
          </Suspense>
        </div>
      </main>

      {/* 移动端底部 Tab 栏 */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="grid grid-cols-6">
          {NAV_ITEMS.filter((i) => i.key !== 'settings').map((item) => {
            const Icon = item.icon;
            const active = route === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.key)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium cursor-pointer ${
                  active ? 'text-indigo-600' : 'text-slate-500'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
