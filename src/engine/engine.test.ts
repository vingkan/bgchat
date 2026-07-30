import { describe, expect, it } from 'vitest';
import type { CheckChoice, SimpleChoice, StoryFile } from '../story/types';
import { sampleStory } from '../story/sample';
import { rollD20 } from './rng';
import { chooseSimple, createGame, resolveCheck, restart, rewind } from './engine';

// Find an rng state that rolls exactly `target` on the next d20, so crit/boundary
// tests can force a known die without hardcoding mulberry32 internals.
function seedForDie(target: number): number {
  for (let s = 1; s < 200000; s++) {
    if (rollD20(s).die === target) return s;
  }
  throw new Error(`no seed found for die ${target}`);
}

const check = (over: Partial<CheckChoice> = {}): CheckChoice => ({
  kind: 'check',
  label: 'Try it',
  skill: 'Persuasion',
  dc: 12,
  modifier: 0,
  onSuccess: 'persuaded',
  onFailure: 'suspicious',
  ...over,
});

describe('createGame', () => {
  it('starts at the entry node with only it visited', () => {
    const s = createGame(sampleStory, 1);
    expect(s.currentId).toBe('gate');
    expect(s.history).toEqual([]);
    expect(s.visited).toEqual(['gate']);
  });

  it('accepts an explicit seed', () => {
    expect(createGame(sampleStory, 777).rngState).toBe(777);
  });
});

describe('chooseSimple', () => {
  const choice: SimpleChoice = { kind: 'simple', label: 'go', next: 'truth' };

  it('moves to the target node', () => {
    const s = chooseSimple(createGame(sampleStory, 1), choice);
    expect(s.currentId).toBe('truth');
  });

  it('appends a history entry recording rngBefore', () => {
    const g = createGame(sampleStory, 55);
    const s = chooseSimple(g, choice);
    expect(s.history).toHaveLength(1);
    expect(s.history[0]).toMatchObject({ nodeId: 'gate', choice, roll: null, rngBefore: 55 });
  });

  it('adds the target to visited without duplicates', () => {
    let s = chooseSimple(createGame(sampleStory, 1), choice);
    s = chooseSimple(s, choice); // choose the same target again
    expect(s.visited.filter((v) => v === 'truth')).toHaveLength(1);
  });

  it('does not advance the rng (no roll happened)', () => {
    const g = createGame(sampleStory, 1234);
    expect(chooseSimple(g, choice).rngState).toBe(1234);
  });
});

describe('resolveCheck', () => {
  it('succeeds when total >= dc and routes to onSuccess', () => {
    const g = { ...createGame(sampleStory), rngState: seedForDie(15) };
    const { state, roll } = resolveCheck(g, check({ dc: 10, modifier: 0 }));
    expect(roll.success).toBe(true);
    expect(roll.crit).toBeNull();
    expect(state.currentId).toBe('persuaded');
  });

  it('fails when total < dc and routes to onFailure', () => {
    const g = { ...createGame(sampleStory), rngState: seedForDie(5) };
    const { state, roll } = resolveCheck(g, check({ dc: 10, modifier: 0 }));
    expect(roll.success).toBe(false);
    expect(state.currentId).toBe('suspicious');
  });

  it('BOUNDARY: total exactly equal to dc is a success', () => {
    const g = { ...createGame(sampleStory), rngState: seedForDie(10) };
    const { roll } = resolveCheck(g, check({ dc: 12, modifier: 2 }));
    expect(roll.total).toBe(12);
    expect(roll.success).toBe(true);
  });

  it('CRIT: natural 20 succeeds even when total < dc', () => {
    const g = { ...createGame(sampleStory), rngState: seedForDie(20) };
    const { roll } = resolveCheck(g, check({ dc: 99, modifier: 0 }));
    expect(roll.die).toBe(20);
    expect(roll.success).toBe(true);
    expect(roll.crit).toBe('success');
  });

  it('CRIT: natural 1 fails even when total >= dc', () => {
    const g = { ...createGame(sampleStory), rngState: seedForDie(1) };
    const { roll } = resolveCheck(g, check({ dc: 5, modifier: 30 }));
    expect(roll.die).toBe(1);
    expect(roll.success).toBe(false);
    expect(roll.crit).toBe('failure');
  });

  it('defaults an undefined modifier to 0', () => {
    const g = { ...createGame(sampleStory), rngState: seedForDie(10) };
    const noMod: CheckChoice = {
      kind: 'check',
      label: 'x',
      skill: 'Skill',
      dc: 12,
      onSuccess: 'persuaded',
      onFailure: 'suspicious',
    };
    const { roll } = resolveCheck(g, noMod);
    expect(roll.modifier).toBe(0);
    expect(roll.total).toBe(10);
  });

  it('advances the rng state EXACTLY once', () => {
    const g = { ...createGame(sampleStory), rngState: 4242 };
    const { state } = resolveCheck(g, check());
    expect(state.rngState).toBe(rollD20(4242).next);
    expect(state.history).toHaveLength(1);
  });
});

