import { describe, expect, it } from 'vitest';
import type { CheckChoice, SimpleChoice, StoryFile } from '../story/types';
import type { GameState } from '../engine/engine';
import { sampleStory } from '../story/sample';
import { rollD20 } from '../engine/rng';
import { initPlayer, reduce } from './gameReducer';

const simple = sampleStory.nodes.gate.choices[0] as SimpleChoice; // -> truth
const persuade = sampleStory.nodes.gate.choices[1] as CheckChoice; // Persuasion check

describe('gameReducer', () => {
  it('SIMPLE_CHOICE advances the game and records the taken option', () => {
    const s = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'SIMPLE_CHOICE', choice: simple, index: 0 });
    expect(s.game.currentId).toBe('truth');
    expect(s.game.chosen).toEqual(['gate#0']);
    expect(s.pending).toBeNull();
  });

  it('RESOLVE_CHECK stages a pending roll WITHOUT moving the current node', () => {
    const s = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'RESOLVE_CHECK', choice: persuade, index: 1 });
    expect(s.pending).not.toBeNull();
    expect(s.game.currentId).toBe('gate'); // still on the current node, dimmed
  });

  it('double-click guard: a second RESOLVE_CHECK while pending is IGNORED', () => {
    const first = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'RESOLVE_CHECK', choice: persuade, index: 1 });
    const second = reduce(sampleStory, first, { type: 'RESOLVE_CHECK', choice: persuade, index: 1 });
    expect(second).toBe(first); // unchanged reference — no second roll
  });

  it('SIMPLE_CHOICE is ignored while a roll is pending', () => {
    const pending = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'RESOLVE_CHECK', choice: persuade, index: 1 });
    const after = reduce(sampleStory, pending, { type: 'SIMPLE_CHOICE', choice: simple, index: 0 });
    expect(after).toBe(pending);
  });

  it('CONTINUE commits the staged next game and clears pending', () => {
    const pending = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'RESOLVE_CHECK', choice: persuade, index: 1 });
    const dest = pending.pending!.nextGame.currentId;
    const after = reduce(sampleStory, pending, { type: 'CONTINUE' });
    expect(after.pending).toBeNull();
    expect(after.game.currentId).toBe(dest);
    expect(['persuaded', 'suspicious']).toContain(dest);
  });

  it('CONTINUE with nothing pending is a no-op', () => {
    const init = initPlayer(sampleStory, 1);
    expect(reduce(sampleStory, init, { type: 'CONTINUE' })).toBe(init);
  });

  it('BACK rewinds one step', () => {
    const advanced = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'SIMPLE_CHOICE', choice: simple, index: 0 });
    const back = reduce(sampleStory, advanced, { type: 'BACK' });
    expect(back.game.currentId).toBe('gate');
  });

  it('retrying a check after BACK rolls a FRESH die (no save-scum lock)', () => {
    // Resolve the check, commit it, go Back, resolve the same check again.
    const first = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'RESOLVE_CHECK', choice: persuade, index: 1 });
    const committedRng = first.pending!.nextGame.rngState; // generator after the first roll
    const landed = reduce(sampleStory, first, { type: 'CONTINUE' });
    const back = reduce(sampleStory, landed, { type: 'BACK' });
    expect(back.game.currentId).toBe('gate'); // returned to the choice
    const retry = reduce(sampleStory, back, { type: 'RESOLVE_CHECK', choice: persuade, index: 1 });
    // The retry consumes the NEXT value in the sequence, not a replay of the first roll.
    expect(retry.pending!.roll.die).toBe(rollD20(committedRng).die);
    expect(retry.pending!.roll.die).not.toBe(first.pending!.roll.die);
  });

  it('RESTART returns to start but keeps visited', () => {
    const advanced = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'SIMPLE_CHOICE', choice: simple, index: 0 });
    const restarted = reduce(sampleStory, advanced, { type: 'RESTART' });
    expect(restarted.game.currentId).toBe('gate');
    expect(restarted.game.visited).toContain('truth'); // seen persists
    expect(restarted.game.history).toEqual([]);
  });

  it('RESET wipes back to a fresh start (unlike RESTART, does NOT keep visited)', () => {
    const advanced = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'SIMPLE_CHOICE', choice: simple, index: 0 });
    const reset = reduce(sampleStory, advanced, { type: 'RESET' });
    expect(reset.game.currentId).toBe('gate');
    expect(reset.game.visited).toEqual(['gate']); // seen memory cleared
    expect(reset.game.history).toEqual([]);
    expect(reset.pending).toBeNull();
  });
});

