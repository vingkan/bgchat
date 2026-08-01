import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../engine/engine';
import { clearGame, loadGame, saveGame } from './progressStore';

const sample: GameState = {
  currentId: 'truth',
  history: [],
  visited: ['gate', 'truth'],
  chosen: ['gate#0'],
  rngState: 12345,
};

describe('progressStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips a saved game', () => {
    saveGame('TEST', sample);
    expect(loadGame('TEST')).toEqual(sample);
  });

  it('namespaces per story key (no cross-story bleed)', () => {
    saveGame('TEST', sample);
    expect(loadGame('LOVE')).toBeNull();
  });

  it('clearGame removes the save', () => {
    saveGame('TEST', sample);
    clearGame('TEST');
    expect(loadGame('TEST')).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    localStorage.setItem('bgchat-progress-v1:TEST', '{ not json');
    expect(loadGame('TEST')).toBeNull();
  });

  it('returns null for wrong-shaped data', () => {
    localStorage.setItem('bgchat-progress-v1:TEST', JSON.stringify({ currentId: 'x' }));
    expect(loadGame('TEST')).toBeNull();
  });

  it('accepts an older save that predates the `chosen` field (backward-compat)', () => {
    const legacy = { currentId: 'truth', history: [], visited: ['gate', 'truth'], rngState: 7 };
    localStorage.setItem('bgchat-progress-v1:TEST', JSON.stringify(legacy));
    expect(loadGame('TEST')).toEqual(legacy); // structurally valid; chosen defaulted downstream
  });

  it('rejects a save whose chosen is not a string array', () => {
    const bad = { ...sample, chosen: [1, 2, 3] };
    localStorage.setItem('bgchat-progress-v1:TEST', JSON.stringify(bad));
    expect(loadGame('TEST')).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => saveGame('TEST', sample)).not.toThrow();
  });
});