describe('rewind', () => {
  it('steps back one and restores currentId', () => {
    let s = createGame(sampleStory, 1);
    s = chooseSimple(s, { kind: 'simple', label: 'go', next: 'truth' });
    const back = rewind(s, 1);
    expect(back.currentId).toBe('gate');
    expect(back.history).toHaveLength(0);
  });

  it('keeps visited monotonic (does NOT shrink on rewind)', () => {
    let s = createGame(sampleStory, 1);
    s = chooseSimple(s, { kind: 'simple', label: 'go', next: 'truth' });
    expect(rewind(s, 1).visited).toContain('truth');
  });

  it('CRITICAL: rewinding past a check and re-forwarding reproduces the same die', () => {
    const g = { ...createGame(sampleStory), rngState: 987654 };
    const first = resolveCheck(g, check());
    const back = rewind(first.state, 1);
    expect(back.rngState).toBe(987654);
    const again = resolveCheck(back, check());
    expect(again.roll.die).toBe(first.roll.die);
    expect(again.roll.success).toBe(first.roll.success);
  });

  it('is a no-op at the start of history', () => {
    const g = createGame(sampleStory, 1);
    expect(rewind(g, 1)).toBe(g);
  });

  it('clamps when steps exceeds history length', () => {
    let s = createGame(sampleStory, 1);
    s = chooseSimple(s, { kind: 'simple', label: 'go', next: 'truth' });
    const back = rewind(s, 99);
    expect(back.currentId).toBe('gate');
    expect(back.history).toHaveLength(0);
  });
});

describe('restart', () => {
  it('returns to start, clears history, and KEEPS visited', () => {
    let s = createGame(sampleStory, 1);
    s = chooseSimple(s, { kind: 'simple', label: 'go', next: 'truth' });
    s = chooseSimple(s, { kind: 'simple', label: 'go', next: 'enter' });
    const r = restart(sampleStory, s, 2);
    expect(r.currentId).toBe('gate');
    expect(r.history).toEqual([]);
    expect(r.visited).toEqual(expect.arrayContaining(['gate', 'truth', 'enter']));
  });

  it('reseeds for fresh luck (new seed applied)', () => {
    const s = createGame(sampleStory, 1);
    expect(restart(sampleStory, s, 9999).rngState).toBe(9999);
  });
});

// A whole-playthrough sanity pass over the real sample story.
describe('sample story integration', () => {
  it('reaches an ending via a simple path', () => {
    const file: StoryFile = sampleStory;
    let s = createGame(file, 1);
    s = chooseSimple(s, file.nodes.gate.choices[0] as SimpleChoice); // -> truth
    s = chooseSimple(s, file.nodes.truth.choices[0] as SimpleChoice); // -> enter
    expect(s.currentId).toBe('enter');
    expect(file.nodes.enter.choices).toHaveLength(0); // terminal
  });
});
