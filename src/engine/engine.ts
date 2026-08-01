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

// One recorded step: the node the player was on and the choice they made there.
export interface HistoryEntry {
  nodeId: NodeId; // node the player was on when they made this choice
  choice: Choice;
  roll: RollResult | null; // present iff choice.kind === 'check'
}

export interface GameState {
  currentId: NodeId;
  history: HistoryEntry[];
  visited: NodeId[]; // MONOTONIC — never shrinks (survives rewind AND restart)
  chosen: string[]; // MONOTONIC set of taken-option keys (see chosenKey); drives choice tags
  rngState: number; // current mulberry32 state; advances on each roll
}

// Stable id for "this exact option (and, for a check, this outcome) was taken". Keyed by
// node + choice index (index disambiguates two options that share a `next`), with an
// outcome suffix for checks so success/failure/both are distinguishable.
export const chosenKey = (nodeId: NodeId, index: number, outcome?: 's' | 'f'): string =>
  outcome ? `${nodeId}#${index}:${outcome}` : `${nodeId}#${index}`;

function addUnique(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

// Start a brand-new game at the story's entry point.
export function createGame(file: StoryFile, seed: number = randomSeed()): GameState {
  return {
    currentId: file.start,
    history: [],
    visited: [file.start],
    chosen: [],
    rngState: seed | 0,
  };
}

// Restart: a NEW playthrough with FRESH LUCK (new random seed by default) but
// KEEPING visited, so branches explored in prior runs stay marked "seen".
export function restart(file: StoryFile, state: GameState, seed: number = randomSeed()): GameState {
  return {
    currentId: file.start,
    history: [],
    visited: addUnique(state.visited, file.start),
    chosen: state.chosen,
    rngState: seed | 0,
  };
}

// A plain transition. Does NOT advance the rng (no roll happened). `index` is the choice's
// position in the current node, recorded so this exact option reads "Chosen".
export function chooseSimple(state: GameState, choice: SimpleChoice, index: number): GameState {
  const entry: HistoryEntry = {
    nodeId: state.currentId,
    choice,
    roll: null,
  };
  return {
    currentId: choice.next,
    history: [...state.history, entry],
    visited: addUnique(state.visited, choice.next),
    chosen: addUnique(state.chosen, chosenKey(state.currentId, index)),
    rngState: state.rngState,
  };
}

// Resolve a skill check. Runs the roll EXACTLY ONCE (rng advances once) and returns
// both the RollResult (for the animation) and the fully-committed next state.
// The reducer stages `roll` while the die animates, then commits `state` on Continue.
export function resolveCheck(
  state: GameState,
  choice: CheckChoice,
  index: number,
  // Modifier to add to the roll. The caller (reducer) resolves this from the
  // story-level skill table when present; omitted callers fall back to the
  // modifier baked onto the check itself.
  modifierOverride?: number,
): { state: GameState; roll: RollResult } {
  const { die, next } = rollD20(state.rngState);
  const modifier = modifierOverride ?? choice.modifier ?? 0;
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
  };

  const nextState: GameState = {
    currentId: dest,
    history: [...state.history, entry],
    visited: addUnique(state.visited, dest),
    chosen: addUnique(state.chosen, chosenKey(state.currentId, index, success ? 's' : 'f')),
    rngState: next,
  };

  return { state: nextState, roll };
}

// Step back `steps` history entries (default 1). Restores currentId and trims history,
// but deliberately LEAVES the rng advanced — it is NOT rewound. So re-doing a check after
// a Back rolls a FRESH die (each retry consumes the next value in the sequence); a failed
// check is not locked in. `visited` is MONOTONIC and is NOT shrunk. Clamps to start of history.
export function rewind(state: GameState, steps = 1): GameState {
  const n = Math.min(Math.max(Math.trunc(steps), 0), state.history.length);
  if (n === 0) return state;
  const cut = state.history.length - n;
  const undo = state.history[cut]; // the first step we're undoing
  return {
    currentId: undo.nodeId,
    history: state.history.slice(0, cut),
    visited: state.visited,
    chosen: state.chosen, // MONOTONIC — a taken option stays recorded through a rewind
    rngState: state.rngState, // keep the generator advanced -> retry rolls a new die
  };
}
