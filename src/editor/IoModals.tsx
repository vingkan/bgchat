import { useEffect, useMemo, useState } from 'react';
import type { StoryFile } from '../story/types';
import { structuralErrors } from '../engine/validation';
import { fromStoryFile, toStoryFile, type EditorState } from './model';

// ─── Export ──────────────────────────────────────────────────────────────────
// Shows the clean StoryFile JSON and copies it to the clipboard on open.

export function ExportModal({ state, onClose }: { state: EditorState; onClose: () => void }) {
  const json = useMemo(() => JSON.stringify(toStoryFile(state), null, 2), [state]);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  // Copy immediately on open — the whole point of Export is "give me the JSON".
  useEffect(() => {
    void copy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="Export story" onClose={onClose}>
      <p className="ed-modal-sub">
        Paste this into a new file under <code>src/story/</code> and register its key.
        {copied === 'ok' && <span className="ed-copied"> · Copied to clipboard</span>}
        {copied === 'fail' && <span className="ed-copyfail"> · Copy failed — select all and copy</span>}
      </p>
      <textarea className="ed-json" readOnly value={json} onFocus={(e) => e.target.select()} />
      <div className="ed-modal-actions">
        <button onClick={copy}>Copy again</button>
        <button className="primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

// ─── Import ──────────────────────────────────────────────────────────────────
// Paste a StoryFile JSON, validate, and load it onto the canvas (auto-laid-out).

export function ImportModal({
  onClose,
  onLoad,
}: {
  onClose: () => void;
  onLoad: (state: EditorState) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = () => {
    let parsed: StoryFile;
    try {
      parsed = JSON.parse(text) as StoryFile;
    } catch (err) {
      setError(`Not valid JSON: ${(err as Error).message}`);
      return;
    }
    if (!parsed || typeof parsed !== 'object' || typeof parsed.nodes !== 'object') {
      setError('That JSON is not a StoryFile (missing a "nodes" object).');
      return;
    }
    // Non-blocking: a half-wired story (empty targets) can still be imported.
    setWarnings(structuralErrors(parsed));
    onLoad(fromStoryFile(parsed));
  };

  return (
    <Modal title="Import story" onClose={onClose}>
      <p className="ed-modal-sub">Paste a StoryFile JSON. Nodes get auto-arranged by depth.</p>
      <textarea
        className="ed-json"
        placeholder='{ "start": "gate", "nodes": { … } }'
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
      />
      {error && <p className="ed-modal-err">{error}</p>}
      {warnings.length > 0 && (
        <p className="ed-modal-warn">Loaded with {warnings.length} dangling reference(s) to fix.</p>
      )}
      <div className="ed-modal-actions">
        <button onClick={onClose}>Cancel</button>
        <button className="primary" onClick={load} disabled={!text.trim()}>
          Load onto canvas
        </button>
      </div>
    </Modal>
  );
}

// ─── Shared shell ──────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="ed-modal-backdrop" onPointerDown={onClose}>
      <div className="ed-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="ed-modal-head">
          <span>{title}</span>
          <button className="ed-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
