import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Printer, Save } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatePanels';
import { useAuth } from '@/contexts/AuthContext';
import { useIntersections } from '@/hooks/useIntersections';
import { buildSimulationConfig, seedFromText } from '@/lib/intersectionConfig';
import { formatNumber, formatPercent, formatSeconds, percentChange } from '@/lib/format';
import { insertSimulationRuns, type NewSimulationRun } from '@/lib/simulationRuns';
import { CAN_VIEW_ANALYTICS } from '@/lib/permissions';
import { runSimulationForComparison } from '@/lib/traffic/intersectionSimulation';
import type { ControlMode, SimulationMetrics } from '@/lib/traffic/types';

const DURATION_OPTIONS = [300, 600, 1800] as const;
const INTENSITY_OPTIONS = [0.5, 1, 1.5, 2] as const;

type Duration = (typeof DURATION_OPTIONS)[number];
type Intensity = (typeof INTENSITY_OPTIONS)[number];

interface ComparisonResult {
  intersectionId: string;
  intersectionName: string;
  durationSeconds: Duration;
  intensity: Intensity;
  seed: number;
  fixed: SimulationMetrics;
  adaptive: SimulationMetrics;
}

interface MetricRow {
  label: string;
  unit: string;
  fixedValue: number;
  adaptiveValue: number;
  higherIsBetter: boolean;
  format: (value: number) => string;
}

function buildMetricRows(result: ComparisonResult): MetricRow[] {
  return [
    {
      label: 'Average delay',
      unit: 'seconds',
      fixedValue: result.fixed.averageDelaySeconds,
      adaptiveValue: result.adaptive.averageDelaySeconds,
      higherIsBetter: false,
      format: (value) => formatSeconds(value),
    },
    {
      label: 'Average queue length',
      unit: 'vehicles',
      fixedValue: result.fixed.averageQueueLength,
      adaptiveValue: result.adaptive.averageQueueLength,
      higherIsBetter: false,
      format: (value) => formatNumber(value, 1),
    },
    {
      label: 'Throughput per hour',
      unit: 'vehicles',
      fixedValue: result.fixed.throughputVehiclesPerHour,
      adaptiveValue: result.adaptive.throughputVehiclesPerHour,
      higherIsBetter: true,
      format: (value) => formatNumber(value),
    },
    {
      label: 'Congestion time',
      unit: 'seconds',
      fixedValue: result.fixed.congestionSeconds,
      adaptiveValue: result.adaptive.congestionSeconds,
      higherIsBetter: false,
      format: (value) => formatSeconds(value),
    },
    {
      label: 'Signal utilization',
      unit: 'share of green',
      fixedValue: result.fixed.signalUtilization,
      adaptiveValue: result.adaptive.signalUtilization,
      higherIsBetter: true,
      format: (value) => formatPercent(value),
    },
    {
      label: 'Fairness index',
      unit: '0 to 1',
      fixedValue: result.fixed.fairnessIndex,
      adaptiveValue: result.adaptive.fairnessIndex,
      higherIsBetter: true,
      format: (value) => formatNumber(value, 2),
    },
  ];
}

