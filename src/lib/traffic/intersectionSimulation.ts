import { classifyDensity, computeOccupancy } from '@/lib/traffic/density';
import { SeededRandom } from '@/lib/traffic/random';
import {
  DEFAULT_DEMAND_WEIGHTS,
  clampNumber,
  isValidSignalTransition,
  normalizeWeights,
  otherGroup,
  planAdaptiveGreen,
  planFixedGreen,
  type GreenPlan,
} from '@/lib/traffic/signalPlanner';
import {
  type ApproachConfig,
  type ApproachSignal,
  type ApproachSnapshot,
  type DecisionLogEntry,
  type DemandWeights,
  type EmergencyPriorityStatus,
  type EmergencyRequest,
  type PhaseGroup,
  type SignalPhase,
  type SimulationConfig,
  type SimulationMetrics,
  type SimulationSnapshot,
  type TimelinePoint,
} from '@/lib/traffic/types';

const APPROACHING_WINDOW_SECONDS = 30;
const CONGESTION_QUEUE_THRESHOLD = 12;
const DECISION_LOG_LIMIT = 200;
const EMERGENCY_CLEARANCE_SECONDS = 12;

interface ApproachRuntime {
  config: ApproachConfig;
  rng: SeededRandom;
  queue: number;
  dischargeCredit: number;
  arrivalTimes: number[];
  secondsSinceGreen: number;
  detectorOnline: boolean;
  arrivalsTotal: number;
  servedTotal: number;
  queueSecondsTotal: number;
}

interface SignalRuntime {
  activePhase: SignalPhase;
  elapsed: number;
  greenTarget: number;
}

function validateConfig(config: SimulationConfig): void {
  const { timing, approaches } = config;
  if (approaches.length === 0) throw new Error('At least one approach is required');
  if (timing.maxGreenSeconds < timing.minGreenSeconds) {
    throw new Error('Maximum green must be at least the minimum green');
  }
  if (config.trafficIntensity <= 0) throw new Error('Traffic intensity must be positive');
}

export class IntersectionSimulation {
  private readonly config: SimulationConfig;
  private readonly weights: DemandWeights;
  private readonly approaches: ApproachRuntime[];
  private readonly signal: SignalRuntime;
  private readonly decisions: DecisionLogEntry[] = [];
  private simTime = 0;
  private decisionSequence = 0;
  private greenSeconds = 0;
  private dischargingGreenSeconds = 0;
  private congestionSeconds = 0;
  private arrivalsInMinute = 0;
  private servedInMinute = 0;
  private readonly timeline: TimelinePoint[] = [];
  private emergency: EmergencyRequest | null = null;
  private emergencyClearances = 0;

  constructor(config: SimulationConfig) {
    validateConfig(config);
    this.config = config;
    this.weights = normalizeWeights(config.weights ?? DEFAULT_DEMAND_WEIGHTS);
    this.approaches = config.approaches.map((approach, index) => ({
      config: approach,
      rng: new SeededRandom(config.randomSeed + (index + 1) * 7919),
      queue: 0,
      dischargeCredit: 0,
      arrivalTimes: [],
      secondsSinceGreen: 0,
      detectorOnline: true,
      arrivalsTotal: 0,
      servedTotal: 0,
      queueSecondsTotal: 0,
    }));
    this.signal = {
      activePhase: { group: 'B', state: 'ALL_RED' },
      elapsed: 0,
      greenTarget: 0,
    };
    this.startGreen('A', null);
  }

  setDetectorOnline(approachId: string, online: boolean): void {
    const approach = this.approaches.find((item) => item.config.id === approachId);
    if (approach) approach.detectorOnline = online;
  }

  advance(seconds: number): void {
    for (let step = 0; step < seconds; step += 1) this.tick();
  }

