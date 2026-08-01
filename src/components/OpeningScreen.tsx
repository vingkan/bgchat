import { useEffect } from 'react';
import { useGamepad } from '../input/useGamepad';

interface Props {
  // The story's intro copy (StoryFile.openingText).
  text: string;
  // Enter the first node.
  onBegin: () => void;
}

// The opening title card: a story-specific intro shown before the first node, on a
// fresh start and after Restart/Reset. Reuses the BeginGate's "Cinematic Letterbox"
// shell so the two gates feel like one visual language.
//
// The card owns its own input while it's up (the player's roving-cursor nav is
// disabled until `began`), mirroring the dice overlay: Enter/Space or a controller's
// ✕/A confirm Begin.
//
// Arm-on-keyup: keydowns are ignored until we've seen one keyup, so the key that
// unlocked the story code (the gate's own Enter) must be RELEASED before any press can
// dismiss this freshly-mounted card. The unlock press flips `started` and mounts this
// card; its own keydown never reaches us (our listener attaches after paint), but its
// keyup-less tail / auto-repeat while held would — and that carry-over is what flashed
// the opening straight past to the first node. One physical press = one keydown-run +
// one keyup, so a single Enter can never both unlock and dismiss. A fresh, deliberate
// Enter/Space still advances (and the button is not autofocused, avoiding a native
// re-activation path). Controller select comes in via useGamepad below.
export function OpeningScreen({ text, onBegin }: Props) {
  useEffect(() => {
    let armed = false;
    const onUp = () => {
      armed = true;
    };
    const onKey = (e: KeyboardEvent) => {
      if (!armed) return; // the unlocking key hasn't been released yet
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onBegin();
      }
    };
    window.addEventListener('keyup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [onBegin]);

  useGamepad(true, (btn) => {
    if (btn === 'select') onBegin();
  });

  return (
    <div className="begin-gate opening">
      <div className="begin-inner">
        <div className="end-rule" />
        <p className="opening-text">{text}</p>
        <button className="continue visible" onClick={onBegin}>
          Begin
        </button>
      </div>
    </div>
  );
}
