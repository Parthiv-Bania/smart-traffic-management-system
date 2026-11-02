import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pause, Play, RotateCcw, Save, Square } from 'lucide-react';
import { SimulationAlerts } from '@/components/simulation/SimulationAlerts';
import { ApproachCard } from '@/components/simulation/ApproachCard';
import { EmergencyPanel } from '@/components/simulation/EmergencyPanel';
import { DecisionLogPanel } from '@/components/simulation/DecisionLogPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatePanels';
import { useAuth } from '@/contexts/AuthContext';
import { useIntersections } from '@/hooks/useIntersections';
import { SIMULATION_SPEEDS, useTrafficSimulation, type SimulationSpeed } from '@/hooks/useTrafficSimulation';
import { buildSimulationConfig, seedFromText } from '@/lib/intersectionConfig';
import { formatNumber, formatPercent, formatSeconds } from '@/lib/format';
import { CAN_RUN_SIMULATION } from '@/lib/permissions';
import { insertSimulationRuns } from '@/lib/simulationRuns';
import {
  closeEmergencyRequestWhenRecorded,
  openEmergencyRequest,
} from '@/lib/emergencyRequests';
import type { ControlMode } from '@/lib/traffic/types';

const INTENSITY_OPTIONS = [0.5, 1, 1.5, 2] as const;
const MIN_SAVE_SECONDS = 60;

