import { memo, useEffect, useRef, useState } from 'react';
import type { Choice } from '../story/types';
import {
  DC_TIERS,
  SKILL_GROUPS,
  SKILL_TO_ABILITY,
  VIDEOS,
  type Action,
  type EditorNode,
  type Handle,
} from './model';

interface Props {
  node: EditorNode;
  selected: boolean;
  isStart: boolean;
  existingIds: string[];
  dispatch: (a: Action) => void;
  onSelect: (id: string) => void;
  onHeaderDown: (id: string, e: React.PointerEvent) => void;
  onHandleDown: (id: string, index: number, handle: Handle, e: React.PointerEvent) => void;
}

// A single node on the canvas. Read-only unless `selected` — only the selected
// node mounts live inputs, so a large tree stays snappy (memoized on top of that).
// The ID is the card's defining title (top); the speaker lives lower in the body.
function NodeCardImpl({
  node,
  selected,
  isStart,
  existingIds,
  dispatch,
  onSelect,
  onHeaderDown,
  onHandleDown,
}: Props) {
  return (
    <div
      className={`ed-node${selected ? ' selected' : ''}${isStart ? ' start' : ''}`}
      style={{ left: node.x, top: node.y }}
      data-node-box={node.id}
      onPointerDown={() => onSelect(node.id)}
    >
      <div className="ed-node-head" onPointerDown={(e) => onHeaderDown(node.id, e)}>
        <span className="ed-grip" aria-hidden>
          ⠿
        </span>
        {selected ? (
          <IdField node={node} existingIds={existingIds} dispatch={dispatch} />
        ) : (
          <span className="ed-id-title">#{node.id}</span>
        )}
        {isStart && <span className="ed-start-badge">START</span>}
        {selected && (
          <span className="ed-node-icons" onPointerDown={(e) => e.stopPropagation()}>
            {!isStart && (
              <button
                className="ed-icon"
                title="Make this the story's first node"
                onClick={() => dispatch({ type: 'setStart', id: node.id })}
              >
                ★
              </button>
            )}
            <button
              className="ed-icon ed-danger"
              title="Delete node"
              onClick={() => dispatch({ type: 'deleteNode', id: node.id })}
            >
              🗑
            </button>
          </span>
        )}
      </div>

      {selected ? (
        <EditBody node={node} dispatch={dispatch} />
      ) : (
        <ReadBody node={node} onHandleDown={onHandleDown} />
      )}
    </div>
  );
}

// ─── Read-only body ──────────────────────────────────────────────────────────

function ReadBody({
  node,
  onHandleDown,
}: {
  node: EditorNode;
  onHandleDown: Props['onHandleDown'];
}) {
  return (
    <>
      <div className="ed-node-meta">
        {node.video ? <Thumb src={node.video} /> : <span className="ed-novid">no clip</span>}
        <span className="ed-speaker-ro">{node.speaker || 'Unnamed speaker'}</span>
      </div>
      <p className="ed-text-ro">{node.text || <span className="ed-dim">(no line yet)</span>}</p>
      <ul className="ed-choices">
        {node.choices.map((c, i) => (
          <li key={i} className="ed-choice-ro">
            <span className="ed-choice-label">
              {c.kind === 'check' && <span className="ed-dc-badge">{c.skill} · {c.dc}</span>}
              {c.label || <span className="ed-dim">(empty choice)</span>}
            </span>
            <HandleSet node={node} index={i} choice={c} onHandleDown={onHandleDown} />
          </li>
        ))}
        {node.choices.length === 0 && <li className="ed-ending">◆ ending</li>}
      </ul>
    </>
  );
}

// ─── Editable body ───────────────────────────────────────────────────────────

function EditBody({ node, dispatch }: { node: EditorNode; dispatch: (a: Action) => void }) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div className="ed-edit" onPointerDown={stop}>
      <div className="ed-row">
        <label className="ed-field">
          <span>Video</span>
          <select
            value={node.video}
            onChange={(e) => dispatch({ type: 'patchNode', id: node.id, patch: { video: e.target.value } })}
          >
            <option value="">— none —</option>
            {VIDEOS.map((v) => (
              <option key={v} value={v}>
                {v.replace('/video/', '')}
              </option>
            ))}
          </select>
        </label>
        {node.video && <Thumb src={node.video} />}
      </div>

      <label className="ed-field">
        <span>Speaker</span>
        <input
          className="ed-speaker"
          value={node.speaker}
          placeholder="Who's talking"
          onChange={(e) => dispatch({ type: 'patchNode', id: node.id, patch: { speaker: e.target.value } })}
        />
      </label>

      <label className="ed-field">
        <span>Line</span>
        <textarea
          className="ed-textarea"
          value={node.text}
          placeholder="What the speaker says…"
          rows={3}
          onChange={(e) => dispatch({ type: 'patchNode', id: node.id, patch: { text: e.target.value } })}
        />
      </label>

      <div className="ed-choices-edit">
        {node.choices.map((c, i) => (
          <ChoiceEditor key={i} node={node} index={i} choice={c} dispatch={dispatch} />
        ))}
      </div>

      <div className="ed-choice-add">
        <button onClick={() => dispatch({ type: 'addChoice', id: node.id })}>+ choice</button>
      </div>
    </div>
  );
}

function IdField({
  node,
  existingIds,
  dispatch,
}: {
  node: EditorNode;
  existingIds: string[];
  dispatch: (a: Action) => void;
}) {
  const [draft, setDraft] = useState(node.id);
  useEffect(() => setDraft(node.id), [node.id]);
  const trimmed = draft.trim();
  const collision = trimmed !== node.id && existingIds.includes(trimmed);
  const commit = () => {
    if (!collision && trimmed) dispatch({ type: 'renameNode', id: node.id, newId: trimmed });
    else setDraft(node.id);
  };
  return (
    <span className="ed-id-wrap">
      <span className="ed-id-hash">#</span>
      <input
        className={`ed-id-input${collision ? ' invalid' : ''}`}
        value={draft}
        spellCheck={false}
        title={collision ? 'That ID is taken' : 'Node ID'}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </span>
  );
}

