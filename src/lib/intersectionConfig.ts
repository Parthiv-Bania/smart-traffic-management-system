import type { ApproachRow, IntersectionRow } from '@/types/database';
import type { ControlMode, SimulationConfig } from '@/lib/traffic/types';

const APPROACH_ORDER = ['North', 'East', 'South', 'West'];

export interface SimulationOptions {
  controlMode: ControlMode;
  trafficIntensity: number;
  randomSeed: number;
}

export function seedFromText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildSimulationConfig(
  intersection: IntersectionRow,
  approaches: ApproachRow[],
  options: SimulationOptions,
): SimulationConfig {
  const ordered = [...approaches].sort(
    (a, b) => APPROACH_ORDER.indexOf(a.name) - APPROACH_ORDER.indexOf(b.name),
  );
  return {
    approaches: ordered.map((approach) => ({
      id: approach.id,
      name: approach.name,
      roadName: approach.road_name,
      lanes: approach.lanes,
      phaseGroup: approach.phase_group,
      saturationFlowVph: approach.saturation_flow_vph,
      baseArrivalRate: approach.base_arrival_rate,
    })),
    timing: {
      minGreenSeconds: intersection.min_green_seconds,
      maxGreenSeconds: intersection.max_green_seconds,
      yellowSeconds: intersection.yellow_seconds,
      allRedSeconds: intersection.all_red_seconds,
      fixedGreenSeconds: intersection.fixed_green_seconds,
    },
    controlMode: options.controlMode,
    trafficIntensity: options.trafficIntensity,
    randomSeed: options.randomSeed,
  };
}
