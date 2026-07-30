import { useAnimate } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './DiceLab.css';

// DEV-ONLY dice animation lab. Four live Framer Motion prototypes of a "grand,
// spring-physics" d20 roll, side by side, each independently re-rollable. This is
// a design surface, not shipped code — it never imports from ../components and is
// mounted behind ?diceProto (import.meta.env.DEV guard in App.tsx).

interface Roll {
  die: number;
  modifier: number;
  dc: number;
  total: number;
  success: boolean;
  crit: 'success' | 'failure' | null;
}

function rollOnce(): Roll {
  const die = Math.floor(Math.random() * 20) + 1;
  const modifier = 3;
  const dc = 12;
  const total = die + modifier;
  const crit = die === 20 ? 'success' : die === 1 ? 'failure' : null;
  const success = crit === 'success' ? true : crit === 'failure' ? false : total >= dc;
  return { die, modifier, dc, total, success, crit };
}

function DieSvg() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <polygon className="poly" points="50,4 92,28 92,72 50,96 8,72 8,28" />
      <polygon className="poly" points="50,4 92,72 8,72" />
      <polygon className="poly" points="50,4 92,28 92,72" />
      <polygon className="poly" points="50,4 8,28 8,72" />
      <polygon className="poly" points="8,72 50,96 92,72" />
    </svg>
  );
}

// Shared readout: the check label, the flickering/settled face, and the
// reveal of math + result. Matches the shipped .roll-* classes.
function Readout({ roll, revealed }: { roll: Roll | null; revealed: boolean }) {
  const mod = roll ? (roll.modifier >= 0 ? '+' : '−') + Math.abs(roll.modifier) : '';
  const critLead =
    roll?.crit === 'success' ? 'Natural 20 — ' : roll?.crit === 'failure' ? 'Natural 1 — ' : '';
  return (
    <>
      <div className={`roll-math ${revealed && roll ? 'visible' : ''}`}>
        {roll ? `${critLead}Roll ${roll.die} ${mod} = ${roll.total} vs DC ${roll.dc}` : ' '}
      </div>
      <div
        className={`roll-result ${revealed && roll ? 'visible' : ''} ${
          roll ? (roll.success ? 'success' : 'failure') : ''
        }`}
      >
        {roll ? (roll.success ? 'Success' : 'Failure') : ' '}
      </div>
    </>
  );
}

// Faces cycle every `ms` until stopped. Returns the stop function.
function startFlicker(setFace: (n: number) => void, ms: number) {
  const id = setInterval(() => setFace(Math.floor(Math.random() * 20) + 1), ms);
  return () => clearInterval(id);
}

interface VariantProps {
  name: string;
  blurb: string;
  allSignal: number; // parent's "Roll all" counter
  run: (
    scope: HTMLElement,
    animate: ReturnType<typeof useAnimate>[1],
    ctx: {
      result: Roll;
      setFace: (n: number) => void;
      reveal: () => void;
    },
  ) => Promise<void>;
  perspective?: boolean;
  extra?: (r: { flash: boolean }) => ReactNode;
  // optional hook to drive stage shake / flash from the run
  withStage?: boolean;
}

function Variant({ name, blurb, allSignal, run, perspective, extra, withStage }: VariantProps) {
  const [scope, animate] = useAnimate();
  const [face, setFace] = useState<number | string>('?');
  const [roll, setRoll] = useState<Roll | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState(false);
  const busyRef = useRef(false);

  const go = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRevealed(false);
    setRoll(null);
    setFlash(false);
    const result = rollOnce();
    await run(scope.current as HTMLElement, animate, {
      result,
      setFace,
      reveal: () => {
        setFace(result.die);
        setRoll(result);
        setRevealed(true);
        if (withStage) {
          setFlash(true);
          window.setTimeout(() => setFlash(false), 620);
        }
      },
    });
    busyRef.current = false;
  };

  // Parent "Roll all": fire when the signal changes (skip initial 0).
  useEffect(() => {
    if (allSignal > 0) void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSignal]);

  return (
    <div className="lab-cell">
      <div className="lab-head">
        <span className="lab-name">{name}</span>
        <span className="lab-blurb">{blurb}</span>
      </div>
      <div className="roll-check">Persuasion — DC 12</div>
      <div className={`lab-stage ${perspective ? 'persp' : ''}`}>
        {withStage && extra ? extra({ flash }) : null}
        <div className="die" ref={scope}>
          <DieSvg />
          <div className="val">{face}</div>
        </div>
      </div>
      <Readout roll={roll} revealed={revealed} />
      <button className="lab-roll" onClick={() => void go()}>
        Roll
      </button>
    </div>
  );
}

