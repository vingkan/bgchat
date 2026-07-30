interface Props {
  onBegin: () => void;
}

// The autoplay gate. Browsers block programmatic video playback until a user
// gesture; this title card provides that gesture. Clicking Begin unlocks playback
// for the session (videos still default muted, with a mute toggle in the player).
export function BeginGate({ onBegin }: Props) {
  return (
    <div className="begin-gate">
      <div className="begin-inner">
        <div className="end-rule" />
        <h1 className="begin-title">bgchat</h1>
        <p className="begin-sub">A branching tale. Your words, and the dice, decide.</p>
        <button className="continue visible" onClick={onBegin} autoFocus>
          Begin
        </button>
      </div>
    </div>
  );
}
