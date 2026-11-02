import { EmptyState } from '@/components/ui/StatePanels';
import { formatSeconds } from '@/lib/format';
import type { DecisionLogEntry } from '@/lib/traffic/types';

const RECENT_LIMIT = 20;

export function DecisionLogPanel({ decisions }: { decisions: DecisionLogEntry[] }) {
  if (decisions.length === 0) {
    return <EmptyState title="No signal decisions yet" description="Start the simulation to see each phase change and the reason for it." />;
  }
  const recent = decisions.slice(-RECENT_LIMIT).reverse();
  return (
    <ol className="divide-y divide-slate-100">
      {recent.map((entry) => (
        <li key={entry.sequence} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">
              Group {entry.newPhase.group} {entry.newPhase.state.toLowerCase().replace('_', ' ')}
            </p>
            <p className="text-xs tabular-nums text-slate-500">
              {formatSeconds(entry.simTime)} - {entry.greenSeconds} s green
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-600">{entry.reason}</p>
        </li>
      ))}
    </ol>
  );
}
