export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    const limit = Math.exp(-lambda);
    let count = 0;
    let product = 1;
    do {
      count += 1;
      product *= this.next();
    } while (product > limit);
    return count - 1;
  }
}