  snapshot(): SimulationSnapshot {
    return {
      simTime: this.simTime,
      controlMode: this.config.controlMode,
      signal: {
        activePhase: { ...this.signal.activePhase },
        elapsedSeconds: this.signal.elapsed,
        greenTargetSeconds: this.signal.greenTarget,
      },
      approaches: this.approaches.map((approach) => this.approachSnapshot(approach)),
      decisions: [...this.decisions],
      timeline: [...this.timeline],
      metrics: this.metrics(),
      emergency: this.emergencyStatus(),
    };
  }

  private tick(): void {
    this.simTime += 1;
    const activeGroup = this.signal.activePhase.group;
    const isGreen = this.signal.activePhase.state === 'GREEN';
    let dischargedThisSecond = 0;

    for (const approach of this.approaches) {
      this.arrivalsInMinute += this.addArrivals(approach);
      const isServing = isGreen && approach.config.phaseGroup === activeGroup;
      if (isServing) {
        dischargedThisSecond += this.discharge(approach);
        approach.secondsSinceGreen = 0;
      } else {
        approach.dischargeCredit = 0;
        approach.secondsSinceGreen += 1;
      }
      approach.queueSecondsTotal += approach.queue;
    }

    const totalQueue = this.approaches.reduce((sum, approach) => sum + approach.queue, 0);
    if (totalQueue >= CONGESTION_QUEUE_THRESHOLD) this.congestionSeconds += 1;
    if (isGreen) {
      this.greenSeconds += 1;
      if (dischargedThisSecond > 0) this.dischargingGreenSeconds += 1;
    }
    this.servedInMinute += dischargedThisSecond;
    if (this.simTime % 60 === 0) this.recordTimelinePoint(totalQueue);

    this.signal.elapsed += 1;
    this.advanceSignal();
  }

  private recordTimelinePoint(totalQueue: number): void {
    const occupancy = this.approaches.reduce(
      (sum, approach) => sum + computeOccupancy(approach.queue, approach.config.lanes),
      0,
    ) / this.approaches.length;
    this.timeline.push({
      minute: this.simTime / 60,
      arrivals: this.arrivalsInMinute,
      served: this.servedInMinute,
      queue: totalQueue,
      averageOccupancy: occupancy,
    });
    this.arrivalsInMinute = 0;
    this.servedInMinute = 0;
  }

  private addArrivals(approach: ApproachRuntime): number {
    const lambdaPerSecond = (approach.config.baseArrivalRate / 60) * this.config.trafficIntensity;
    const arrivals = approach.rng.poisson(lambdaPerSecond);
    for (let index = 0; index < arrivals; index += 1) {
      approach.queue += 1;
      approach.arrivalsTotal += 1;
      approach.arrivalTimes.push(this.simTime);
    }
    const windowStart = this.simTime - APPROACHING_WINDOW_SECONDS;
    approach.arrivalTimes = approach.arrivalTimes.filter((time) => time > windowStart);
    return arrivals;
  }

  private discharge(approach: ApproachRuntime): number {
    if (approach.queue === 0) {
      approach.dischargeCredit = 0;
      return 0;
    }
    approach.dischargeCredit += (approach.config.lanes * approach.config.saturationFlowVph) / 3600;
    let served = 0;
    while (approach.dischargeCredit >= 1 && approach.queue > 0) {
      approach.queue -= 1;
      approach.servedTotal += 1;
      approach.dischargeCredit -= 1;
      served += 1;
    }
    if (approach.queue === 0) approach.dischargeCredit = 0;
    return served;
  }

