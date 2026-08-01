import { useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, StoryFile } from '../story/types';
import { deriveProgress } from '../engine/progress';

// Fires a one-shot `true` for ~700ms whenever `value` increases, so a freshly
// unlocked scene/character gets a gold pulse. The tracked element stays mounted
// across renders, so the CSS width-transition on the bar keeps animating too.
function usePulse(value: number): boolean {
  const [pulse, setPulse] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value > prev.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 700);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return pulse;
}

function Count({ unlocked, total }: { unlocked: number; total: number }) {
  return (
    <span className="progress-count">
      <span className="num">{unlocked}</span> <span className="den">/ {total}</span>
    </span>
  );
}

function Bar({ unlocked, total, flash }: { unlocked: number; total: number; flash: boolean }) {
  const width = total === 0 ? 0 : (unlocked / total) * 100;
  const done = total > 0 && unlocked >= total;
  return (
    <div className={`progress-bar${done ? ' complete' : ''}${flash ? ' flash' : ''}`}>
      <div className="fill" style={{ width: `${width}%` }} />
    </div>
  );
}

// The top-right "Quiet Ledger" HUD: EXPLORED %, then scenes (always a bar) and
// characters (diamonds when few unique speakers, a bar when many).
export function ProgressTracker({ file, visited }: { file: StoryFile; visited: NodeId[] }) {
  const p = useMemo(() => deriveProgress(file, visited), [file, visited]);
  const scenePulse = usePulse(p.scenes.unlocked);
  const charPulse = usePulse(p.characters.unlocked);

  const { characters: c } = p;
  const charsDone = c.total > 0 && c.unlocked >= c.total;

  return (
    <div className="progress" aria-label="Exploration progress">
      <div className="progress-head">
        Explored <span className="pct">{p.percent}%</span>
      </div>

      <div className="progress-grp">
        <div className="progress-grp-head">
          <span className="progress-lbl">Scenes</span>
          <Count unlocked={p.scenes.unlocked} total={p.scenes.total} />
        </div>
        <Bar unlocked={p.scenes.unlocked} total={p.scenes.total} flash={scenePulse} />
      </div>

      <div className="progress-grp">
        <div className="progress-grp-head">
          <span className="progress-lbl">Characters</span>
          <Count unlocked={c.unlocked} total={c.total} />
        </div>
        {c.useIcons ? (
          <div
            className={`progress-pips${charsDone ? ' complete' : ''}${charPulse ? ' flash' : ''}`}
          >
            {Array.from({ length: c.total }, (_, i) => (
              <span key={i} className={`pip${i < c.unlocked ? ' on' : ''}`}>
                ◆
              </span>
            ))}
          </div>
        ) : (
          <Bar unlocked={c.unlocked} total={c.total} flash={charPulse} />
        )}
      </div>
    </div>
  );
}
