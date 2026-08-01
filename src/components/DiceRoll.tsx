import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { RollResult } from '../engine/engine';

interface Props {
  roll: RollResult | null; // non-null => overlay is up, staged and animating
  onContinue: () => void;
}

// When the die "lands" and we reveal the math/result. The Heavy Drop tween runs
// for this long; the reveal is driven by this timer (not the animation promise)
// so it stays deterministic under jsdom, where there's no real animation clock.
const IMPACT_MS = 500;

// Best-effort decorative animation. Framer Motion's imperative animate() is pure
// theater here — if it ever no-ops or throws (e.g. a headless env), the reveal
// timer above still fires, so the roll is never blocked on it.
function play(run: () => void) {
  try {
    run();
  } catch {
    /* animation is decorative; never let it break the roll */
  }
}

// The dice overlay. Pure theater over an already-computed RollResult. "Heavy Drop"
// (chosen via /design-shotgun): the die slams down from above with a scale bloom
// and a decaying two-axis shake on impact, then springs to a clean upright rest.
// Continue commits the staged transition (handled by the reducer). Enter/Space too.
export function DiceRoll({ roll, onContinue }: Props) {
  const [dieScope, animate] = useAnimate();
  const [face, setFace] = useState<number | string>('?');
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState(false); // gold impact ripple, plays once on land
  const btnRef = useRef<HTMLButtonElement>(null);

  // Reset the reveal state SYNCHRONOUSLY when a new roll arrives, i.e. during render
  // (before paint) rather than in the effect below. This component stays mounted across
  // rolls (only the overlay mounts/unmounts via AnimatePresence), so without this the
  // previous roll's revealed/face/result would paint for a frame on the next roll's first
  // frame — the flash. `roll` is a fresh object per RESOLVE_CHECK, so identity compare is safe.
  const [prevRoll, setPrevRoll] = useState<RollResult | null>(roll);
  if (roll !== prevRoll) {
    setPrevRoll(roll);
    setRevealed(false);
    setFace('?');
    setFlash(false);
  }

  useEffect(() => {
    if (!roll) return;
    const flicker = setInterval(() => setFace(Math.floor(Math.random() * 20) + 1), 45);
    const el = dieScope.current;
    let ripple: ReturnType<typeof setTimeout> | undefined;

    // Reveal is timer-driven and independent of the animation below.
    const done = setTimeout(() => {
      clearInterval(flicker);
      setFace(roll.die);
      setRevealed(true);
      // gold ring ripple on impact; retract the class so the next roll replays it.
      setFlash(true);
      ripple = setTimeout(() => setFlash(false), 620);
      play(() => {
        // On the same element: Motion composes independent transform axes, so the
        // x/y impact shake and the rotate/scale settle spring run concurrently.
        void animate(
          el,
          { x: [0, -7, 6, -4, 3, 0], y: [0, 6, -4, 2, 0] },
          { duration: 0.46, ease: 'easeOut' },
        );
        void animate(
          el,
          { rotate: 360, scale: [1.16, 1] },
          { type: 'spring', stiffness: 500, damping: 15 },
        );
      });
    }, IMPACT_MS);

    // The drop itself: accelerate down from above (ease-in), scale bloom on impact.
    // rotate ends at 400 so the settle spring can resolve it to 360 (upright).
    play(() => {
      void animate(
        el,
        { y: [-340, 0], rotate: [0, 400], scale: [0.55, 1.28, 1], opacity: [0, 1, 1] },
        { duration: IMPACT_MS / 1000, ease: [0.55, 0, 0.85, 1] },
      );
    });

    return () => {
      clearInterval(flicker);
      clearTimeout(done);
      clearTimeout(ripple);
    };
  }, [roll, animate, dieScope]);

  useEffect(() => {
    if (revealed) btnRef.current?.focus();
  }, [revealed]);

  useEffect(() => {
    if (!roll) return;
    const onKey = (e: KeyboardEvent) => {
      if (revealed && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [roll, revealed, onContinue]);

  const mod = roll ? (roll.modifier >= 0 ? '+' : '−') + Math.abs(roll.modifier) : '';
  const critLead =
    roll?.crit === 'success' ? 'Natural 20 — ' : roll?.crit === 'failure' ? 'Natural 1 — ' : '';

  return (
    <AnimatePresence>
      {roll && (
        <motion.div
          className="overlay"
          role="dialog"
          aria-label="Skill check"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="roll-wrap">
            <div className="roll-check">
              {roll.skill} — DC {roll.dc}
            </div>
            <div className="die-stage">
              {/* ripple lives outside .die so it doesn't inherit the die's
                  scale/shake/rotate — it emanates from the landing point. */}
              <div className={`roll-flash ${flash ? 'on' : ''}`} aria-hidden="true" />
              <div className="die" ref={dieScope}>
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <polygon className="poly" points="50,4 92,28 92,72 50,96 8,72 8,28" />
                  <polygon className="poly" points="50,4 92,72 8,72" />
                  <polygon className="poly" points="50,4 92,28 92,72" />
                  <polygon className="poly" points="50,4 8,28 8,72" />
                  <polygon className="poly" points="8,72 50,96 92,72" />
                </svg>
                <div className="val">{face}</div>
              </div>
            </div>
            <div className={`roll-math ${revealed ? 'visible' : ''}`}>
              {critLead}Roll {roll.die} {mod} = {roll.total} vs DC {roll.dc}
            </div>
            <div
              className={`roll-result ${revealed ? 'visible' : ''} ${
                roll.success ? 'success' : 'failure'
              }`}
            >
              {roll.success ? 'Success' : 'Failure'}
            </div>
            <button
              ref={btnRef}
              className={`continue ${revealed ? 'visible' : ''}`}
              onClick={onContinue}
            >
              Continue
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
