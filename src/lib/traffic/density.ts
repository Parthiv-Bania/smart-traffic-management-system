import type { DensityLevel } from '@/lib/traffic/types';

export const VEHICLES_PER_LANE_CAPACITY = 8;

export interface DensityThresholds {
  moderate: number;
  high: number;
  critical: number;
}

export const DEFAULT_DENSITY_THRESHOLDS: DensityThresholds = {
  moderate: 0.25,
  high: 0.5,
  critical: 0.75,
};

export function computeOccupancy(queue: number, lanes: number): number {
  return queue / (lanes * VEHICLES_PER_LANE_CAPACITY);
}

export function classifyDensity(
  occupancy: number,
  thresholds: DensityThresholds = DEFAULT_DENSITY_THRESHOLDS,
): DensityLevel {
  if (occupancy >= thresholds.critical) return 'Critical';
  if (occupancy >= thresholds.high) return 'High';
  if (occupancy >= thresholds.moderate) return 'Moderate';
  return 'Low';
}
