import { describe, expect, it } from 'vitest';
import { IntersectionSimulation, jainFairnessIndex, runSimulationForComparison } from '@/lib/traffic/intersectionSimulation';
import type { ApproachConfig, ControlMode, SimulationConfig } from '@/lib/traffic/types';

const APPROACHES: ApproachConfig[] = [
  { id: 'n', name: 'North', roadName: 'N Road', lanes: 2, phaseGroup: 'A', saturationFlowVph: 1800, baseArrivalRate: 25 },
  { id: 's', name: 'South', roadName: 'S Road', lanes: 2, phaseGroup: 'A', saturationFlowVph: 1800, baseArrivalRate: 25 },
  { id: 'e', name: 'East', roadName: 'E Road', lanes: 2, phaseGroup: 'B', saturationFlowVph: 1800, baseArrivalRate: 20 },
  { id: 'w', name: 'West', roadName: 'W Road', lanes: 2, phaseGroup: 'B', saturationFlowVph: 1800, baseArrivalRate: 20 },
];

function makeConfig(controlMode: ControlMode, overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    approaches: APPROACHES,
    timing: { minGreenSeconds: 10, maxGreenSeconds: 60, yellowSeconds: 3, allRedSeconds: 2, fixedGreenSeconds: 25 },
    controlMode,
    trafficIntensity: 1,
    randomSeed: 42,
    ...overrides,
  };
}

describe('intersection simulation', () => {
  it('produces identical metrics for the same seed and configuration', () => {
    const first = runSimulationForComparison(makeConfig('adaptive'), 600);
    const second = runSimulationForComparison(makeConfig('adaptive'), 600);
    expect(second).toEqual(first);
  });

  it('keeps metrics internally consistent', () => {
    const metrics = runSimulationForComparison(makeConfig('fixed'), 900);
    expect(metrics.vehiclesServed).toBeLessThanOrEqual(metrics.vehiclesDetected);
    expect(metrics.signalUtilization).toBeGreaterThanOrEqual(0);
    expect(metrics.signalUtilization).toBeLessThanOrEqual(1);
    expect(metrics.fairnessIndex).toBeGreaterThanOrEqual(0);
    expect(metrics.fairnessIndex).toBeLessThanOrEqual(1);
  });

  it('never leaves green without yellow and all-red in between', () => {
    const simulation = new IntersectionSimulation(makeConfig('adaptive'));
    simulation.advance(1200);
    const decisions = simulation.snapshot().decisions;
    for (const [index, entry] of decisions.entries()) {
      if (entry.newPhase.state === 'GREEN' && index > 0) {
        const previous = decisions[index - 1].newPhase;
        expect(previous.state).toBe('ALL_RED');
      }
    }
  });

  it('serves an emergency approach in the next green and counts the clearance', () => {
    const simulation = new IntersectionSimulation(makeConfig('fixed'));
    expect(simulation.requestEmergencyPriority('e')).toBe(true);
    simulation.advance(200);
    const snapshot = simulation.snapshot();
    const emergencyGreen = snapshot.decisions.find(
      (entry) => entry.newPhase.group === 'B' && entry.newPhase.state === 'GREEN' && entry.reason.includes('Emergency priority green for East'),
    );
    expect(emergencyGreen).toBeDefined();
    expect(snapshot.metrics.emergencyClearances).toBe(1);
    expect(snapshot.emergency).toBeNull();
  });

  it('gives the emergency green no more than 12 seconds', () => {
    const simulation = new IntersectionSimulation(makeConfig('fixed'));
    simulation.requestEmergencyPriority('e');
    simulation.advance(200);
    const emergencyGreen = simulation
      .snapshot()
      .decisions.find((entry) => entry.reason.includes('Emergency priority green for East'));
    expect(emergencyGreen?.greenSeconds).toBe(12);
  });

  it('cancels a pending emergency request before it takes effect', () => {
    const simulation = new IntersectionSimulation(makeConfig('fixed'));
    simulation.requestEmergencyPriority('e');
    simulation.cancelEmergencyPriority();
    simulation.advance(200);
    expect(simulation.snapshot().metrics.emergencyClearances).toBe(0);
  });

  it('rejects an emergency request for an unknown approach', () => {
    const simulation = new IntersectionSimulation(makeConfig('fixed'));
    expect(simulation.requestEmergencyPriority('unknown')).toBe(false);
  });

  it('falls back to fixed timing with a logged reason when a detector is offline', () => {
    const simulation = new IntersectionSimulation(makeConfig('adaptive'));
    simulation.setDetectorOnline('n', false);
    simulation.advance(200);
    const fallback = simulation
      .snapshot()
      .decisions.find((entry) => entry.reason === 'Fallback to fixed timing: detector offline on North');
    expect(fallback).toBeDefined();
    expect(fallback?.greenSeconds).toBe(25);
  });

  it('rejects a maximum green shorter than the minimum green', () => {
    const invalid = makeConfig('fixed', {
      timing: { minGreenSeconds: 30, maxGreenSeconds: 10, yellowSeconds: 3, allRedSeconds: 2, fixedGreenSeconds: 20 },
    });
    expect(() => new IntersectionSimulation(invalid)).toThrow('Maximum green must be at least the minimum green');
  });
});

describe('fairness index', () => {
  it('is 1 when every approach is served equally', () => {
    expect(jainFairnessIndex([0.5, 0.5, 0.5])).toBeCloseTo(1);
  });

  it('falls to 1/n when one approach gets all the service', () => {
    expect(jainFairnessIndex([1, 0, 0, 0])).toBeCloseTo(0.25);
  });

  it('is 1 for an empty set', () => {
    expect(jainFairnessIndex([])).toBe(1);
  });
});
