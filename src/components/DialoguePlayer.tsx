import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { Choice, StoryFile } from '../story/types';
import { primaryTarget } from '../story/types';
import { validateStory } from '../engine/validation';
import { useGame } from '../state/useGame';
import { clearGame } from '../state/progressStore';
import { BeginGate } from './BeginGate';
import { ChoiceButton } from './ChoiceButton';
import { DiceRoll } from './DiceRoll';
import { ProgressTracker } from './ProgressTracker';
import { VideoStage } from './VideoStage';
import { prefetchVideos } from './video';

// Collect the video paths reachable from a node's choices, for prefetching.
function nextVideos(file: StoryFile, choices: Choice[]): string[] {
  const paths: string[] = [];
  for (const c of choices) {
    if (c.kind === 'simple') paths.push(file.nodes[c.next]?.video ?? '');
    else {
      paths.push(file.nodes[c.onSuccess]?.video ?? '');
      paths.push(file.nodes[c.onFailure]?.video ?? '');
    }
  }
  return paths;
}

export function DialoguePlayer({
  file,
  seed,
  storageKey,
  initialStarted = false,
  onBeginKey,
}: {
  file: StoryFile;
  seed?: number;
  // localStorage namespace for save/resume. Omit to disable persistence (unit tests, e2e).
  storageKey?: string;
  // true => skip the Begin gate (arrived via a valid ?key= URL).
  initialStarted?: boolean;
  // Begin gate reports the typed key; returns false for an unknown key so the
  // gate can show an error. When absent (e.g. unit tests), Begin always proceeds.
  onBeginKey?: (key: string) => boolean;
}) {
  const { state, node, chooseSimple, resolveCheck, cont, back, restart, reset } = useGame(
    file,
    seed,
    storageKey,
  );
  const [started, setStarted] = useState(initialStarted);
  const [muted, setMuted] = useState(true);

  const { pending } = state;
  const isEnd = node.choices.length === 0;

  // Dev-only guard: fail loudly on a broken story. Tree-shaken from prod.
  useEffect(() => {
    if (import.meta.env.DEV) validateStory(file);
  }, [file]);

  // Prefetch the clips this node's choices lead to, so transitions don't stall.
  useEffect(() => prefetchVideos(nextVideos(file, node.choices)), [file, node]);

  const select = (c: Choice) => (c.kind === 'simple' ? chooseSimple(c) : resolveCheck(c));

  // Number keys 1-4 select a choice (disabled during a roll or before Begin).
  useEffect(() => {
    if (!started || pending || isEnd) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= node.choices.length) {
        e.preventDefault();
        select(node.choices[n - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // `select` is stable via useGame's memoized dispatchers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, pending, isEnd, node]);

  return (
    <div id="stage">
      {/* <div className="bar top" /> */}
      <div id="frame" className={pending ? 'dimmed' : ''}>
        <VideoStage src={node.video} started={started} muted={muted} />
        <div id="lower">
          {/* Keyed by node.id: React swaps the old node out instantly and the new
              one fades in. No exit animation (avoids a dead gap and stale duplicate
              controls mid-transition). */}
          <motion.div
            id="content"
            key={node.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="speaker">{node.speaker}</div>
            <div className="dialogue">{node.text}</div>

            {isEnd ? (
              <div className="endcard">
                <div className="end-rule" />
                <div className="end-title">The End</div>
                <button className="continue visible" onClick={restart}>
                  Restart
                </button>
                {storageKey && (
                  <button
                    className="ghost"
                    onClick={() => {
                      clearGame(storageKey);
                      reset();
                    }}
                  >
                    Reset Progress
                  </button>
                )}
              </div>
            ) : (
              <>
                <ul className="choices">
                  {node.choices.map((c, i) => (
                    <ChoiceButton
                      key={i}
                      choice={c}
                      index={i}
                      seen={state.game.visited.includes(primaryTarget(c))}
                      onSelect={() => select(c)}
                    />
                  ))}
                </ul>
                <div id="controls">
                  <button
                    className="ctrl"
                    onClick={back}
                    disabled={state.game.history.length === 0}
                  >
                    Back
                  </button>
                  <button className="ctrl" onClick={restart}>
                    Restart
                  </button>
                  <button className="ctrl" onClick={() => setMuted((m) => !m)}>
                    {muted ? 'Unmute' : 'Mute'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
      {/* <div className="bar bottom" /> */}

      {started && <ProgressTracker file={file} visited={state.game.visited} />}

      <DiceRoll roll={pending?.roll ?? null} onContinue={cont} />
      {!started && (
        <BeginGate
          onBegin={(key) => {
            // A valid key switch is handled by App (which remounts this player
            // already-started); the local setStarted covers the no-switch cases
            // (empty key, same key, or no onBeginKey in tests).
            const ok = onBeginKey ? onBeginKey(key) : true;
            if (ok) setStarted(true);
            return ok;
          }}
        />
      )}
    </div>
  );
}
