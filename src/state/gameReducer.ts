// The thin React state layer over the pure engine. Every action maps to one engine
// call. The reducer holds the committed GameState plus a transient `pending` roll:
// the "stage-then-commit" model so the die shown is provably the die applied.
//
//   click CHECK ─► RESOLVE_CHECK: resolveCheck() runs ONCE (rng advances once),
//                  result stored in `pending`; game stays on the current node (dimmed)
//        │
//        ▼   [Continue] ─► CONTINUE: commit pending.nextGame, clear pending
//   render resulting node
//
//   While `pending` is set, RESOLVE_CHECK / SIMPLE_CHOICE / BACK are IGNORED — that
//   is the double-click guard (a frantic second click can't fire a second roll).

import type { CheckChoice, SimpleChoice, StoryFile } from '../story/types';
import type { GameState, RollResult } from '../engine/engine';
import { chooseSimple, createGame, resolveCheck, restart, rewind } from '../engine/engine';

export interface PlayerState {
  game: GameState;
  pending: { roll: RollResult; nextGame: GameState } | null;
}

export type Action =
  | { type: 'SIMPLE_CHOICE'; choice: SimpleChoice; index: number }
  | { type: 'RESOLVE_CHECK'; choice: CheckChoice; index: number }
  | { type: 'CONTINUE' }
  | { type: 'BACK' }
  | { type: 'RESTART' }
  | { type: 'RESET' };

// Start a player. If a `saved` GameState is supplied AND it is semantically valid for this
// story (its currentId still exists), resume from it — after filtering `visited` down to node
// ids that still exist, so a since-edited story can't push the progress bar past 100%.
// Otherwise begin a fresh playthrough. `saved` comes from localStorage (progressStore), which
// has already checked the structural shape; here we own the story-specific semantic check.
export function initPlayer(file: StoryFile, seed?: number, saved?: GameState | null): PlayerState {
  if (saved && saved.currentId in file.nodes) {
    const visited = saved.visited.filter((id) => id in file.nodes);
    // `chosen` predates this field in older saves — default it so tags start empty.
    return { game: { ...saved, visited, chosen: saved.chosen ?? [] }, pending: null };
  }
  return { game: createGame(file, seed), pending: null };
}

export function reduce(file: StoryFile, state: PlayerState, action: Action): PlayerState {
  switch (action.type) {
    case 'SIMPLE_CHOICE':
      if (state.pending) return state; // guard: no choosing mid-roll
      return { game: chooseSimple(state.game, action.choice, action.index), pending: null };

    case 'RESOLVE_CHECK': {
      if (state.pending) return state; // double-click guard: one roll at a time
      // Prefer the story-level skill table (single source of truth); fall back to
      // the modifier baked onto the check for stories without the table.
      const modifier = file.skillModifiers?.[action.choice.skill] ?? action.choice.modifier ?? 0;
      const { state: nextGame, roll } = resolveCheck(state.game, action.choice, action.index, modifier);
      return { game: state.game, pending: { roll, nextGame } };
    }

    case 'CONTINUE':
      if (!state.pending) return state;
      return { game: state.pending.nextGame, pending: null };

    case 'BACK':
      if (state.pending) return state;
      return { game: rewind(state.game, 1), pending: null };

    case 'RESTART':
      return { game: restart(file, state.game), pending: null };

    // A genuinely fresh start: unlike RESTART (which keeps `visited`), RESET wipes progress
    // back to a brand-new game. Paired with clearing localStorage so a new person can play.
    case 'RESET':
      return initPlayer(file);

    default:
      return state;
  }
}
