// Seedable PRNG — mulberry32.
//
// This is a well-known tiny 32-bit generator. Do NOT "clean up" the bit-twiddling
// (>>>, Math.imul, the magic 0x6d2b79f5) into something friendlier: those exact ops
// are what make the sequence deterministic. Determinism is what lets a given seed
// reproduce a whole playthrough and what lets tests reproduce a specific roll.
//
// Pure functional form: given the current 32-bit state, return the next value in
// [0, 1) AND the next state. Callers thread `next` forward; nothing mutates.

export interface RngStep {
  value: number; // float in [0, 1)
  next: number; // next rng state — feed this into the following call
}

export function mulberry32(state: number): RngStep {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next };
}

// Roll a d20 (1-20) from an rng state; returns the face and the advanced state.
export function rollD20(state: number): { die: number; next: number } {
  const { value, next } = mulberry32(state);
  return { die: Math.floor(value * 20) + 1, next };
}

// A fresh random 32-bit seed. Used for "fresh luck" on a new playthrough.
export function randomSeed(): number {
  return (Math.random() * 0x1_0000_0000) | 0;
}
