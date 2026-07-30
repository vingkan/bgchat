// The pure dialogue engine. No React, no DOM, no side effects — every function
// takes state and returns new state, which is what makes it trivially testable
// and the whole GameState JSON-serializable (for the future shareable-URL feature).

import type { CheckChoice, Choice, NodeId, SimpleChoice, StoryFile } from '../story/types';
import { randomSeed, rollD20 } from './rng';

// The outcome of a skill check. `success` is FINAL — it already reflects crit rules,
// so the UI reads `success` alone and never re-derives from total vs dc.
export interface RollResult {
  choiceLabel: string;
  skill: string;
  dc: number;
  die: number; // raw d20 face, 1-20
  modifier: number;
  total: number; // die + modifier
  success: boolean; // final outcome, AFTER crit rules
  crit: 'success' | 'failure' | null; // nat 20 -> 'success', nat 1 -> 'failure'
}

// One recorded step. `rngBefore` is the rng state as it was WHEN this step was taken,
// so rewinding to it and re-forwarding reproduces the same die (Back = true undo).
export interface HistoryEntry {
  nodeId: NodeId; // node the player was on when they made this choice
  choice: Choice;
  roll: RollResult | null; // present iff choice.kind === 'check'
  rngBefore: number;
}

export interface GameState {
  currentId: NodeId;
  history: HistoryEntry[];
  visited: NodeId[]; // MONOTONIC — never shrinks (survives rewind AND restart)
  rngState: number; // current mulberry32 state; advances on each roll
}

function addVisited(visited: NodeId[], id: NodeId): NodeId[] {
  return visited.includes(id) ? visited : [...visited, id];
}

// Start a brand-new game at the story's entry point.
export function createGame(file: StoryFile, seed: number = randomSeed()): GameState {
  return {
    currentId: file.start,
    history: [],
    visited: [file.start],
    rngState: seed | 0,
  };
}

// Restart: a NEW playthrough with FRESH LUCK (new random seed by default) but
// KEEPING visited, so branches explored in prior runs stay marked "seen".
export function restart(file: StoryFile, state: GameState, seed: number = randomSeed()): GameState {
  return {
    currentId: file.start,
    history: [],
    visited: addVisited(state.visited, file.start),
    rngState: seed | 0,
  };
}

// A plain transition. Does NOT advance the rng (no roll happened).
export function chooseSimple(state: GameState, choice: SimpleChoice): GameState {
  const entry: HistoryEntry = {
    nodeId: state.currentId,
    choice,
    roll: null,
    rngBefore: state.rngState,
  };
  return {
    currentId: choice.next,
    history: [...state.history, entry],
    visited: addVisited(state.visited, choice.next),
    rngState: state.rngState,
  };
}

// Resolve a skill check. Runs the roll EXACTLY ONCE (rng advances once) and returns
// both the RollResult (for the animation) and the fully-committed next state.
// The reducer stages `roll` while the die animates, then commits `state` on Continue.
export function resolveCheck(
  state: GameState,
  choice: CheckChoice,
): { state: GameState; roll: RollResult } {
  const { die, next } = rollD20(state.rngState);
  const modifier = choice.modifier ?? 0;
  const total = die + modifier;

  // Crit precedence: nat 20 forces success, nat 1 forces failure, else total >= dc.
  let success: boolean;
  let crit: 'success' | 'failure' | null;
  if (die === 20) {
    success = true;
    crit = 'success';
  } else if (die === 1) {
    success = false;
    crit = 'failure';
  } else {
    success = total >= choice.dc;
    crit = null;
  }

  const roll: RollResult = {
    choiceLabel: choice.label,
    skill: choice.skill,
    dc: choice.dc,
    die,
    modifier,
    total,
    success,
    crit,
  };

  const dest = success ? choice.onSuccess : choice.onFailure;
  const entry: HistoryEntry = {
    nodeId: state.currentId,
    choice,
    roll,
    rngBefore: state.rngState,
  };

  const nextState: GameState = {
    currentId: dest,
    history: [...state.history, entry],
    visited: addVisited(state.visited, dest),
    rngState: next,
  };

  return { state: nextState, roll };
}

// Step back `steps` history entries (default 1). Restores currentId and rngState
// from the target entry's `rngBefore` so re-forwarding reproduces the same rolls.
// `visited` is MONOTONIC and is NOT shrunk. Clamps to the start of history.
export function rewind(state: GameState, steps = 1): GameState {
  const n = Math.min(Math.max(Math.trunc(steps), 0), state.history.length);
  if (n === 0) return state;
  const cut = state.history.length - n;
  const undo = state.history[cut]; // the first step we're undoing
  return {
    currentId: undo.nodeId,
    history: state.history.slice(0, cut),
    visited: state.visited,
    rngState: undo.rngBefore,
  };
}
