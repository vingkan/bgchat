import { useState } from 'react';

interface Props {
  // Reports the typed story key (may be empty). Returns false if the key is
  // unknown, so the gate can surface an error and stay put.
  onBegin: (key: string) => boolean;
}

// The autoplay gate. Browsers block programmatic video playback until a user
// gesture; this title card provides that gesture. Clicking Begin unlocks playback
// for the session (videos still default muted, with a mute toggle in the player).
// The key input routes to a specific story; empty begins the default story.
export function BeginGate({ onBegin }: Props) {
  const [key, setKey] = useState('');
  const [error, setError] = useState(false);

  const submit = () => {
    if (!onBegin(key)) setError(true);
  };

  return (
    <div className="begin-gate">
      <div className="begin-inner">
        <div className="end-rule" />
        <h1 className="begin-title">Story</h1>
        <p className="begin-sub">Your words, and the dice, decide.</p>
        <input
          className="begin-key"
          type="text"
          value={key}
          maxLength={8}
          autoFocus
          placeholder="Story code"
          aria-label="Story code"
          spellCheck={false}
          autoCapitalize="characters"
          onChange={(e) => {
            setKey(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        {error && (
          <p className="begin-error" role="alert">
            No story with that code.
          </p>
        )}
        <button className="continue visible" onClick={submit}>
          Begin
        </button>
      </div>
      <a className="editor-link" href="?editor">
        Story Editor ✎
      </a>
    </div>
  );
}
