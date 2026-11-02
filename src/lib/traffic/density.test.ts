import { describe, expect, it } from 'vitest';
import { classifyDensity, computeOccupancy, VEHICLES_PER_LANE_CAPACITY } from '@/lib/traffic/density';

describe('density classification', () => {
  it('measures occupancy against lane capacity', () => {
    expect(computeOccupancy(VEHICLES_PER_LANE_CAPACITY * 2, 2)).toBe(1);
    expect(computeOccupancy(0, 2)).toBe(0);
  });

  it('maps occupancy to the density bands at their thresholds', () => {
    expect(classifyDensity(0)).toBe('Low');
    expect(classifyDensity(0.25)).toBe('Moderate');
    expect(classifyDensity(0.5)).toBe('High');
    expect(classifyDensity(0.75)).toBe('Critical');
  });
});
