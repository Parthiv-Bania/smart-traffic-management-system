import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin text-sky-600" aria-hidden="true" />
      <span className="text-sm">{label}...</span>
    </div>
  );
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-rose-600" aria-hidden="true" />
      <p className="text-sm font-medium text-rose-800">{message}</p>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <Inbox className="h-8 w-8 text-slate-400" aria-hidden="true" />
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="max-w-md text-sm text-slate-500">{description}</p>
      {action}
    </div>
  );
}
