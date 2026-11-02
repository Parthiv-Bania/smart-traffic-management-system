import { Badge, DENSITY_TONE, SignalDot } from '@/components/ui/Badge';
import { formatNumber, formatPercent, formatSeconds } from '@/lib/format';
import type { ApproachSnapshot } from '@/lib/traffic/types';

interface ApproachCardProps {
  approach: ApproachSnapshot;
  detectorOnline: boolean;
  canControlDetector: boolean;
  onToggleDetector: (approachId: string, online: boolean) => void;
}

export function ApproachCard({ approach, detectorOnline, canControlDetector, onToggleDetector }: ApproachCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {approach.name} - Group {approach.phaseGroup}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">{approach.roadName}</h3>
        </div>
        <SignalDot signal={approach.signal} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-slate-500">Queue</p>
          <p className="text-xl font-semibold tabular-nums text-slate-900">{formatNumber(approach.queue)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Approaching</p>
          <p className="text-xl font-semibold tabular-nums text-slate-900">{formatNumber(approach.approachingCount)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Oldest wait</p>
          <p className="text-xl font-semibold tabular-nums text-slate-900">{formatSeconds(approach.waitSeconds)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={DENSITY_TONE[approach.density]}>{approach.density}</Badge>
          <span className="text-xs text-slate-500">Occupancy {formatPercent(approach.occupancy)}</span>
        </div>
        {canControlDetector ? (
          <button
            type="button"
            role="switch"
            aria-checked={detectorOnline}
            onClick={() => onToggleDetector(approach.id, !detectorOnline)}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${detectorOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}
              aria-hidden="true"
            >
              <span
                className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${detectorOnline ? 'translate-x-3.5' : 'translate-x-0.5'}`}
              />
            </span>
            Detector {detectorOnline ? 'online' : 'offline'}
          </button>
        ) : (
          <span className="text-xs text-slate-500">Detector {detectorOnline ? 'online' : 'offline'}</span>
        )}
      </div>
      {!detectorOnline && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Without a detector this approach falls back to fixed timing.
        </p>
      )}
    </article>
  );
}