function ChoiceEditor({
  node,
  index,
  choice,
  dispatch,
}: {
  node: EditorNode;
  index: number;
  choice: Choice;
  dispatch: (a: Action) => void;
}) {
  const [popover, setPopover] = useState(false);
  const isCheck = choice.kind === 'check';

  const openDc = () => {
    if (!isCheck) dispatch({ type: 'setCheck', id: node.id, index, on: true });
    setPopover(true);
  };

  return (
    <div className="ed-choice-edit">
      <input
        className="ed-choice-input"
        value={choice.label}
        placeholder="Choice text…"
        onChange={(e) => dispatch({ type: 'patchChoice', id: node.id, index, patch: { label: e.target.value } })}
      />
      <span className="ed-dc-anchor">
        <button
          className={`ed-dc-badge-btn${isCheck ? ' on' : ''}`}
          title={isCheck ? 'Edit difficulty check' : 'Add a difficulty check'}
          onClick={openDc}
        >
          {isCheck && choice.kind === 'check' ? `${choice.skill} · ${choice.dc}` : '+ DC'}
        </button>
        {popover && isCheck && choice.kind === 'check' && (
          <ChoiceDcPopover
            skill={choice.skill}
            dc={choice.dc}
            onSkill={(skill) => dispatch({ type: 'patchChoice', id: node.id, index, patch: { skill } })}
            onDc={(dc) => dispatch({ type: 'patchChoice', id: node.id, index, patch: { dc } })}
            onRemove={() => {
              dispatch({ type: 'setCheck', id: node.id, index, on: false });
              setPopover(false);
            }}
            onClose={() => setPopover(false)}
          />
        )}
      </span>
      <button
        className="ed-choice-del"
        title="Remove choice"
        onClick={() => dispatch({ type: 'removeChoice', id: node.id, index })}
      >
        ×
      </button>
    </div>
  );
}

// ─── DC popover ──────────────────────────────────────────────────────────────
// Compact editor for a choice's check: pick the skill (grouped by ability), the
// DC tier, or remove the check entirely. Closes on outside click / Esc.

function ChoiceDcPopover({
  skill,
  dc,
  onSkill,
  onDc,
  onRemove,
  onClose,
}: {
  skill: string;
  dc: number;
  onSkill: (skill: string) => void;
  onDc: (dc: number) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="ed-dc-popover" ref={ref} onPointerDown={(e) => e.stopPropagation()}>
      <label className="ed-field">
        <span>Skill ({SKILL_TO_ABILITY[skill]})</span>
        <select value={skill} onChange={(e) => onSkill(e.target.value)}>
          {SKILL_GROUPS.map((g) => (
            <optgroup key={g.ability} label={g.ability}>
              {g.skills.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="ed-field">
        <span>Difficulty</span>
        <select value={dc} onChange={(e) => onDc(Number(e.target.value))}>
          {DC_TIERS.map((t) => (
            <option key={t.name} value={t.dc}>
              {t.name} ({t.dc})
            </option>
          ))}
        </select>
      </label>
      <button className="ed-dc-remove" onClick={onRemove}>
        Remove check
      </button>
    </div>
  );
}

// ─── Handles (read view only) ────────────────────────────────────────────────
// Drag a handle onto another node to wire the transition. A simple choice has one
// handle (→); a check has two (✓ pass / ✗ fail). Shown only on collapsed cards.

function HandleSet({
  node,
  index,
  choice,
  onHandleDown,
}: {
  node: EditorNode;
  index: number;
  choice: Choice;
  onHandleDown: Props['onHandleDown'];
}) {
  if (choice.kind === 'check') {
    return (
      <span className="ed-handles">
        <HandleDot node={node} index={index} handle="success" target={choice.onSuccess} label="✓" onHandleDown={onHandleDown} />
        <HandleDot node={node} index={index} handle="failure" target={choice.onFailure} label="✗" onHandleDown={onHandleDown} />
      </span>
    );
  }
  return (
    <span className="ed-handles">
      <HandleDot node={node} index={index} handle="next" target={choice.next} label="→" onHandleDown={onHandleDown} />
    </span>
  );
}

function HandleDot({
  node,
  index,
  handle,
  target,
  label,
  onHandleDown,
}: {
  node: EditorNode;
  index: number;
  handle: Handle;
  target: string;
  label: string;
  onHandleDown: Props['onHandleDown'];
}) {
  return (
    <button
      className={`ed-handle ${handle}${target ? ' wired' : ''}`}
      data-handle={`${node.id}|${index}|${handle}`}
      title={target ? `→ ${target}` : 'Drag onto a node to connect'}
      onPointerDown={(e) => {
        e.stopPropagation();
        onHandleDown(node.id, index, handle, e);
      }}
    >
      <span className="ed-handle-label">{label}</span>
      <span className="ed-handle-dot" />
    </button>
  );
}

function Thumb({ src }: { src: string }) {
  // Stored paths are root-relative ("/video/x.mp4"); the app serves under a base
  // ("/bgchat"), so prefix the base for the preview (src keeps its leading slash,
  // matching VideoStage's `/bgchat${src}`). Export keeps the raw path.
  const resolved = import.meta.env.BASE_URL.replace(/\/$/, '') + src;
  return <video className="ed-thumb" src={resolved} muted preload="metadata" playsInline aria-hidden />;
}

export const NodeCard = memo(NodeCardImpl);
