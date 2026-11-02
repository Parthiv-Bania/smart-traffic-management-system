import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MonitorPlay, Pencil, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIntersections, type IntersectionWithApproaches } from '@/hooks/useIntersections';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatePanels';
import { IntersectionFormModal } from '@/components/intersections/IntersectionFormModal';
import { fetchSimulationRuns } from '@/lib/simulationRuns';
import { CAN_MANAGE_INTERSECTIONS } from '@/lib/permissions';
import { formatDateTime, formatNumber, formatPercent, formatSeconds } from '@/lib/format';
import type { SimulationRunRow } from '@/types/database';

function TimingTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PhasePlan({ intersection }: { intersection: IntersectionWithApproaches }) {
  const groups = ['A', 'B'] as const;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => {
        const members = intersection.approaches.filter((approach) => approach.phase_group === group);
        return (
          <div key={group} className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Phase {group}</p>
            <p className="mt-1 text-sm text-slate-600">
              {members.length > 0 ? members.map((approach) => approach.name).join(' and ') : 'No approaches assigned'}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Green {intersection.min_green_seconds}-{intersection.max_green_seconds}s, yellow {intersection.yellow_seconds}s, all-red {intersection.all_red_seconds}s.
              Phase {group} never shares green with the other phase.
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function IntersectionDetailPage() {
  const { intersectionId } = useParams<{ intersectionId: string }>();
  const { profile } = useAuth();
  const canManage = profile ? CAN_MANAGE_INTERSECTIONS.includes(profile.role) : false;
  const { intersections, loading, error, reload } = useIntersections();
  const [editing, setEditing] = useState(false);
  const [runs, setRuns] = useState<SimulationRunRow[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(true);

  const intersection = intersections.find((item) => item.id === intersectionId) ?? null;

  useEffect(() => {
    if (!intersectionId) return;
    let cancelled = false;
    void fetchSimulationRuns(10, intersectionId).then((result) => {
      if (cancelled) return;
      setRuns(result.runs);
      setRunsError(result.error);
      setRunsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [intersectionId]);

  if (loading) return <LoadingState label="Loading intersection" />;
  if (error) return <ErrorState message={error} action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>} />;
  if (!intersection) {
    return (
      <EmptyState
        title="Intersection not found"
        description="It may have been deleted, or the link is incorrect."
        action={<Link to="/intersections" className="text-sm font-medium text-sky-700">Back to intersections</Link>}
      />
    );
  }

  const approaches = [...intersection.approaches].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <Link to="/intersections" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All intersections
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-sky-700">{intersection.code}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{intersection.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={intersection.status === 'active' ? 'success' : 'neutral'}>
              {intersection.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
            <Badge tone={intersection.control_mode === 'adaptive' ? 'info' : 'neutral'}>
              {intersection.control_mode === 'adaptive' ? 'Adaptive control' : 'Fixed-time control'}
            </Badge>
            <span className="inline-flex items-center gap-1 text-sm text-slate-500">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {intersection.city}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/simulation?intersection=${intersection.id}`}>
            <Button>
              <MonitorPlay className="h-4 w-4" aria-hidden="true" />
              Open live simulation
            </Button>
          </Link>
          {canManage && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <Panel title="Signal timing" description="Limits enforced by the signal controller in both control modes.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <TimingTile label="Min green" value={`${intersection.min_green_seconds} s`} />
          <TimingTile label="Max green" value={`${intersection.max_green_seconds} s`} />
          <TimingTile label="Yellow" value={`${intersection.yellow_seconds} s`} />
          <TimingTile label="All-red" value={`${intersection.all_red_seconds} s`} />
          <TimingTile label="Fixed-plan green" value={`${intersection.fixed_green_seconds} s`} />
        </div>
      </Panel>

      <Panel title="Phases" description="Approaches in the same phase group receive green together. Different groups never do.">
        <PhasePlan intersection={intersection} />
      </Panel>

      <Panel title="Road approaches" description="Roads entering this intersection and their demand inputs.">
        {approaches.length === 0 ? (
          <EmptyState title="No approaches" description="Edit this intersection to add its approaches." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-3 pr-4">Approach</th>
                  <th scope="col" className="py-3 pr-4">Road</th>
                  <th scope="col" className="py-3 pr-4">Lanes</th>
                  <th scope="col" className="py-3 pr-4">Phase</th>
                  <th scope="col" className="py-3 pr-4">Arrivals / min</th>
                  <th scope="col" className="py-3">Saturation (veh/h/lane)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approaches.map((approach) => (
                  <tr key={approach.id}>
                    <td className="py-3 pr-4 font-medium text-slate-900">{approach.name}</td>
                    <td className="py-3 pr-4 text-slate-700">{approach.road_name}</td>
                    <td className="py-3 pr-4 text-slate-700">{approach.lanes}</td>
                    <td className="py-3 pr-4 text-slate-700">Group {approach.phase_group}</td>
                    <td className="py-3 pr-4 text-slate-700">{formatNumber(approach.base_arrival_rate, 1)}</td>
                    <td className="py-3 text-slate-700">{formatNumber(approach.saturation_flow_vph)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Recent saved runs" description="Simulation results saved for this intersection, newest first.">
        {runsLoading ? (
          <LoadingState label="Loading saved runs" />
        ) : runsError ? (
          <ErrorState message={runsError} />
        ) : runs.length === 0 ? (
          <EmptyState title="No saved runs" description="Save a run from the live simulation or the analytics page to see its results here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-3 pr-4">Saved</th>
                  <th scope="col" className="py-3 pr-4">Mode</th>
                  <th scope="col" className="py-3 pr-4">Duration</th>
                  <th scope="col" className="py-3 pr-4">Avg delay</th>
                  <th scope="col" className="py-3 pr-4">Throughput / h</th>
                  <th scope="col" className="py-3">Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="py-3 pr-4 text-slate-600">{formatDateTime(run.created_at)}</td>
                    <td className="py-3 pr-4 text-slate-700">{run.control_mode === 'adaptive' ? 'Adaptive' : 'Fixed-time'}</td>
                    <td className="py-3 pr-4 text-slate-700">{Math.round(run.duration_seconds / 60)} min</td>
                    <td className="py-3 pr-4 text-slate-700">{formatSeconds(run.metrics.averageDelaySeconds)}</td>
                    <td className="py-3 pr-4 text-slate-700">{formatNumber(run.metrics.throughputVehiclesPerHour)}</td>
                    <td className="py-3 text-slate-700">{formatPercent(run.metrics.signalUtilization)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && (
        <IntersectionFormModal
          existing={intersection}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void reload();
          }}
        />
      )}
    </div>
  );
}
