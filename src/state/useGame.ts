import { useCallback, useMemo, useReducer } from 'react';
import type { CheckChoice, SimpleChoice, StoryFile } from '../story/types';
import { initPlayer, reduce, type Action, type PlayerState } from './gameReducer';

// Binds the pure reducer to `file` and exposes typed dispatch helpers.
export function useGame(file: StoryFile, seed?: number) {
  const [state, dispatch] = useReducer(
    (s: PlayerState, a: Action) => reduce(file, s, a),
    undefined,
    () => initPlayer(file, seed),
  );

  const chooseSimple = useCallback(
    (choice: SimpleChoice) => dispatch({ type: 'SIMPLE_CHOICE', choice }),
    [],
  );
  const resolveCheck = useCallback(
    (choice: CheckChoice) => dispatch({ type: 'RESOLVE_CHECK', choice }),
    [],
  );
  const cont = useCallback(() => dispatch({ type: 'CONTINUE' }), []);
  const back = useCallback(() => dispatch({ type: 'BACK' }), []);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), []);

  const node = useMemo(() => file.nodes[state.game.currentId], [file, state.game.currentId]);

  return { state, node, chooseSimple, resolveCheck, cont, back, restart };
}