  private advanceSignal(): void {
    const { timing, controlMode } = this.config;
    const { activePhase, elapsed, greenTarget } = this.signal;

    if (activePhase.state === 'GREEN') {
      const priority = this.emergency;
      if (priority) {
        if (activePhase.group !== priority.phaseGroup) {
          this.setPhase({ group: activePhase.group, state: 'YELLOW' }, `Emergency priority for ${priority.approachName}: ending current green`);
          return;
        }
        if (elapsed >= this.emergencyGreenSeconds()) {
          this.emergency = null;
          this.emergencyClearances += 1;
          this.setPhase({ group: activePhase.group, state: 'YELLOW' }, `Emergency vehicle on ${priority.approachName} cleared, returning to normal control`);
        }
        return;
      }
      const groupQueue = this.groupQueue(activePhase.group);
      let reason: string | null = null;
      if (elapsed >= timing.maxGreenSeconds) {
        reason = `Maximum green of ${timing.maxGreenSeconds}s reached`;
      } else if (elapsed >= greenTarget) {
        reason = controlMode === 'adaptive' ? 'Allocated green time used' : 'Fixed green time used';
      } else if (controlMode === 'adaptive' && elapsed >= timing.minGreenSeconds && groupQueue === 0) {
        reason = 'Queue cleared early (gap-out)';
      }
      if (reason) this.setPhase({ group: activePhase.group, state: 'YELLOW' }, reason);
      return;
    }

    if (activePhase.state === 'YELLOW') {
      if (elapsed >= timing.yellowSeconds) {
        this.setPhase({ group: activePhase.group, state: 'ALL_RED' }, 'Yellow clearance complete');
      }
      return;
    }

    if (elapsed >= timing.allRedSeconds) {
      const nextGroup = otherGroup(activePhase.group);
      this.startGreen(nextGroup, activePhase);
    }
  }

  requestEmergencyPriority(approachId: string): boolean {
    const approach = this.approaches.find((item) => item.config.id === approachId);
    if (!approach) return false;
    this.emergency = { approachId, approachName: approach.config.name, phaseGroup: approach.config.phaseGroup };
    return true;
  }

  cancelEmergencyPriority(): void {
    this.emergency = null;
  }

  private emergencyGreenSeconds(): number {
    return Math.min(EMERGENCY_CLEARANCE_SECONDS, this.config.timing.maxGreenSeconds);
  }

  private emergencyStatus(): EmergencyPriorityStatus | null {
    const priority = this.emergency;
    if (!priority) return null;
    const { activePhase } = this.signal;
    const serving = activePhase.group === priority.phaseGroup && activePhase.state === 'GREEN';
    return { ...priority, stage: serving ? 'serving' : 'waiting' };
  }

  private startGreen(group: PhaseGroup, previousPhase: SignalPhase | null): void {
    const priority = this.emergency;
    const plan: GreenPlan =
      priority && priority.phaseGroup === group
        ? {
            greenSeconds: this.emergencyGreenSeconds(),
            groupDemand: null,
            reason: `Emergency priority green for ${priority.approachName}`,
          }
        : this.planGreen(group);
    this.signal.greenTarget = plan.greenSeconds;
    this.setPhase({ group, state: 'GREEN' }, plan.reason, previousPhase, plan);
  }

  private setPhase(
    next: SignalPhase,
    reason: string,
    previousOverride?: SignalPhase | null,
    plan?: GreenPlan,
  ): void {
    const previous = previousOverride === undefined ? { ...this.signal.activePhase } : previousOverride;
    if (previous && !isValidSignalTransition(previous, next)) {
      throw new Error(`Invalid signal transition ${previous.group}:${previous.state} -> ${next.group}:${next.state}`);
    }
    this.decisionSequence += 1;
    const observations = this.observe(next.group);
    this.decisions.push({
      sequence: this.decisionSequence,
      simTime: this.simTime,
      previousPhase: previous,
      newPhase: { ...next },
      observations,
      greenSeconds: next.state === 'GREEN' ? (plan?.greenSeconds ?? this.signal.greenTarget) : 0,
      controlMode: this.config.controlMode,
      reason,
    });
    if (this.decisions.length > DECISION_LOG_LIMIT) this.decisions.shift();
    this.signal.activePhase = next;
    this.signal.elapsed = 0;
  }

  private planGreen(group: PhaseGroup): GreenPlan {
    const { timing, controlMode } = this.config;
    if (controlMode === 'fixed') return planFixedGreen(timing, group);

    const members = this.approaches.filter((approach) => approach.config.phaseGroup === group);
    const offline = members.filter((approach) => !approach.detectorOnline);
    if (offline.length > 0) {
      const fallback = planFixedGreen(timing, group);
      const names = offline.map((approach) => approach.config.name).join(', ');
      return { ...fallback, reason: `Fallback to fixed timing: detector offline on ${names}` };
    }

    const inputs = members.map((approach) => ({
      approachingCount: this.approachingCount(approach),
      queue: approach.queue,
      waitSeconds: approach.secondsSinceGreen,
    }));
    return planAdaptiveGreen(
      members.map((approach) => approach.config),
      inputs,
      timing,
      this.weights,
      group,
    );
  }