export function LiveSimulationPage() {
  const { profile } = useAuth();
  const canOperate = profile ? CAN_RUN_SIMULATION.includes(profile.role) : false;
  const { intersections, loading, error, reload } = useIntersections();
  const [searchParams, setSearchParams] = useSearchParams();
  const [controlMode, setControlMode] = useState<ControlMode>('adaptive');
  const [intensity, setIntensity] = useState<(typeof INTENSITY_OPTIONS)[number]>(1);
  const [detectors, setDetectors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const selectedId = searchParams.get('intersection');
  const intersection = intersections.find((item) => item.id === selectedId) ?? intersections[0] ?? null;

  const config = useMemo(() => {
    if (!intersection) return null;
    return buildSimulationConfig(intersection, intersection.approaches, {
      controlMode,
      trafficIntensity: intensity,
      randomSeed: seedFromText(intersection.code),
    });
  }, [intersection, controlMode, intensity]);

  const sim = useTrafficSimulation(config);
  const { snapshot, status, speed, setSpeed } = sim;

  useEffect(() => {
    setDetectors({});
    setSaveMessage(null);
  }, [config]);

  const loggedEmergencyRef = useRef<{ approachId: string; requestId: Promise<string | null> } | null>(null);
  const [emergencyLogError, setEmergencyLogError] = useState<string | null>(null);
  const activeEmergencyApproachId = snapshot?.emergency?.approachId ?? null;

  useEffect(() => {
    const logged = loggedEmergencyRef.current;
    if (!logged || logged.approachId === activeEmergencyApproachId) return;
    loggedEmergencyRef.current = null;
    closeEmergencyRequestWhenRecorded(logged.requestId, setEmergencyLogError);
  }, [activeEmergencyApproachId]);

  useEffect(() => {
    return () => {
      const logged = loggedEmergencyRef.current;
      if (!logged) return;
      loggedEmergencyRef.current = null;
      closeEmergencyRequestWhenRecorded(logged.requestId, setEmergencyLogError);
    };
  }, []);

  if (loading) return <LoadingState label="Loading intersections" />;
  if (error) {
    return <ErrorState message={error} action={<Button variant="secondary" onClick={() => void reload()}>Try again</Button>} />;
  }
  if (!intersection || !config || !snapshot) {
    return (
      <EmptyState
        title="No intersections yet"
        description="Add an intersection first. The live simulation runs on the approaches you configure there."
      />
    );
  }

  const allDetectorsOnline = snapshot.approaches.every((approach) => detectors[approach.id] !== false);
  const canSave = canOperate && snapshot.simTime >= MIN_SAVE_SECONDS && allDetectorsOnline && !saving;
  const activeApproaches = snapshot.approaches.filter((approach) => approach.phaseGroup === snapshot.signal.activePhase.group);

  const selectIntersection = (id: string) => {
    setSearchParams({ intersection: id });
  };

  const toggleDetector = (approachId: string, online: boolean) => {
    setDetectors((previous) => ({ ...previous, [approachId]: online }));
    sim.setDetectorOnline(approachId, online);
  };

  const handleReset = () => {
    setDetectors({});
    setSaveMessage(null);
    sim.reset();
  };

  const handleRequestEmergency = (approachId: string) => {
    if (!sim.requestEmergency(approachId)) return;
    const approach = snapshot.approaches.find((item) => item.id === approachId);
    if (!approach) return;
    const previous = loggedEmergencyRef.current;
    if (previous) closeEmergencyRequestWhenRecorded(previous.requestId, setEmergencyLogError);
    const requestId = openEmergencyRequest(intersection.id, approach.name).then((result) => {
      if (result.error) setEmergencyLogError(result.error);
      return result.id;
    });
    loggedEmergencyRef.current = { approachId, requestId };
    setEmergencyLogError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    const failure = await insertSimulationRuns([
      {
        intersection_id: intersection.id,
        comparison_id: null,
        control_mode: controlMode,
        duration_seconds: Math.round(snapshot.simTime),
        random_seed: config.randomSeed,
        traffic_intensity: intensity,
        metrics: snapshot.metrics,
      },
    ]);
    setSaving(false);
    setSaveMessage(
      failure ? { tone: 'error', text: failure } : { tone: 'success', text: 'Run saved. You can find it on the intersection page.' },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Live simulation</h1>
          <p className="mt-1 text-sm text-slate-600">
            A simulated view of {intersection.name}. Results come from the built-in model, not from real traffic sensors or signals.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Intersection</span>
            <select
              value={intersection.id}
              onChange={(event) => selectIntersection(event.target.value)}
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
            <span className="text-xs font-medium text-slate-600">Control mode</span>
            <select
              value={controlMode}
              onChange={(event) => setControlMode(event.target.value as ControlMode)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="adaptive">Adaptive</option>
              <option value="fixed">Fixed-time</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Traffic intensity</span>
            <select
              value={intensity}
              onChange={(event) => setIntensity(Number(event.target.value) as (typeof INTENSITY_OPTIONS)[number])}
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
      </div>

      <Panel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {status === 'running' && <Button onClick={sim.pause} variant="secondary"><Pause className="h-4 w-4" aria-hidden="true" />Pause</Button>}
            {status === 'paused' && <Button onClick={sim.resume}><Play className="h-4 w-4" aria-hidden="true" />Resume</Button>}
            {status === 'stopped' && <Button onClick={sim.start}><Play className="h-4 w-4" aria-hidden="true" />Start</Button>}
            <Button variant="secondary" onClick={sim.stop} disabled={status === 'stopped'}>
              <Square className="h-4 w-4" aria-hidden="true" />
              Stop
            </Button>
            <Button variant="ghost" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1" role="group" aria-label="Simulation speed">
              {SIMULATION_SPEEDS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={speed === option}
                  onClick={() => setSpeed(option as SimulationSpeed)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    speed === option ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {option}x
                </button>
              ))}
            </div>
            <Badge tone={status === 'running' ? 'success' : status === 'paused' ? 'warning' : 'neutral'}>
              {status === 'running' ? 'Running' : status === 'paused' ? 'Paused' : 'Stopped'}
            </Badge>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current signal</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              Group {snapshot.signal.activePhase.group} {snapshot.signal.activePhase.state.toLowerCase().replace('_', ' ')}
            </p>
            <p className="text-sm text-slate-600">
              {activeApproaches.map((approach) => approach.name).join(' and ') || 'No approaches assigned'}
              {' - '}
              {formatSeconds(snapshot.signal.elapsedSeconds)} of {snapshot.signal.greenTargetSeconds} s
            </p>
          </div>
          <div className="text-sm text-slate-600 sm:text-right">
            <p>Simulated time {formatSeconds(snapshot.simTime)}</p>
            <p>Mode: {controlMode === 'adaptive' ? 'Adaptive' : 'Fixed-time'}</p>
          </div>
        </div>
      </Panel>

      <SimulationAlerts
        approaches={snapshot.approaches}
        emergency={snapshot.emergency}
        offlineApproachNames={snapshot.approaches.filter((approach) => detectors[approach.id] === false).map((approach) => approach.name)}
      />

      <section aria-label="Approaches" className="grid gap-4 sm:grid-cols-2">
        {snapshot.approaches.map((approach) => (
          <ApproachCard
            key={approach.id}
            approach={approach}
            detectorOnline={detectors[approach.id] !== false}
            canControlDetector={canOperate}
            onToggleDetector={toggleDetector}
          />
        ))}
      </section>

      <Panel title="Results so far" description="Measured since the simulation started.">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Vehicles served</dt>
            <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatNumber(snapshot.metrics.vehiclesServed)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Average delay</dt>
            <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatSeconds(snapshot.metrics.averageDelaySeconds)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Throughput per hour</dt>
            <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatNumber(snapshot.metrics.throughputVehiclesPerHour)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Signal utilization</dt>
            <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatPercent(snapshot.metrics.signalUtilization)}</dd>
          </div>
        </dl>
        {canOperate && (
          <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {snapshot.simTime < MIN_SAVE_SECONDS
                ? `Run for at least ${MIN_SAVE_SECONDS} seconds before saving.`
                : allDetectorsOnline
                  ? 'Save this run to compare it later.'
                  : 'Turn all detectors back on before saving, so the saved result matches a normal run.'}
            </p>
            <Button onClick={() => void handleSave()} loading={saving} disabled={!canSave}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save run
            </Button>
          </div>
        )}
        {saveMessage && (
          <p
            role={saveMessage.tone === 'error' ? 'alert' : 'status'}
            className={`mt-3 text-sm ${saveMessage.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}
          >
            {saveMessage.text}
          </p>
        )}
      </Panel>

      <EmergencyPanel
        approaches={snapshot.approaches}
        emergency={snapshot.emergency}
        clearances={snapshot.metrics.emergencyClearances}
        canOperate={canOperate}
        onRequest={handleRequestEmergency}
        onCancel={sim.cancelEmergency}
      />
      {emergencyLogError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {emergencyLogError}
        </p>
      )}

      <Panel title="Decision log" description="Each signal change, with the reason the controller chose it.">
        <DecisionLogPanel decisions={snapshot.decisions} />
      </Panel>
    </div>
  );
}
