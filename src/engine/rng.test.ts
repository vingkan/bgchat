import { describe, expect, it } from 'vitest';
import { mulberry32, rollD20 } from './rng';

describe('mulberry32', () => {
  it('is deterministic: same state -> same value and next', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    expect(a).toEqual(b);
  });

  it('returns a value in [0, 1)', () => {
    for (let s = 0; s < 500; s++) {
      const { value } = mulberry32(s * 7919);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('produces a reproducible sequence when threading next', () => {
    const seq = (seed: number, n: number) => {
      let s = seed;
      const out: number[] = [];
      for (let i = 0; i < n; i++) {
        const step = mulberry32(s);
        out.push(step.value);
        s = step.next;
      }
      return out;
    };
    expect(seq(42, 10)).toEqual(seq(42, 10));
  });
});

describe('rollD20', () => {
  it('always returns a face in 1..20', () => {
    for (let s = 0; s < 2000; s++) {
      const { die } = rollD20(s * 104729 + 1);
      expect(die).toBeGreaterThanOrEqual(1);
      expect(die).toBeLessThanOrEqual(20);
    }
  });

  it('advances the state deterministically', () => {
    const a = rollD20(999);
    const b = rollD20(999);
    expect(a.die).toBe(b.die);
    expect(a.next).toBe(b.next);
  });
});