export function DiceLab() {
  const [allSignal, setAllSignal] = useState(0);

  return (
    <div className="dice-lab">
      <header className="lab-title">
        <h1>Dice Lab</h1>
        <p>Live Framer Motion prototypes · click any Roll to feel the physics</p>
        <button className="lab-rollall" onClick={() => setAllSignal((n) => n + 1)}>
          Roll all
        </button>
      </header>

      <div className="lab-grid">
        {/* C1 — Impact & Settle: hurls in from the side, overshoots, hard spring-back,
            stage screen-shake on impact, gold ring flash on the result. The winner so far. */}
        <Variant
          name="C1 · Impact & Settle"
          blurb="hurl-in, screen-shake, gold ring flash"
          withStage
          extra={({ flash }) => (
            <div className={`lab-flash ${flash ? 'on' : ''}`} aria-hidden="true" />
          )}
          allSignal={allSignal}
          run={async (el, animate, { setFace, reveal }) => {
            const stage = el.parentElement as HTMLElement;
            const stop = startFlicker(setFace, 45);
            // hurl in, overshooting past 720; the spring below settles back to 720
            // (upright) with a small wobble.
            await animate(
              el,
              { x: [-260, 18, 0], rotate: [0, 760], scale: [0.7, 1.12, 1], opacity: [0, 1, 1] },
              { duration: 0.6, ease: [0.16, 0.9, 0.25, 1] },
            );
            stop();
            reveal();
            // impact: quick decaying shake on the stage
            void animate(stage, { x: [0, -9, 8, -6, 4, -2, 0] }, { duration: 0.42, ease: 'easeOut' });
            await animate(
              el,
              { rotate: 720, scale: [1.08, 1] },
              { type: 'spring', stiffness: 420, damping: 12 },
            );
          }}
        />

        {/* C2 — 3D Slam: C1's entrance, but the die also tumbles in 3D as it flies
            (rotateX + rotateZ), so it reads as a solid object rolling — not just a
            spinning number. Lands face-on and upright. */}
        <Variant
          name="C2 · 3D Slam"
          blurb="hurl-in + real 3D tumble, lands face-on"
          perspective
          withStage
          extra={({ flash }) => (
            <div className={`lab-flash ${flash ? 'on' : ''}`} aria-hidden="true" />
          )}
          allSignal={allSignal}
          run={async (el, animate, { setFace, reveal }) => {
            const stage = el.parentElement as HTMLElement;
            const stop = startFlicker(setFace, 42);
            // fly in while tumbling on two axes; end near multiples of 360 so the
            // spring settle lands the face flat and right-side up.
            await animate(
              el,
              {
                x: [-240, 16, 0],
                rotateX: [0, 300, 360],
                rotateZ: [0, 560, 700],
                scale: [0.65, 1.14, 1],
                opacity: [0, 1, 1],
              },
              { duration: 0.66, ease: [0.16, 0.9, 0.25, 1] },
            );
            stop();
            reveal();
            void animate(stage, { x: [0, -10, 8, -6, 4, -2, 0] }, { duration: 0.44, ease: 'easeOut' });
            await animate(
              el,
              { rotateX: 360, rotateZ: 720, scale: [1.1, 1] },
              { type: 'spring', stiffness: 380, damping: 13 },
            );
          }}
        />

        {/* C3 — Heavy Drop: slams straight down from above with a big scale bloom and
            a two-axis shake on landing. Pure weight — translation sells the motion. */}
        <Variant
          name="C3 · Heavy Drop"
          blurb="slams down from above, heavy 2-axis shake"
          withStage
          extra={({ flash }) => (
            <div className={`lab-flash ${flash ? 'on' : ''}`} aria-hidden="true" />
          )}
          allSignal={allSignal}
          run={async (el, animate, { setFace, reveal }) => {
            const stage = el.parentElement as HTMLElement;
            const stop = startFlicker(setFace, 45);
            // accelerate downward (ease-in) then a hard stop; scale blooms on impact.
            await animate(
              el,
              { y: [-340, 0], rotate: [0, 400], scale: [0.55, 1.28, 1], opacity: [0, 1, 1] },
              { duration: 0.5, ease: [0.55, 0, 0.85, 1] },
            );
            stop();
            reveal();
            void animate(
              stage,
              { x: [0, -7, 6, -4, 3, 0], y: [0, 6, -4, 2, 0] },
              { duration: 0.46, ease: 'easeOut' },
            );
            await animate(
              el,
              { rotate: 360, scale: [1.16, 1] },
              { type: 'spring', stiffness: 500, damping: 15 },
            );
          }}
        />

        {/* D — Zero-G Snap (fixed): fade in fast, drift slowly on a moderate spring,
            then a decisive HARD snap. Previously stiffness was so low + opacity ramped
            through the same slow spring that it read as "nothing happened." */}
        <Variant
          name="D · Zero-G Snap"
          blurb="slow drift, then a hard decisive snap"
          allSignal={allSignal}
          run={async (el, animate, { setFace, reveal }) => {
            const stop = startFlicker(setFace, 80);
            // reset + become visible fast so the drift is actually seen
            await animate(el, { opacity: 0, y: 80, rotate: 0, scale: 0.85 }, { duration: 0 });
            await animate(el, { opacity: 1 }, { duration: 0.18 });
            // slow, weighty drift (moderate stiffness so it visibly moves this time)
            const drift = animate(
              el,
              { y: 0, rotate: 330, scale: 1 },
              { type: 'spring', stiffness: 55, damping: 16, mass: 2 },
            );
            window.setTimeout(() => {
              stop();
              reveal();
              // hard snap: high stiffness + high damping = sharp arrival, no wobble
              void animate(
                el,
                { rotate: 360, scale: [1.3, 1] },
                { type: 'spring', stiffness: 1000, damping: 34 },
              );
            }, 760);
            await drift;
          }}
        />
      </div>
    </div>
  );
}
