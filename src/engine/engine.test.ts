import { describe, expect, it } from 'vitest';
import type { CheckChoice, SimpleChoice, StoryFile } from '../story/types';
import { sampleStory } from '../story/sample';
import { rollD20 } from './rng';
import { chooseSimple, chosenKey, createGame, resolveCheck, restart, rewind } from './engine';

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
  it('starts at the entry node with only it visited and nothing chosen', () => {
    const s = createGame(sampleStory, 1);
    expect(s.currentId).toBe('gate');
    expect(s.history).toEqual([]);
    expect(s.visited).toEqual(['gate']);
    expect(s.chosen).toEqual([]);
  });

  it('accepts an explicit seed', () => {
    expect(createGame(sampleStory, 777).rngState).toBe(777);
  });
});

describe('chooseSimple', () => {
  const choice: SimpleChoice = { kind: 'simple', label: 'go', next: 'truth' };

  it('moves to the target node', () => {
    const s = chooseSimple(createGame(sampleStory, 1), choice, 0);
    expect(s.currentId).toBe('truth');
  });

  it('appends a history entry for the step', () => {
    const g = createGame(sampleStory, 55);
    const s = chooseSimple(g, choice, 0);
    expect(s.history).toHaveLength(1);
    expect(s.history[0]).toMatchObject({ nodeId: 'gate', choice, roll: null });
  });

  it('records the taken option under its node+index key', () => {
    const s = chooseSimple(createGame(sampleStory, 1), choice, 2);
    expect(s.chosen).toEqual([chosenKey('gate', 2)]);
  });

  it('adds the target to visited without duplicates', () => {
    let s = chooseSimple(createGame(sampleStory, 1), choice, 0);
    s = chooseSimple(s, choice, 0); // choose the same target again
    expect(s.visited.filter((v) => v === 'truth')).toHaveLength(1);
  });

  it('dedupes the chosen key when the same option is taken twice from the same node', () => {
    const g = createGame(sampleStory, 1);
    const once = chooseSimple(g, choice, 0);
    // Simulate re-taking the same option from `gate` (e.g. after a Back): same key, no dupe.
    const twice = chooseSimple({ ...once, currentId: 'gate' }, choice, 0);
    expect(twice.chosen).toEqual([chosenKey('gate', 0)]);
  });

  it('does not advance the rng (no roll happened)', () => {
    const g = createGame(sampleStory, 1234);
    expect(chooseSimple(g, choice, 0).rngState).toBe(1234);
  });
});

describe('resolveCheck', () => {
  it('succeeds when total >= dc and routes to onSuccess', () => {
    const g = { ...createGame(sampleStory), rngState: seedForDie(15) };
    const { state, roll } = resolveCheck(g, check({ dc: 10, modifier: 0 }), 0);
    expect(roll.success).toBe(true);
    expect(roll.crit).toBeNull();
    expect(state.currentId).toBe('persuaded');
  });

  it('fails when total < dc and routes to onFailure', () => {
    const g = { ...createGame(sampleStory), rngState: seedForDie(5) };
    const { state, roll } = resolveCheck(g, check({ dc: 10, modifier: 0 }), 0);
    expect(roll.success).toBe(false);
    expect(state.currentId).toBe('suspicious');
  });

  it('records the outcome (:s on success, :f on failure) under the node+index key', () => {
    const win = { ...createGame(sampleStory), rngState: seedForDie(20) };
    expect(resolveCheck(win, check({ dc: 99 }), 1).state.chosen).toEqual([chosenKey('gate', 1, 's')]);
    const lose = { ...createGame(sampleStory), rngState: seedForDie(1) };
    expect(resolveCheck(lose, check({ dc: 1 }), 1).state.chosen).toEqual([chosenKey('gate', 1, 'f')]);
  });

  it('BOUNDARY: total exactly equal to dc is a success', () => {
    const g = { ...createGame(sampleStory), rngState: seedForDie(10) };
    const { roll } = resolveCheck(g, check({ dc: 12, modifier: 2 }), 0);
    expect(roll.total).toBe(12);
    expect(roll.success).toBe(true);
  });

  it('CRIT: natural 20 succeeds even when total < dc', () => {
    const g = { ...createGame(sampleStory), rngState: seedForDie(20) };
    const { roll } = resolveCheck(g, check({ dc: 99, modifier: 0 }), 0);
    expect(roll.die).toBe(20);
    expect(roll.success).toBe(true);
    expect(roll.crit).toBe('success');
  });

  it('CRIT: natural 1 fails even when total >= dc', () => {
    const g = { ...createGame(sampleStory), rngState: seedForDie(1) };
    const { roll } = resolveCheck(g, check({ dc: 5, modifier: 30 }), 0);
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
    const { roll } = resolveCheck(g, noMod, 0);
    expect(roll.modifier).toBe(0);
    expect(roll.total).toBe(10);
  });

  it('advances the rng state EXACTLY once', () => {
    const g = { ...createGame(sampleStory), rngState: 4242 };
    const { state } = resolveCheck(g, check(), 0);
    expect(state.rngState).toBe(rollD20(4242).next);
    expect(state.history).toHaveLength(1);
  });
});

