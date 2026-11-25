import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Clock, Pause, Play, RotateCcw } from 'lucide-react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  const styles: Record<ButtonVariant, string> = {
    primary:
      'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300 shadow-xs',
    secondary:
      'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 disabled:opacity-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

type BadgeTone = 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';

export function Badge({
  children,
  tone = 'slate',
  className = '',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function TimerBar({
  secondsLeft,
  running,
  onToggle,
  onReset,
}: {
  secondsLeft: number;
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const urgent = secondsLeft <= 300;

  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
      <Clock className={`h-4 w-4 ${urgent ? 'text-rose-600' : 'text-indigo-600'}`} />
      <span
        className={`font-mono text-sm font-semibold tabular-nums ${
          urgent ? 'text-rose-600' : 'text-slate-800'
        }`}
      >
        {formatted}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="rounded-lg p-1 text-slate-600 hover:bg-slate-200 cursor-pointer"
        title={running ? '暂停计时' : '开始计时'}
      >
        {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg p-1 text-slate-600 hover:bg-slate-200 cursor-pointer"
        title="重置计时"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