function toCsv(result: ComparisonResult): string {
  const header = ['metric', 'unit', 'fixed', 'adaptive', 'change_percent'];
  const rows = buildMetricRows(result).map((row) => {
    const change = percentChange(row.fixedValue, row.adaptiveValue);
    return [row.label, row.unit, row.fixedValue.toFixed(4), row.adaptiveValue.toFixed(4), change === null ? '' : change.toFixed(2)];
  });
  const meta = [
    ['intersection', result.intersectionName],
    ['duration_seconds', String(result.durationSeconds)],
    ['traffic_intensity', String(result.intensity)],
    ['random_seed', String(result.seed)],
  ];
  return [...meta, [], header, ...rows].map((cells) => cells.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsPage() {
  const { profile } = useAuth();
  const canSave = profile ? CAN_VIEW_ANALYTICS.includes(profile.role) : false;
  const { intersections, loading, error, reload } = useIntersections();
  const [intersectionId, setIntersectionId] = useState<string>('');
  const [durationSeconds, setDurationSeconds] = useState<Duration>(600);
  const [intensity, setIntensity] = useState<Intensity>(1);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const selected = intersections.find((item) => item.id === intersectionId) ?? intersections[0] ?? null;
  const rows = useMemo(() => (result ? buildMetricRows(result) : []), [result]);

  if (loading) return <LoadingState label="Loading intersections" />;
  if (error) return <ErrorState message={error} action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>} />;
  if (!selected) {
    return <EmptyState title="No intersections yet" description="Add an intersection before running a comparison." />;
  }

  const runComparison = () => {
    const seed = seedFromText(selected.code);
    const build = (controlMode: ControlMode) =>
      buildSimulationConfig(selected, selected.approaches, { controlMode, trafficIntensity: intensity, randomSeed: seed });
    setSaveMessage(null);
    setResult({
      intersectionId: selected.id,
      intersectionName: selected.name,
      durationSeconds,
      intensity,
      seed,
      fixed: runSimulationForComparison(build('fixed'), durationSeconds),
      adaptive: runSimulationForComparison(build('adaptive'), durationSeconds),
    });
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setSaveMessage(null);
    const comparisonId = crypto.randomUUID();
    const rowsToSave: NewSimulationRun[] = (['fixed', 'adaptive'] as const).map((mode) => ({
      intersection_id: result.intersectionId,
      comparison_id: comparisonId,
      control_mode: mode,
      duration_seconds: result.durationSeconds,
      random_seed: result.seed,
      traffic_intensity: result.intensity,
      metrics: result[mode],
    }));
    const failure = await insertSimulationRuns(rowsToSave);
    setSaving(false);
    setSaveMessage(
      failure ? { tone: 'error', text: failure } : { tone: 'success', text: 'Both runs were saved together as one comparison.' },
    );
  };

  const delayChange = result ? percentChange(result.fixed.averageDelaySeconds, result.adaptive.averageDelaySeconds) : null;
  const chartData = result
    ? [
        { mode: 'Fixed-time', delay: Math.round(result.fixed.averageDelaySeconds) },
        { mode: 'Adaptive', delay: Math.round(result.adaptive.averageDelaySeconds) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">STMS analytics report</p>
        <p className="text-xs text-slate-500">Generated {new Date().toLocaleString()}</p>
      </div>
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900">Fixed-time vs adaptive</h1>
        <p className="mt-1 text-sm text-slate-600">
          Both modes run on the same random traffic, so the difference comes from the signal control alone. Results are from the built-in model.
        </p>
      </div>

      <Panel className="print:hidden">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Intersection</span>
            <select
              value={selected.id}
              onChange={(event) => setIntersectionId(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {intersections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Duration</span>
            <select
              value={durationSeconds}
              onChange={(event) => setDurationSeconds(Number(event.target.value) as Duration)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {DURATION_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value / 60} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Traffic intensity</span>
            <select
              value={intensity}
              onChange={(event) => setIntensity(Number(event.target.value) as Intensity)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {INTENSITY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}x
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={runComparison}>Run comparison</Button>
        </div>
      </Panel>

      {!result ? (
        <EmptyState title="No comparison yet" description="Choose settings above and run the comparison to see the results." />
      ) : (
        <>
          <Panel
            title={`Results for ${result.intersectionName}`}
            description={`${result.durationSeconds / 60} minutes at ${result.intensity}x traffic, seed ${result.seed}.`}
            actions={
              <>
                <Button
                  variant="secondary"
                  className="print:hidden"
                  onClick={() => downloadCsv(`comparison-${result.intersectionName.replace(/\s+/g, '-').toLowerCase()}.csv`, toCsv(result))}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export CSV
                </Button>
                <Button variant="secondary" className="print:hidden" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Export PDF
                </Button>
                {canSave && (
                  <Button className="print:hidden" onClick={() => void handleSave()} loading={saving}>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save both runs
                  </Button>
                )}
              </>
            }
          >
            <p className="text-sm text-slate-700">
              {delayChange === null
                ? 'There is no delay in this run to compare.'
                : delayChange <= 0
                  ? `In this run, adaptive control cut average delay by ${formatPercent(Math.abs(delayChange) / 100)} compared with fixed-time.`
                  : `In this run, adaptive control increased average delay by ${formatPercent(delayChange / 100)} compared with fixed-time. Try a different duration or intensity before drawing conclusions.`}
            </p>
            {saveMessage && (
              <p role={saveMessage.tone === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${saveMessage.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>
                {saveMessage.text}
              </p>
            )}
          </Panel>

          <div className="grid gap-6 xl:grid-cols-5">
            <Panel title="Metrics" className="xl:col-span-3">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th scope="col" className="py-3 pr-4">Metric</th>
                      <th scope="col" className="py-3 pr-4 text-right">Fixed-time</th>
                      <th scope="col" className="py-3 pr-4 text-right">Adaptive</th>
                      <th scope="col" className="py-3 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const change = percentChange(row.fixedValue, row.adaptiveValue);
                      const improved = change === null ? null : row.higherIsBetter ? change > 0 : change < 0;
                      return (
                        <tr key={row.label}>
                          <td className="py-3 pr-4 text-slate-900">{row.label}</td>
                          <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{row.format(row.fixedValue)}</td>
                          <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{row.format(row.adaptiveValue)}</td>
                          <td className="py-3 text-right">
                            {change === null || change === 0 ? (
                              <span className="text-slate-500">No change</span>
                            ) : (
                              <Badge tone={improved ? 'success' : 'danger'}>
                                {change > 0 ? '+' : ''}
                                {change.toFixed(1)}%
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Average delay" className="xl:col-span-2">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="mode" tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} unit=" s" width={56} />
                    <Tooltip formatter={(value) => [`${value} s`, 'Average delay']} cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="delay" fill="#0284c7" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
