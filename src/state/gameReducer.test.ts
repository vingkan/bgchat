import { describe, expect, it } from 'vitest';
import type { CheckChoice, SimpleChoice } from '../story/types';
import { sampleStory } from '../story/sample';
import { initPlayer, reduce } from './gameReducer';

const simple = sampleStory.nodes.gate.choices[0] as SimpleChoice; // -> truth
const persuade = sampleStory.nodes.gate.choices[1] as CheckChoice; // Persuasion check

describe('gameReducer', () => {
  it('SIMPLE_CHOICE advances the game', () => {
    const s = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'SIMPLE_CHOICE', choice: simple });
    expect(s.game.currentId).toBe('truth');
    expect(s.pending).toBeNull();
  });

  it('RESOLVE_CHECK stages a pending roll WITHOUT moving the current node', () => {
    const s = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'RESOLVE_CHECK', choice: persuade });
    expect(s.pending).not.toBeNull();
    expect(s.game.currentId).toBe('gate'); // still on the current node, dimmed
  });

  it('double-click guard: a second RESOLVE_CHECK while pending is IGNORED', () => {
    const first = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'RESOLVE_CHECK', choice: persuade });
    const second = reduce(sampleStory, first, { type: 'RESOLVE_CHECK', choice: persuade });
    expect(second).toBe(first); // unchanged reference — no second roll
  });

  it('SIMPLE_CHOICE is ignored while a roll is pending', () => {
    const pending = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'RESOLVE_CHECK', choice: persuade });
    const after = reduce(sampleStory, pending, { type: 'SIMPLE_CHOICE', choice: simple });
    expect(after).toBe(pending);
  });

  it('CONTINUE commits the staged next game and clears pending', () => {
    const pending = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'RESOLVE_CHECK', choice: persuade });
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
    const advanced = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'SIMPLE_CHOICE', choice: simple });
    const back = reduce(sampleStory, advanced, { type: 'BACK' });
    expect(back.game.currentId).toBe('gate');
  });

  it('RESTART returns to start but keeps visited', () => {
    const advanced = reduce(sampleStory, initPlayer(sampleStory, 1), { type: 'SIMPLE_CHOICE', choice: simple });
    const restarted = reduce(sampleStory, advanced, { type: 'RESTART' });
    expect(restarted.game.currentId).toBe('gate');
    expect(restarted.game.visited).toContain('truth'); // seen persists
    expect(restarted.game.history).toEqual([]);
  });
});