  private observe(group: PhaseGroup) {
    return this.approaches
      .filter((approach) => approach.config.phaseGroup === group)
      .map((approach) => ({
        approach: approach.config.name,
        queue: approach.queue,
        approachingCount: this.approachingCount(approach),
        waitSeconds: approach.secondsSinceGreen,
      }));
  }

  private groupQueue(group: PhaseGroup): number {
    return this.approaches
      .filter((approach) => approach.config.phaseGroup === group)
      .reduce((sum, approach) => sum + approach.queue, 0);
  }

  private approachingCount(approach: ApproachRuntime): number {
    return approach.arrivalTimes.length;
  }

  private approachSignal(approach: ApproachRuntime): ApproachSignal {
    const { activePhase } = this.signal;
    if (approach.config.phaseGroup !== activePhase.group) return 'RED';
    if (activePhase.state === 'GREEN') return 'GREEN';
    if (activePhase.state === 'YELLOW') return 'YELLOW';
    return 'RED';
  }

  private approachSnapshot(approach: ApproachRuntime): ApproachSnapshot {
    const occupancy = computeOccupancy(approach.queue, approach.config.lanes);
    return {
      id: approach.config.id,
      name: approach.config.name,
      roadName: approach.config.roadName,
      lanes: approach.config.lanes,
      phaseGroup: approach.config.phaseGroup,
      queue: approach.queue,
      approachingCount: this.approachingCount(approach),
      waitSeconds: approach.secondsSinceGreen,
      occupancy,
      density: classifyDensity(occupancy),
      signal: this.approachSignal(approach),
      arrivalsTotal: approach.arrivalsTotal,
      servedTotal: approach.servedTotal,
    };
  }

  private metrics(): SimulationMetrics {
    const approaches = this.approaches;
    const vehiclesDetected = approaches.reduce((sum, item) => sum + item.arrivalsTotal, 0);
    const vehiclesServed = approaches.reduce((sum, item) => sum + item.servedTotal, 0);
    const queueSeconds = approaches.reduce((sum, item) => sum + item.queueSecondsTotal, 0);
    const hours = this.simTime / 3600;
    return {
      emergencyClearances: this.emergencyClearances,
      vehiclesDetected,
      vehiclesServed,
      currentQueue: approaches.reduce((sum, item) => sum + item.queue, 0),
      averageDelaySeconds: vehiclesDetected > 0 ? queueSeconds / vehiclesDetected : 0,
      averageQueueLength: this.simTime > 0 ? queueSeconds / (this.simTime * approaches.length) : 0,
      throughputVehiclesPerHour: hours > 0 ? vehiclesServed / hours : 0,
      congestionSeconds: this.congestionSeconds,
      signalUtilization: this.greenSeconds > 0 ? this.dischargingGreenSeconds / this.greenSeconds : 0,
      fairnessIndex: jainFairnessIndex(
        approaches
          .filter((item) => item.arrivalsTotal > 0)
          .map((item) => item.servedTotal / item.arrivalsTotal),
      ),
    };
  }
}

export function jainFairnessIndex(values: number[]): number {
  if (values.length === 0) return 1;
  const sum = values.reduce((total, value) => total + value, 0);
  const squares = values.reduce((total, value) => total + value * value, 0);
  if (squares === 0) return 1;
  return clampNumber((sum * sum) / (values.length * squares), 0, 1);
}

export function runSimulationForComparison(
  config: SimulationConfig,
  durationSeconds: number,
): SimulationMetrics {
  const simulation = new IntersectionSimulation(config);
  simulation.advance(durationSeconds);
  return simulation.snapshot().metrics;
}
