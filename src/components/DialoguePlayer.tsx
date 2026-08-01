import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { Choice, StoryFile } from '../story/types';
import { validateStory } from '../engine/validation';
import { choiceTag } from '../engine/progress';
import { useGame } from '../state/useGame';
import { clearGame } from '../state/progressStore';
import { useGamepad } from '../input/useGamepad';
import { firstFocusable, moveFocus, type NavDir, type NavItem } from '../input/menuNav';
import type { NavButton } from '../input/gamepad';
import { BeginGate } from './BeginGate';
import { OpeningScreen } from './OpeningScreen';
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
  onHome,
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
  // Home button: let App tidy the URL. Progress is untouched (in-memory + localStorage).
  onHome?: () => void;
}) {
  const { state, node, chooseSimple, resolveCheck, cont, back, restart, reset } = useGame(
    file,
    seed,
    storageKey,
  );
  const [started, setStarted] = useState(initialStarted);
  const [muted, setMuted] = useState(true);

  // The opening screen (a story title card) shows before the first node whenever the
  // player is sitting on the start node. `began` = past that card. Only stories with
  // `openingText` have one; without it `began` starts true so nothing changes.
  //
  // `openingPassed` keys purely on position: the card is considered already passed
  // unless we're on the start node of a story that has one. It seeds `began` on mount
  // (page load / reload) and is re-applied on Home, so entering from the key screen
  // shows the card again when there's been no progress, but resumes straight to a
  // mid-story node otherwise. Restart/Reset flip `began` false in-session (they land
  // on the start node too).
  const hasOpening = Boolean(file.openingText);
  const openingPassed = () => !hasOpening || state.game.currentId !== file.start;
  const [began, setBegan] = useState(openingPassed);

  // Restart/Reset both rewind the game to the start node; re-show the opening card too.
  const doRestart = () => {
    restart();
    if (hasOpening) setBegan(false);
  };
  const doReset = () => {
    if (storageKey) clearGame(storageKey);
    reset();
    if (hasOpening) setBegan(false);
  };

  const { pending } = state;
  const isEnd = node.choices.length === 0;
  const chosen = new Set(state.game.chosen); // click history, for the per-choice tags

  // Dev-only guard: fail loudly on a broken story. Tree-shaken from prod.
  useEffect(() => {
    if (import.meta.env.DEV) validateStory(file);
  }, [file]);

  // Prefetch the clips this node's choices lead to, so transitions don't stall.
  useEffect(() => prefetchVideos(nextVideos(file, node.choices)), [file, node]);

  const select = (c: Choice, index: number) =>
    c.kind === 'simple' ? chooseSimple(c, index) : resolveCheck(c, index);

  // --- Keyboard + gamepad navigation ---------------------------------------
  // A roving cursor over the options and the control row, driven by arrows /
  // D-pad / left stick. It moves NATIVE focus (so screen readers and the existing
  // Enter/Space handlers keep working) and reads/writes through refs so the gamepad
  // poll loop always sees the live cursor without re-subscribing.
  const contentRef = useRef<HTMLDivElement>(null);
  const focusIndexRef = useRef(0);
  const navActiveRef = useRef(false); // has the player engaged the cursor on this node yet?
  const navMetaRef = useRef<NavItem[]>([]);
  const canBackRef = useRef(false);

  const canBack = state.game.history.length > 0;
  // The nav order is exactly the DOM order of the [data-nav] elements below: every
  // option, then Back, Restart, Mute, Reset (only when persisting), Home. `navMeta`
  // carries just the group + disabled flag the cursor math needs; the elements
  // themselves are looked up positionally via `navEls()`.
  const navMeta: NavItem[] = [
    ...node.choices.map(() => ({ group: 'choice', disabled: false }) as NavItem),
    { group: 'control', disabled: !canBack }, // Back
    { group: 'control', disabled: false }, // Restart
    { group: 'control', disabled: false }, // Mute
    ...(storageKey ? [{ group: 'control', disabled: false } as NavItem] : []), // Reset
    { group: 'control', disabled: false }, // Home
  ];

  // Mirror the latest nav layout into refs so the keydown + gamepad handlers (which
  // outlive a single render) always read the current options/controls.
  useEffect(() => {
    navMetaRef.current = navMeta;
    canBackRef.current = canBack;
  });

  const navEls = () =>
    Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-nav]') ?? []);
  const focusAt = (i: number) => {
    if (i < 0) return;
    focusIndexRef.current = i;
    navEls()[i]?.focus();
  };
  const navigate = (dir: NavDir) => {
    // First directional input just reveals the cursor at the first item.
    if (!navActiveRef.current) {
      navActiveRef.current = true;
      focusAt(firstFocusable(navMetaRef.current));
      return;
    }
    focusAt(moveFocus(navMetaRef.current, focusIndexRef.current, dir));
  };

  // New node => forget the cursor so focus isn't stolen on load / after a step.
  useEffect(() => {
    navActiveRef.current = false;
    const first = firstFocusable(navMeta);
    focusIndexRef.current = first < 0 ? 0 : first;
    // Re-run only when the node changes; navMeta is derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  // Keyboard: arrows move the cursor; Enter selects the focused item natively (the
  // element handles it, so there's no global Enter here — avoids a double-fire);
  // Backspace = Back; number keys jump straight to an option. Off before Begin and
  // while a roll is resolving (DiceRoll owns input then, and Back is unavailable).
  useEffect(() => {
    if (!started || !began || pending) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          return navigate('up');
        case 'ArrowDown':
          e.preventDefault();
          return navigate('down');
        case 'ArrowLeft':
          e.preventDefault();
          return navigate('left');
        case 'ArrowRight':
          e.preventDefault();
          return navigate('right');
        case 'Backspace':
          e.preventDefault(); // also suppress any browser "back"
          if (canBackRef.current) back();
          return;
      }
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= node.choices.length) {
        e.preventDefault();
        select(node.choices[n - 1], n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // navigate/select/back read live values via refs + stable dispatchers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, began, pending, node]);

  // Gamepad (PS4/PS5 + Xbox via the standard mapping): D-pad / left stick move the
  // cursor, ✕ selects the focused item (reusing its onClick), ○ goes Back.
  useGamepad(started && began && !pending, (btn: NavButton) => {
    if (btn === 'select') {
      if (navActiveRef.current) navEls()[focusIndexRef.current]?.click();
      return;
    }
    if (btn === 'back') {
      if (canBackRef.current) back();
      return;
    }
    navigate(btn);
  });

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
            ref={contentRef}
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
              </div>
            ) : (
              <ul className="choices">
                {node.choices.map((c, i) => (
                  <ChoiceButton
                    key={i}
                    choice={c}
                    index={i}
                    tag={choiceTag(file, node.id, c, i, chosen, state.game.visited)}
                    onSelect={() => select(c, i)}
                  />
                ))}
              </ul>
            )}
            {/* Shared control row — same quiet .ctrl style on every page. Reset shows
                whenever progress is persisted; Home (right-aligned) returns to the key
                screen without wiping progress. */}
            <div id="controls">
              <button
                data-nav
                className="ctrl"
                onClick={back}
                disabled={state.game.history.length === 0}
              >
                Back
              </button>
              <button data-nav className="ctrl" onClick={doRestart}>
                Restart
              </button>
              {/* Unmute nudge: when a node opts in via `nudgeUnmute` AND sound is
                  still off, a pulsing gold "Sound on" ring draws the eye to the
                  Unmute control. Decorative (aria-hidden) — the button itself is the
                  real, accessible affordance. Disappears the moment sound is on. */}
              <span className={`unmute-wrap ${node.nudgeUnmute && muted ? 'nudging' : ''}`}>
                {node.nudgeUnmute && muted && (
                  <span className="unmute-nudge" aria-hidden="true">
                    <span className="cap">Sound on</span>
                    <span className="ring" />
                    <span className="ring b" />
                  </span>
                )}
                <button data-nav className="ctrl" onClick={() => setMuted((m) => !m)}>
                  {muted ? 'Unmute' : 'Mute'}
                </button>
              </span>
              {storageKey && (
                <button data-nav className="ctrl" onClick={doReset}>
                  Reset
                </button>
              )}
              <button
                data-nav
                className="ctrl home"
                aria-label="Home"
                onClick={() => {
                  onHome?.();
                  setStarted(false);
                  // Re-entering from the key screen should show the opening card again
                  // when no progress was made (still on the start node), or resume the
                  // mid-story node otherwise — same rule as the initial mount.
                  setBegan(openingPassed());
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M3 10.5 12 3l9 7.5M5.25 9v10.5h4.5V14h4.5v5.5h4.5V9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
      {/* <div className="bar bottom" /> */}

      {started && began && <ProgressTracker file={file} visited={state.game.visited} />}

      <DiceRoll roll={pending?.roll ?? null} onContinue={cont} />
      {/* Opening title card: sits over the (muted, autoplaying) first-node stage
          until the player clicks Begin. Only when this story defines openingText. */}
      {started && !began && file.openingText && (
        <OpeningScreen text={file.openingText} onBegin={() => setBegan(true)} />
      )}
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
