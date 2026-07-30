import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { AbilityPanel } from './AbilityPanel';
import { ExportModal, ImportModal } from './IoModals';
import { NodeCard } from './NodeCard';
import {
  clearSession,
  initialState,
  loadFromSession,
  reducer,
  saveToSession,
  type Action,
  type EditorState,
  type Handle,
} from './model';
import './editor.css';

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  handle: Handle;
}

// Live drag interaction. Held in a ref so pointermove doesn't re-render for pan/move.
type Interaction =
  | { mode: 'pan'; startX: number; startY: number; vpX: number; vpY: number }
  | { mode: 'move'; id: string; startX: number; startY: number; nodeX: number; nodeY: number; scale: number }
  | { mode: 'connect'; id: string; index: number; handle: Handle; startWorld: { x: number; y: number } }
  | null;

type SaveStatus = 'saved' | 'saving';

export function EditorPage() {
  const [state, dispatchRaw] = useReducer(reducer, undefined, () => loadFromSession() ?? initialState());
  const dispatch = dispatchRaw as (a: Action | EditorState) => void;

  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [edges, setEdges] = useState<Edge[]>([]);
  const [connectLine, setConnectLine] = useState<Edge | null>(null);
  const [save, setSave] = useState<SaveStatus>('saved');
  const [modal, setModal] = useState<'import' | 'export' | null>(null);
  const [showAbilities, setShowAbilities] = useState(false);
  const [restored, setRestored] = useState(() => {
    const s = loadFromSession();
    return !!s && Object.keys(s.nodes).length > 0;
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const interaction = useRef<Interaction>(null);
  const vpRef = useRef(vp);
  vpRef.current = vp;
  // Latest state for use inside stable (useCallback) pointer handlers.
  const stateRef = useRef(state);
  stateRef.current = state;

  const existingIds = state.order;

  // ── Coordinate helpers ──────────────────────────────────────────────────
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const v = vpRef.current;
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - v.x) / v.scale, y: (clientY - rect.top - v.y) / v.scale };
  }, []);

  const elWorldCenter = (el: Element, rect: DOMRect, v: Viewport, anchorLeft = false) => {
    const r = el.getBoundingClientRect();
    const cx = (anchorLeft ? r.left : r.left + r.width / 2) - rect.left;
    const cy = r.top + r.height / 2 - rect.top;
    return { x: (cx - v.x) / v.scale, y: (cy - v.y) / v.scale };
  };

  // ── Recompute edges from the DOM after any layout-affecting change ─────────
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const next: Edge[] = [];
    for (const id of state.order) {
      const node = state.nodes[id];
      if (!node) continue;
      node.choices.forEach((c, i) => {
        const links: { handle: Handle; target: string }[] =
          c.kind === 'check'
            ? [
                { handle: 'success', target: c.onSuccess },
                { handle: 'failure', target: c.onFailure },
              ]
            : [{ handle: 'next', target: c.next }];
        for (const { handle, target } of links) {
          if (!target || !state.nodes[target]) continue;
          const from = canvas.querySelector(`[data-handle="${id}|${i}|${handle}"]`);
          const to = canvas.querySelector(`[data-node-box="${target}"]`);
          if (!from || !to) continue;
          const p1 = elWorldCenter(from, rect, vp);
          const p2 = elWorldCenter(to, rect, vp, true);
          next.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, handle });
        }
      });
    }
    setEdges(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nodes, state.order, state.selectedId, vp]);

  // ── Autosave (debounced) to sessionStorage ────────────────────────────────
  useEffect(() => {
    setSave('saving');
    const t = setTimeout(() => {
      saveToSession(state);
      setSave('saved');
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nodes, state.order, state.skillMods, state.start]);

  // ── Global pointer handling for pan / move / connect ──────────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const it = interaction.current;
      if (!it) return;
      if (it.mode === 'pan') {
        setVp((v) => ({ ...v, x: it.vpX + (e.clientX - it.startX), y: it.vpY + (e.clientY - it.startY) }));
      } else if (it.mode === 'move') {
        const dx = (e.clientX - it.startX) / it.scale;
        const dy = (e.clientY - it.startY) / it.scale;
        dispatch({ type: 'moveNode', id: it.id, x: it.nodeX + dx, y: it.nodeY + dy });
      } else if (it.mode === 'connect') {
        const w = screenToWorld(e.clientX, e.clientY);
        setConnectLine({ x1: it.startWorld.x, y1: it.startWorld.y, x2: w.x, y2: w.y, handle: it.handle });
      }
    };
    const onUp = (e: PointerEvent) => {
      const it = interaction.current;
      interaction.current = null;
      setConnectLine(null);
      if (it?.mode === 'connect') {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const box = el?.closest('[data-node-box]');
        const target = box?.getAttribute('data-node-box');
        if (target && target !== it.id) {
          dispatch({ type: 'connect', id: it.id, index: it.index, handle: it.handle, target });
        }
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenToWorld]);

  // ── Handlers passed down ──────────────────────────────────────────────────
  const onHeaderDown = useCallback((id: string, e: React.PointerEvent) => {
    const node = stateRef.current.nodes[id];
    if (!node) return;
    interaction.current = {
      mode: 'move',
      id,
      startX: e.clientX,
      startY: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
      scale: vpRef.current.scale,
    };
  }, []);

  const onHandleDown = useCallback(
    (id: string, index: number, handle: Handle, e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!canvas || !rect) return;
      const el = canvas.querySelector(`[data-handle="${id}|${index}|${handle}"]`);
      const start = el ? elWorldCenter(el, rect, vpRef.current) : screenToWorld(e.clientX, e.clientY);
      interaction.current = { mode: 'connect', id, index, handle, startWorld: start };
      const w = screenToWorld(e.clientX, e.clientY);
      setConnectLine({ x1: start.x, y1: start.y, x2: w.x, y2: w.y, handle });
    },
    [screenToWorld],
  );

  const onCanvasDown = (e: React.PointerEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('ed-world')) {
      dispatch({ type: 'selectNode', id: null });
      interaction.current = { mode: 'pan', startX: e.clientX, startY: e.clientY, vpX: vp.x, vpY: vp.y };
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale = Math.min(2.5, Math.max(0.25, vp.scale * factor));
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    // Keep the world point under the cursor fixed while zooming.
    const wx = (sx - vp.x) / vp.scale;
    const wy = (sy - vp.y) / vp.scale;
    setVp({ scale: newScale, x: sx - wx * newScale, y: sy - wy * newScale });
  };

  const addNode = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 400;
    const cy = rect ? rect.height / 2 : 300;
    const w = screenToWorld((rect?.left ?? 0) + cx, (rect?.top ?? 0) + cy);
    // Cascade each new node so they never stack exactly on top of each other.
    const off = (state.order.length % 6) * 34;
    dispatch({ type: 'addNode', x: Math.round(w.x - 130 + off), y: Math.round(w.y - 70 + off) });
  };

  const startFresh = () => {
    dispatch({ type: 'load', state: initialState() });
    clearSession();
    setRestored(false);
  };

  return (
    <div className="ed-root">
      <header className="ed-toolbar">
        <span className="ed-brand">bgchat · story editor</span>
        <button onClick={addNode}>+ Node</button>
        <button className={showAbilities ? 'on' : ''} onClick={() => setShowAbilities((s) => !s)}>
          Abilities
        </button>
        <button onClick={() => setModal('import')}>Import</button>
        <button onClick={() => setModal('export')}>Export</button>
        <span className="ed-spacer" />
        <span className={`ed-save ${save}`}>{save === 'saving' ? '● Saving…' : '● Saved'}</span>
      </header>

      {restored && (
        <div className="ed-restored">
          Restored your last session.
          <button onClick={() => setRestored(false)}>Keep</button>
          <button onClick={startFresh}>Start fresh</button>
        </div>
      )}

      <div
        ref={canvasRef}
        className="ed-canvas"
        onPointerDown={onCanvasDown}
        onWheel={onWheel}
      >
        <div className="ed-world" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})` }}>
          <svg className="ed-edges" aria-hidden>
            {edges.map((e, i) => (
              <EdgePath key={i} edge={e} />
            ))}
            {connectLine && <EdgePath edge={connectLine} live />}
          </svg>

          {state.order.map((id) => {
            const node = state.nodes[id];
            if (!node) return null;
            return (
              <NodeCard
                key={id}
                node={node}
                selected={state.selectedId === id}
                isStart={state.start === id}
                existingIds={existingIds}
                dispatch={dispatch}
                onSelect={(nid) => dispatch({ type: 'selectNode', id: nid })}
                onHeaderDown={onHeaderDown}
                onHandleDown={onHandleDown}
              />
            );
          })}
        </div>

        {state.order.length === 0 && (
          <div className="ed-empty">
            <p>Empty canvas.</p>
            <p>Hit “+ Node” to drop your first beat. Drag a choice’s handle onto another node to wire it up.</p>
          </div>
        )}
      </div>

      {showAbilities && (
        <AbilityPanel skillMods={state.skillMods} dispatch={dispatch} onClose={() => setShowAbilities(false)} />
      )}
      {modal === 'export' && <ExportModal state={state} onClose={() => setModal(null)} />}
      {modal === 'import' && (
        <ImportModal
          onClose={() => setModal(null)}
          onLoad={(s) => {
            dispatch({ type: 'load', state: s });
            setModal(null);
            setRestored(false);
          }}
        />
      )}
    </div>
  );
}

function EdgePath({ edge, live }: { edge: Edge; live?: boolean }) {
  const { x1, y1, x2, y2 } = edge;
  const dx = Math.max(40, Math.abs(x2 - x1) / 2);
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  return <path className={`ed-edge ${edge.handle}${live ? ' live' : ''}`} d={d} />;
}