describe('RESOLVE_CHECK modifier source', () => {
  // A one-node story whose only choice is a Stealth check, plus a story-level table.
  const storyWith = (opts: { tableMod?: number; checkMod?: number }): StoryFile => ({
    start: 'n',
    nodes: {
      n: {
        id: 'n',
        speaker: 'A',
        text: 't',
        video: '',
        choices: [
          {
            kind: 'check',
            label: 'sneak',
            skill: 'Stealth',
            dc: 10,
            ...(opts.checkMod !== undefined ? { modifier: opts.checkMod } : {}),
            onSuccess: 'n',
            onFailure: 'n',
          },
        ],
      },
    },
    ...(opts.tableMod !== undefined ? { skillModifiers: { Stealth: opts.tableMod } } : {}),
  });

  const rollFrom = (file: StoryFile) => {
    const choice = file.nodes.n.choices[0] as CheckChoice;
    const s = reduce(file, initPlayer(file, 1), { type: 'RESOLVE_CHECK', choice, index: 0 });
    return s.pending!.roll;
  };

  it('reads the modifier from skillModifiers when present (even if the check has none)', () => {
    const roll = rollFrom(storyWith({ tableMod: 4 }));
    expect(roll.modifier).toBe(4);
    expect(roll.total).toBe(roll.die + 4);
  });

  it('lets the table override a baked per-check modifier (single source of truth)', () => {
    const roll = rollFrom(storyWith({ tableMod: 4, checkMod: 1 }));
    expect(roll.modifier).toBe(4);
  });

  it('falls back to the baked modifier when the table is absent', () => {
    const roll = rollFrom(storyWith({ checkMod: 2 }));
    expect(roll.modifier).toBe(2);
  });
});

describe('initPlayer restore', () => {
  const saved: GameState = {
    currentId: 'truth',
    history: [],
    visited: ['gate', 'truth', 'ghost-node-that-no-longer-exists'],
    chosen: ['gate#0'],
    rngState: 4242,
  };

  it('resumes from a valid saved game', () => {
    const p = initPlayer(sampleStory, 1, saved);
    expect(p.game.currentId).toBe('truth');
    expect(p.game.rngState).toBe(4242);
    expect(p.game.chosen).toEqual(['gate#0']);
    expect(p.pending).toBeNull();
  });

  it('defaults chosen to [] for an older save that predates the field', () => {
    // Simulate a v1 save with no `chosen` (structurally valid; see progressStore).
    const legacy = {
      currentId: 'truth',
      history: [],
      visited: ['gate', 'truth'],
      rngState: 4242,
    } as unknown as GameState;
    const p = initPlayer(sampleStory, 1, legacy);
    expect(p.game.chosen).toEqual([]);
    expect(p.game.currentId).toBe('truth'); // still resumes position + visited
  });

  it('drops visited ids that no longer exist in the story', () => {
    const p = initPlayer(sampleStory, 1, saved);
    expect(p.game.visited).toEqual(['gate', 'truth']); // stale id filtered out
  });

  it('falls back to a fresh start when the saved node is unknown', () => {
    const stale: GameState = { ...saved, currentId: 'deleted-node' };
    const p = initPlayer(sampleStory, 1, stale);
    expect(p.game.currentId).toBe('gate');
    expect(p.game.visited).toEqual(['gate']);
  });

  it('starts fresh when there is no saved game', () => {
    const p = initPlayer(sampleStory, 1, null);
    expect(p.game.currentId).toBe('gate');
  });
});
