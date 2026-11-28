import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Flame,
  Headphones,
  Languages,
  PenLine,
  Sparkles,
  SpellCheck,
  AlertCircle,
} from 'lucide-react';
import { Badge, Card, SectionHeader } from '../components/ui';
import { getDashboardStats, hasValidAIConfig } from '../services/storage';
import type { ModuleKey, PracticeModuleKey } from '../types/cet4';

const MODULE_CARDS: Array<{
  key: PracticeModuleKey;
  title: string;
  desc: string;
  icon: typeof SpellCheck;
  color: string;
}> = [
  {
    key: 'vocab',
    title: '词汇训练',
    desc: '4,000 词四档分级、5 种题型（选词/拼写）与错词本重练',
    icon: SpellCheck,
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    key: 'writing',
    title: '写作训练',
    desc: '30 分钟倒计时、字数统计、范文对照与可选 AI 批改',
    icon: PenLine,
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    key: 'translation',
    title: '翻译训练',
    desc: '四级汉译英段落、难点词汇提示、参考译文与 AI 点评',
    icon: Languages,
    color: 'bg-amber-50 text-amber-600',
  },
  {
    key: 'reading',
    title: '阅读理解',
    desc: '仔细阅读 / 选词填空 / 长篇匹配，自动判分与原文定位',
    icon: BookOpen,
    color: 'bg-sky-50 text-sky-600',
  },
  {
    key: 'listening',
    title: '听力训练',
    desc: '历年听力套卷练习、倍速/回退、离线朗读与原文对照',
    icon: Headphones,
    color: 'bg-violet-50 text-violet-600',
  },
  {
    key: 'mock',
    title: '综合测试（套卷模考）',
    desc: '历年四级整理套卷 · 125 分钟限时 + 客观题自动计分（可选 AI 估分）',
    icon: Award,
    color: 'bg-rose-50 text-rose-600',
  },
];

const MODULE_LABELS: Record<PracticeModuleKey, string> = {
  vocab: '单词',
  writing: '写作',
  translation: '翻译',
  reading: '阅读',
  listening: '听力',
  mock: '模考',
};

export function DashboardPage({
  onNavigate,
  onStartQuickVocab,
}: {
  onNavigate: (next: ModuleKey) => void;
  onStartQuickVocab: () => void;
}) {
  const stats = getDashboardStats();
  const aiReady = hasValidAIConfig();
  const isFirstVisit =
    stats.totalCount === 0 && stats.masteredWordCount === 0 && stats.wrongWordCount === 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="CET-4 英语四级备考工作台"
        subtitle="纯前端本地优先 PWA · 六大训练模块"
        action={
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="cursor-pointer"
          >
            <Badge tone={aiReady ? 'emerald' : 'slate'}>
              {aiReady ? 'AI 批改已配置' : '离线范文模式（点此可选配置 AI）'}
            </Badge>
          </button>
        }
      />

      {isFirstVisit && (
        <Card className="border-indigo-200 bg-indigo-50/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-xl bg-indigo-100 p-2 text-indigo-600 shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  首次打开？免登录、零广告，直接开始 1 分钟核心词自测
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  所有进度与错词本默认保存在本地浏览器，不配置 AI Key 也可完整刷题与对照范文。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onStartQuickVocab}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer"
              >
                开始 800 核心词 10 词快测
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('mock')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer"
              >
                体验 125 分钟模考
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* 顶部核心指标 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">今日练习</p>
            <p className="text-xl font-bold text-slate-900">{stats.todayCount}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">累计打卡</p>
            <p className="text-xl font-bold text-slate-900">{stats.totalCount}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-50 p-2.5 text-sky-600">
            <SpellCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">已掌握单词</p>
            <p className="text-xl font-bold text-slate-900">{stats.masteredWordCount}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">错词本待消灭</p>
            <p className="text-xl font-bold text-slate-900">{stats.wrongWordCount}</p>
          </div>
        </Card>
      </div>

      {/* 六大功能模块入口 */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-800">六大训练模块</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_CARDS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className="group text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className={`rounded-xl p-2.5 ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge tone="slate">已练 {stats.moduleCounts[item.key]} 次</Badge>
                </div>
                <h3 className="mt-3.5 text-base font-bold text-slate-900 group-hover:text-indigo-600">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 最近练习记录 */}
      <Card>
        <h2 className="mb-3 text-base font-semibold text-slate-800">最近练习记录</h2>
        {stats.recentLogs.length === 0 ? (
          <p className="text-sm text-slate-500">
            还没有练习记录，从上方任意选择一个模块开始今天的四级刷题吧！
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {stats.recentLogs.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Badge tone="indigo">{MODULE_LABELS[log.module]}</Badge>
                  <span className="truncate font-medium text-slate-800">{log.title}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500">
                  {typeof log.accuracy === 'number' && (
                    <span className="font-semibold text-emerald-600">
                      正确率 {log.accuracy}%
                    </span>
                  )}
                  {typeof log.score === 'number' && typeof log.maxScore === 'number' && (
                    <span className="font-semibold text-indigo-600">
                      {log.score}/{log.maxScore}
                    </span>
                  )}
                  <span>{new Date(log.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
