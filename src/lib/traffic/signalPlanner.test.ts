import { describe, expect, it } from 'vitest';
import {
  APPROACHING_COUNT_CAP,
  DEFAULT_DEMAND_WEIGHTS,
  QUEUE_CAP,
  WAIT_CAP_SECONDS,
  computeApproachDemand,
  isValidSignalTransition,
  normalizeWeights,
  planAdaptiveGreen,
  planFixedGreen,
} from '@/lib/traffic/signalPlanner';
import type { ApproachConfig, TimingConfig } from '@/lib/traffic/types';

const TIMING: TimingConfig = { minGreenSeconds: 10, maxGreenSeconds: 60, yellowSeconds: 3, allRedSeconds: 2, fixedGreenSeconds: 25 };

const MEMBER: ApproachConfig = {
  id: 'n',
  name: 'North',
  roadName: 'N Road',
  lanes: 2,
  phaseGroup: 'A',
  saturationFlowVph: 1800,
  baseArrivalRate: 20,
};

describe('signal transitions', () => {
  it('allows green to yellow to all-red within the same group', () => {
    expect(isValidSignalTransition({ group: 'A', state: 'GREEN' }, { group: 'A', state: 'YELLOW' })).toBe(true);
    expect(isValidSignalTransition({ group: 'A', state: 'YELLOW' }, { group: 'A', state: 'ALL_RED' })).toBe(true);
  });

  it('allows all-red to hand over to the other group only', () => {
    expect(isValidSignalTransition({ group: 'A', state: 'ALL_RED' }, { group: 'B', state: 'GREEN' })).toBe(true);
    expect(isValidSignalTransition({ group: 'A', state: 'ALL_RED' }, { group: 'A', state: 'GREEN' })).toBe(false);
  });

  it('rejects skipping yellow or all-red', () => {
    expect(isValidSignalTransition({ group: 'A', state: 'GREEN' }, { group: 'A', state: 'ALL_RED' })).toBe(false);
    expect(isValidSignalTransition({ group: 'A', state: 'GREEN' }, { group: 'B', state: 'GREEN' })).toBe(false);
  });
});

describe('demand scoring', () => {
  it('reaches full demand when every input is at its cap', () => {
    const demand = computeApproachDemand(
      { approachingCount: APPROACHING_COUNT_CAP, queue: QUEUE_CAP, waitSeconds: WAIT_CAP_SECONDS },
      DEFAULT_DEMAND_WEIGHTS,
    );
    expect(demand).toBeCloseTo(1);
  });

  it('is zero with no vehicles and no waiting', () => {
    expect(computeApproachDemand({ approachingCount: 0, queue: 0, waitSeconds: 0 }, DEFAULT_DEMAND_WEIGHTS)).toBe(0);
  });

  it('clamps inputs above their caps', () => {
    const demand = computeApproachDemand({ approachingCount: 500, queue: 500, waitSeconds: 500 }, DEFAULT_DEMAND_WEIGHTS);
    expect(demand).toBeCloseTo(1);
  });

  it('normalizes weights that do not add up to one', () => {
    const normalized = normalizeWeights({ count: 3, queue: 4, wait: 3 });
    expect(normalized.count + normalized.queue + normalized.wait).toBeCloseTo(1);
    expect(normalized.queue).toBeCloseTo(0.4);
  });

  it('falls back to default weights when all weights are zero', () => {
    expect(normalizeWeights({ count: 0, queue: 0, wait: 0 })).toEqual(DEFAULT_DEMAND_WEIGHTS);
  });
});

describe('green time planning', () => {
  it('clamps the fixed green into the min and max range', () => {
    expect(planFixedGreen({ ...TIMING, fixedGreenSeconds: 90 }, 'A').greenSeconds).toBe(60);
    expect(planFixedGreen({ ...TIMING, fixedGreenSeconds: 2 }, 'A').greenSeconds).toBe(10);
    expect(planFixedGreen(TIMING, 'A').greenSeconds).toBe(25);
  });

  it('gives minimum green when demand is zero and maximum when demand is full', () => {
    const idle = planAdaptiveGreen([MEMBER], [{ approachingCount: 0, queue: 0, waitSeconds: 0 }], TIMING, DEFAULT_DEMAND_WEIGHTS, 'A');
    const busy = planAdaptiveGreen(
      [MEMBER],
      [{ approachingCount: 30, queue: 25, waitSeconds: 120 }],
      TIMING,
      DEFAULT_DEMAND_WEIGHTS,
      'A',
    );
    expect(idle.greenSeconds).toBe(10);
    expect(busy.greenSeconds).toBe(60);
  });

  it('explains the adaptive choice in the reason', () => {
    const plan = planAdaptiveGreen([MEMBER], [{ approachingCount: 0, queue: 0, waitSeconds: 0 }], TIMING, DEFAULT_DEMAND_WEIGHTS, 'A');
    expect(plan.reason).toContain('group A (North)');
  });
});
