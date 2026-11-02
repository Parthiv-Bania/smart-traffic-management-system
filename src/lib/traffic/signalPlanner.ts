import type {
  ApproachConfig,
  DemandWeights,
  PhaseGroup,
  SignalPhase,
  SignalPhaseState,
  TimingConfig,
} from '@/lib/traffic/types';

export const DEFAULT_DEMAND_WEIGHTS: DemandWeights = { count: 0.3, queue: 0.4, wait: 0.3 };

export const APPROACHING_COUNT_CAP = 30;
export const QUEUE_CAP = 25;
export const WAIT_CAP_SECONDS = 120;

const NEXT_STATE: Record<SignalPhaseState, SignalPhaseState> = {
  GREEN: 'YELLOW',
  YELLOW: 'ALL_RED',
  ALL_RED: 'GREEN',
};

export function isValidSignalTransition(previous: SignalPhase, next: SignalPhase): boolean {
  if (next.state !== NEXT_STATE[previous.state]) return false;
  if (previous.state === 'ALL_RED') return next.group !== previous.group;
  return next.group === previous.group;
}

export function otherGroup(group: PhaseGroup): PhaseGroup {
  return group === 'A' ? 'B' : 'A';
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeWeights(weights: DemandWeights): DemandWeights {
  const total = weights.count + weights.queue + weights.wait;
  if (total <= 0) return DEFAULT_DEMAND_WEIGHTS;
  return {
    count: weights.count / total,
    queue: weights.queue / total,
    wait: weights.wait / total,
  };
}

export interface ApproachDemandInput {
  approachingCount: number;
  queue: number;
  waitSeconds: number;
}

export function computeApproachDemand(input: ApproachDemandInput, weights: DemandWeights): number {
  const countScore = clampNumber(input.approachingCount / APPROACHING_COUNT_CAP, 0, 1);
  const queueScore = clampNumber(input.queue / QUEUE_CAP, 0, 1);
  const waitScore = clampNumber(input.waitSeconds / WAIT_CAP_SECONDS, 0, 1);
  return weights.count * countScore + weights.queue * queueScore + weights.wait * waitScore;
}

export interface GreenPlan {
  greenSeconds: number;
  groupDemand: number | null;
  reason: string;
}

export function planAdaptiveGreen(
  members: ApproachConfig[],
  demandInputs: ApproachDemandInput[],
  timing: TimingConfig,
  weights: DemandWeights,
  group: PhaseGroup,
): GreenPlan {
  const perApproachDemand = demandInputs.map((input) => computeApproachDemand(input, weights));
  const groupDemand = perApproachDemand.reduce((sum, value) => sum + value, 0) / perApproachDemand.length;
  const greenSeconds = Math.round(
    timing.minGreenSeconds + (timing.maxGreenSeconds - timing.minGreenSeconds) * clampNumber(groupDemand, 0, 1),
  );
  const names = members.map((member) => member.name).join(' and ');
  return {
    greenSeconds,
    groupDemand,
    reason: `Adaptive: group ${group} (${names}) demand ${groupDemand.toFixed(2)}, green ${greenSeconds}s within ${timing.minGreenSeconds}-${timing.maxGreenSeconds}s`,
  };
}

export function planFixedGreen(timing: TimingConfig, group: PhaseGroup): GreenPlan {
  const greenSeconds = clampNumber(timing.fixedGreenSeconds, timing.minGreenSeconds, timing.maxGreenSeconds);
  return {
    greenSeconds,
    groupDemand: null,
    reason: `Fixed-time plan: group ${group} green ${greenSeconds}s`,
  };
}
