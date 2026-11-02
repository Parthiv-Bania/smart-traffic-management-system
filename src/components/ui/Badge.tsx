import type { ReactNode } from 'react';
import type { DensityLevel, ApproachSignal } from '@/lib/traffic/types';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  danger: 'bg-rose-50 text-rose-800 ring-rose-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

export const DENSITY_TONE: Record<DensityLevel, BadgeTone> = {
  Low: 'success',
  Moderate: 'warning',
  High: 'warning',
  Critical: 'danger',
};

export const SIGNAL_COLOR: Record<ApproachSignal, string> = {
  GREEN: 'bg-emerald-500',
  YELLOW: 'bg-amber-400',
  RED: 'bg-rose-500',
};

export const SIGNAL_LABEL: Record<ApproachSignal, string> = {
  GREEN: 'Green',
  YELLOW: 'Yellow',
  RED: 'Red',
};

export function SignalDot({ signal }: { signal: ApproachSignal }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-700">
      <span className={`h-2.5 w-2.5 rounded-full ${SIGNAL_COLOR[signal]}`} aria-hidden="true" />
      {SIGNAL_LABEL[signal]}
    </span>
  );
}
