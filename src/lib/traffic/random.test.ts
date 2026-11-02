import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/lib/traffic/random';

describe('seeded random generator', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = new SeededRandom(7);
    const second = new SeededRandom(7);
    const firstValues = Array.from({ length: 20 }, () => first.next());
    const secondValues = Array.from({ length: 20 }, () => second.next());
    expect(secondValues).toEqual(firstValues);
  });

  it('produces values between 0 and 1', () => {
    const random = new SeededRandom(99);
    for (let index = 0; index < 1000; index += 1) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('returns zero arrivals for a zero rate', () => {
    expect(new SeededRandom(1).poisson(0)).toBe(0);
  });

  it('draws Poisson counts whose average is close to the rate', () => {
    const random = new SeededRandom(2024);
    const samples = 20000;
    let total = 0;
    for (let index = 0; index < samples; index += 1) total += random.poisson(3);
    expect(total / samples).toBeGreaterThan(2.9);
    expect(total / samples).toBeLessThan(3.1);
  });
});
