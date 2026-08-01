import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { CheckChoice, SimpleChoice, StoryFile } from '../story/types';
import { initPlayer, reduce, type Action, type PlayerState } from './gameReducer';
import { loadGame, saveGame } from './progressStore';

// Binds the pure reducer to `file` and exposes typed dispatch helpers.
//
// When `storageKey` is provided, the committed game state is persisted to localStorage under
// that key and restored on mount (full resume). Omit `storageKey` (tests, e2e) for a hermetic,
// storage-free player. Only `state.game` is saved — never the transient `pending` roll.
export function useGame(file: StoryFile, seed?: number, storageKey?: string) {
  const [state, dispatch] = useReducer(
    (s: PlayerState, a: Action) => reduce(file, s, a),
    undefined,
    () => initPlayer(file, seed, storageKey ? loadGame(storageKey) : null),
  );

  const chooseSimple = useCallback(
    (choice: SimpleChoice, index: number) => dispatch({ type: 'SIMPLE_CHOICE', choice, index }),
    [],
  );
  const resolveCheck = useCallback(
    (choice: CheckChoice, index: number) => dispatch({ type: 'RESOLVE_CHECK', choice, index }),
    [],
  );
  const cont = useCallback(() => dispatch({ type: 'CONTINUE' }), []);
  const back = useCallback(() => dispatch({ type: 'BACK' }), []);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  // Persist committed progress on every change (best-effort; progressStore swallows failures).
  useEffect(() => {
    if (storageKey) saveGame(storageKey, state.game);
  }, [storageKey, state.game]);

  const node = useMemo(() => file.nodes[state.game.currentId], [file, state.game.currentId]);

  return { state, node, chooseSimple, resolveCheck, cont, back, restart, reset };
}
