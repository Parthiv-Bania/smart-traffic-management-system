import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Clock, FlaskConical, TrafficCone } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatePanels';
import { useIntersections } from '@/hooks/useIntersections';
import { fetchSimulationRuns } from '@/lib/simulationRuns';
import { formatDateTime, formatNumber, formatPercent, formatSeconds } from '@/lib/format';
import type { SimulationRunRow } from '@/types/database';

const RUN_SAMPLE_SIZE = 50;
const CHART_RUN_COUNT = 10;

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  icon: typeof Activity;
}

function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <Icon className="h-5 w-5 text-sky-600" aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function DashboardPage() {
  const intersections = useIntersections();
  const [runs, setRuns] = useState<SimulationRunRow[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchSimulationRuns(RUN_SAMPLE_SIZE).then((result) => {
      if (cancelled) return;
      setRuns(result.runs);
      setRunsError(result.error);
      setRunsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (intersections.loading || runsLoading) return <LoadingState label="Loading dashboard" />;
  if (intersections.error) return <ErrorState message={intersections.error} />;
  if (runsError) return <ErrorState message={runsError} />;

  const activeCount = intersections.intersections.filter((item) => item.status === 'active').length;
  const averageDelay = runs.length > 0 ? runs.reduce((sum, run) => sum + run.metrics.averageDelaySeconds, 0) / runs.length : 0;
  const averageUtilization = runs.length > 0 ? runs.reduce((sum, run) => sum + run.metrics.signalUtilization, 0) / runs.length : 0;
  const chartData = runs
    .slice(0, CHART_RUN_COUNT)
    .reverse()
    .map((run, index) => ({
      label: `Run ${index + 1}`,
      delay: Math.round(run.metrics.averageDelaySeconds),
      mode: run.control_mode === 'adaptive' ? 'Adaptive' : 'Fixed-time',
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Overview of your intersections and saved simulation runs.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active intersections"
          value={formatNumber(activeCount)}
          hint={`${formatNumber(intersections.intersections.length)} configured in total`}
          icon={TrafficCone}
        />
        <StatCard label="Saved runs" value={formatNumber(runs.length)} hint={`Latest ${RUN_SAMPLE_SIZE} shown in this summary`} icon={FlaskConical} />
        <StatCard
          label="Average delay"
          value={runs.length > 0 ? formatSeconds(averageDelay) : '-'}
          hint="Across saved runs"
          icon={Clock}
        />
        <StatCard
          label="Signal utilization"
          value={runs.length > 0 ? formatPercent(averageUtilization) : '-'}
          hint="Share of green time used for discharge"
          icon={Activity}
        />
      </div>

      <Panel title="Average delay per saved run" description="Seconds of average delay for the most recent runs. Lower is better.">
        {chartData.length === 0 ? (
          <EmptyState
            title="No saved runs yet"
            description="Run a live simulation and save the result to see delay trends here."
            action={<Link to="/simulation" className="text-sm font-medium text-sky-700">Open live simulation</Link>}
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis tick={{ fill: '#475569', fontSize: 12 }} unit=" s" width={56} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  formatter={(value) => [`${value} s`, 'Average delay']}
                  labelFormatter={(_, payload) => (payload?.[0]?.payload as { mode?: string } | undefined)?.mode ?? ''}
                />
                <Bar dataKey="delay" fill="#0284c7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Recent saved runs">
        {runs.length === 0 ? (
          <p className="text-sm text-slate-500">Saved runs will be listed here.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {runs.slice(0, 5).map((run) => {
              const intersection = intersections.intersections.find((item) => item.id === run.intersection_id);
              return (
                <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{intersection?.name ?? 'Removed intersection'}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(run.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={run.control_mode === 'adaptive' ? 'info' : 'neutral'}>
                      {run.control_mode === 'adaptive' ? 'Adaptive' : 'Fixed-time'}
                    </Badge>
                    <span className="text-sm tabular-nums text-slate-700">{formatSeconds(run.metrics.averageDelaySeconds)} delay</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
