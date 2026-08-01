import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SimpleChoice } from '../story/types';
import type { GameState } from '../engine/engine';
import { sampleStory } from '../story/sample';
import { loadGame, saveGame } from './progressStore';
import { useGame } from './useGame';

const toTruth = sampleStory.nodes.gate.choices[0] as SimpleChoice; // gate -> truth
const KEY = 'HOOK';

describe('useGame persistence', () => {
  beforeEach(() => localStorage.clear());

  it('restores a saved game on mount when given a storageKey', () => {
    const saved: GameState = {
      currentId: 'truth',
      history: [],
      visited: ['gate', 'truth'],
      rngState: 999,
    };
    saveGame(KEY, saved);
    const { result } = renderHook(() => useGame(sampleStory, 1, KEY));
    expect(result.current.state.game.currentId).toBe('truth');
    expect(result.current.state.game.rngState).toBe(999);
  });

  it('persists committed progress on change', () => {
    const { result } = renderHook(() => useGame(sampleStory, 1, KEY));
    act(() => result.current.chooseSimple(toTruth));
    expect(loadGame(KEY)?.currentId).toBe('truth');
  });

  it('reset() clears progress back to a fresh start baseline', () => {
    const { result } = renderHook(() => useGame(sampleStory, 1, KEY));
    act(() => result.current.chooseSimple(toTruth));
    act(() => result.current.reset());
    expect(result.current.state.game.currentId).toBe('gate');
    expect(result.current.state.game.visited).toEqual(['gate']);
    expect(loadGame(KEY)?.currentId).toBe('gate'); // baseline re-persisted
  });

  it('does not touch storage without a storageKey', () => {
    const { result } = renderHook(() => useGame(sampleStory, 1));
    act(() => result.current.chooseSimple(toTruth));
    expect(localStorage.length).toBe(0);
  });
});
