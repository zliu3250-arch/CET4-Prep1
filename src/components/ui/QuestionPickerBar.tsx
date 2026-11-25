import { useState, type ReactNode } from 'react';
import { BookMarked, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from './index';

export interface PickerFilterTab {
  key: string;
  label: string;
  count?: number;
}

export interface PickerOptionItem {
  id: string;
  title: string;
  badge?: string;
  badgeTone?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose';
  meta?: string;
  extra?: ReactNode;
}

interface QuestionPickerBarProps {
  /** 模块题库标签，例如「写作真题」「翻译真题」 */
  label: string;
  /** 当前选中的题目标题 */
  currentTitle: string;
  /** 当前选中题目的短标签（题型/主题） */
  currentBadge?: string;
  /** 总题数 */
  totalCount: number;
  /** 可选分类筛选标签 */
  filterTabs?: PickerFilterTab[];
  activeFilter?: string;
  onFilterChange?: (key: string) => void;
  /** 下拉列表中的题目（应已按时间从新到旧排序） */
  items: PickerOptionItem[];
  activeId: string;
  onSelect: (id: string) => void;
  emptyText?: string;
}

/**
 * 提取标题中的真题时间权重（如 "2025年12月真题·第3套" -> 20251203），
 * 用于严格按时间从新到旧排序（越新的题目排越上面）。
 */
export function getExamTimeRank(title: string): number {
  const ym = title.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  if (!ym) return 0;
  const year = Number(ym[1]);
  const month = Number(ym[2]);
  const setMatch = title.match(/第\s*(\d+)\s*套/);
  const setNum = setMatch ? Number(setMatch[1]) : 0;
  return year * 10000 + month * 100 + setNum;
}

export function sortByNewestFirst<T extends { title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => getExamTimeRank(b.title) - getExamTimeRank(a.title));
}

export function QuestionPickerBar({
  label,
  currentTitle,
  currentBadge,
  totalCount,
  filterTabs,
  activeFilter,
  onFilterChange,
  items,
  activeId,
  onSelect,
  emptyText = '当前分类下暂无题目',
}: QuestionPickerBarProps) {
  const [open, setOpen] = useState(false);

  const handlePick = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
      {/* 顶部单行栏：默认最新真题 + 右侧下拉切换键 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <BookMarked className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
            <span>{label}</span>
            {currentBadge && (
              <Badge tone="indigo" className="text-[10px] py-0 px-1.5">
                {currentBadge}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 truncate">
            {currentTitle}
          </p>
        </div>

        <span className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
          <span>换题 ({totalCount})</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-indigo-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-indigo-600" />
          )}
        </span>
      </button>

      {/* 下拉展开的题库列表（按时间从新到旧从上到下排） */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-3 space-y-2.5">
          {filterTabs && filterTabs.length > 0 && onFilterChange && (
            <div className="flex flex-wrap gap-1.5">
              {filterTabs.map((tab) => {
                const active = tab.key === activeFilter;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onFilterChange(tab.key)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={active ? 'text-indigo-100' : 'text-slate-400'}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
              {emptyText}
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
              {items.map((item, idx) => {
                const selected = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePick(item.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50/80 ring-1 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                        <span className="text-slate-400 font-normal mr-1.5">{idx + 1}.</span>
                        {item.title}
                      </p>
                      {item.badge && (
                        <Badge tone={item.badgeTone ?? (selected ? 'indigo' : 'slate')} className="shrink-0">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    {(item.meta || item.extra) && (
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-500">
                        {item.meta && <span>{item.meta}</span>}
                        {item.extra}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