describe('rewind', () => {
  it('steps back one and restores currentId', () => {
    let s = createGame(sampleStory, 1);
    s = chooseSimple(s, { kind: 'simple', label: 'go', next: 'truth' }, 0);
    const back = rewind(s, 1);
    expect(back.currentId).toBe('gate');
    expect(back.history).toHaveLength(0);
  });

  it('keeps visited AND chosen monotonic (does NOT shrink on rewind)', () => {
    let s = createGame(sampleStory, 1);
    s = chooseSimple(s, { kind: 'simple', label: 'go', next: 'truth' }, 0);
    const back = rewind(s, 1);
    expect(back.visited).toContain('truth');
    expect(back.chosen).toEqual([chosenKey('gate', 0)]); // the taken option stays recorded
  });

  it('CRITICAL: rewinding past a check LEAVES the rng advanced so a retry rolls a fresh die', () => {
    const g = { ...createGame(sampleStory), rngState: 987654 };
    const first = resolveCheck(g, check(), 0);
    const back = rewind(first.state, 1);
    // Back does NOT rewind the generator — it stays where the roll left it.
    expect(back.rngState).toBe(first.state.rngState);
    expect(back.rngState).not.toBe(987654);
    // Retrying the same check consumes the NEXT value in the sequence, not a repeat.
    const again = resolveCheck(back, check(), 0);
    expect(again.roll.die).toBe(rollD20(first.state.rngState).die);
  });

  it('is a no-op at the start of history', () => {
    const g = createGame(sampleStory, 1);
    expect(rewind(g, 1)).toBe(g);
  });

  it('clamps when steps exceeds history length', () => {
    let s = createGame(sampleStory, 1);
    s = chooseSimple(s, { kind: 'simple', label: 'go', next: 'truth' }, 0);
    const back = rewind(s, 99);
    expect(back.currentId).toBe('gate');
    expect(back.history).toHaveLength(0);
  });
});

describe('restart', () => {
  it('returns to start, clears history, and KEEPS visited + chosen', () => {
    let s = createGame(sampleStory, 1);
    s = chooseSimple(s, { kind: 'simple', label: 'go', next: 'truth' }, 0);
    s = chooseSimple(s, { kind: 'simple', label: 'go', next: 'enter' }, 0);
    const r = restart(sampleStory, s, 2);
    expect(r.currentId).toBe('gate');
    expect(r.history).toEqual([]);
    expect(r.visited).toEqual(expect.arrayContaining(['gate', 'truth', 'enter']));
    expect(r.chosen).toEqual(s.chosen); // click history survives a restart
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
    s = chooseSimple(s, file.nodes.gate.choices[0] as SimpleChoice, 0); // -> truth
    s = chooseSimple(s, file.nodes.truth.choices[0] as SimpleChoice, 0); // -> enter
    expect(s.currentId).toBe('enter');
    expect(file.nodes.enter.choices).toHaveLength(0); // terminal
  });
});
