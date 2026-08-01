// Directed force layout for the editor graph.
//
// The story is a directed graph and reads best left→right by progression, so this
// is a RANK-CONSTRAINED force-directed layout: nodes get organic spacing from
// spring/repulsion forces (Fruchterman–Reingold style), but each node's x is pulled
// toward a column set by its BFS depth from `start`, so the flow always runs left to
// right. A final overlap-resolution pass guarantees no two cards touch.
//
// It is DETERMINISTIC — positions are seeded from the depth columns (no RNG) and the
// result is rounded to integers — so importing the same story, or clicking "Reformat"
// twice, produces the exact same layout.

import type { DialogueNode, NodeId, StoryFile } from '../story/types';
import { choiceTargets } from '../story/types';

// ── Tunables ─────────────────────────────────────────────────────────────────
// Raise COL_PITCH / IDEAL to spread the graph out; lower them to pack it tighter.
export const NODE_W = 340; // fixed card width (editor.css .ed-node)
const COL_PITCH = 460; // horizontal distance between depth columns (> NODE_W)
const ROW_SEED = 200; // initial vertical spacing of same-depth nodes
const IDEAL = 260; // FR ideal edge length
const ITERATIONS = 400;
const X_STIFF = 0.5; // how hard x is snapped back to its column each tick (0..1)
const MARGIN = 40; // min empty gap enforced between cards by overlap resolution
const ORIGIN = 60; // top-left of the laid-out graph in world coords

export interface NodeSize {
  w: number;
  h: number;
}
export type Positions = Record<NodeId, { x: number; y: number }>;

export interface LayoutSpec {
  ids: NodeId[];
  start: NodeId | null;
  edges: [NodeId, NodeId][]; // source → target (only between ids present here)
  sizes: Record<NodeId, NodeSize>;
}

// Estimate a card's rendered height from its content (used on import, before the
// card is in the DOM). Width is always NODE_W.
export function estimateSize(node: DialogueNode): NodeSize {
  const BASE = 120; // header + speaker + a line of text
  const PER_CHOICE = 52;
  const textLines = Math.min(6, Math.ceil((node.text?.length ?? 0) / 42));
  return { w: NODE_W, h: BASE + node.choices.length * PER_CHOICE + textLines * 16 };
}

// Build a layout spec straight from a StoryFile using estimated card sizes.
export function specFromStoryFile(file: StoryFile): LayoutSpec {
  const ids = Object.keys(file.nodes);
  const edges: [NodeId, NodeId][] = [];
  const sizes: Record<NodeId, NodeSize> = {};
  for (const id of ids) {
    const node = file.nodes[id];
    sizes[id] = estimateSize(node);
    for (const t of node.choices.flatMap(choiceTargets)) {
      if (t && file.nodes[t]) edges.push([id, t]);
    }
  }
  return { ids, start: file.start || ids[0] || null, edges, sizes };
}

// BFS depth from `start`. Unreachable nodes are parked in a trailing lane
// (maxDepth + 1) instead of piling onto column 0.
// Assign each node a column via LONGEST-PATH layering on a cycle-broken DAG (the
// standard Sugiyama layering). Unlike BFS depth (shortest path), this guarantees
// rank[u] < rank[v] for every FORWARD edge u→v, so those edges always point
// left→right — a node is never left of a node it flows into. The only backward
// edges left are genuine loops (back-edges), which we deliberately keep. Because a
// node sits one column past its longest predecessor, terminals land to the right of
// their parents and the true ending (longest path) ends up rightmost.
//
// Nodes unreachable from `start` are parked in a trailing lane to the right.
export function layerRanks(ids: NodeId[], start: NodeId | null, edges: [NodeId, NodeId][]): Record<NodeId, number> {
  const idSet = new Set(ids);
  const adj = new Map<NodeId, NodeId[]>();
  for (const id of ids) adj.set(id, []);
  for (const [s, t] of edges) {
    if (idSet.has(s) && idSet.has(t)) adj.get(s)!.push(t);
  }

  // 1. Break cycles: DFS (start first, then any unvisited node) and flag every edge
  //    that points back to a node currently on the recursion stack as a back-edge.
  const back = new Set<string>();
  const key = (s: NodeId, t: NodeId) => `${s}\u0000${t}`;
  const color = new Map<NodeId, 0 | 1 | 2>(); // 0 unseen, 1 on-stack, 2 done
  for (const id of ids) color.set(id, 0);
  const visit = (u: NodeId) => {
    color.set(u, 1);
    for (const v of adj.get(u)!) {
      const c = color.get(v);
      if (c === 1) back.add(key(u, v)); // edge to an ancestor → loop
      else if (c === 0) visit(v);
    }
    color.set(u, 2);
  };
  if (start && idSet.has(start)) visit(start);
  for (const id of ids) if (color.get(id) === 0) visit(id);

  // 2. Longest-path layering over the DAG (edges minus back-edges) via Kahn's order.
  const dag = new Map<NodeId, NodeId[]>();
  const indeg = new Map<NodeId, number>();
  for (const id of ids) {
    dag.set(id, []);
    indeg.set(id, 0);
  }
  for (const [s, t] of edges) {
    if (!idSet.has(s) || !idSet.has(t) || back.has(key(s, t))) continue;
    dag.get(s)!.push(t);
    indeg.set(t, indeg.get(t)! + 1);
  }
  const rank: Record<NodeId, number> = {};
  for (const id of ids) rank[id] = 0;
  const queue = ids.filter((id) => indeg.get(id) === 0);
  while (queue.length) {
    const u = queue.shift() as NodeId;
    for (const v of dag.get(u)!) {
      if (rank[u] + 1 > rank[v]) rank[v] = rank[u] + 1;
      indeg.set(v, indeg.get(v)! - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }

  // 3. Shift nodes unreachable from `start` into a trailing lane on the right.
  const reachable = new Set<NodeId>();
  if (start && idSet.has(start)) {
    const stack = [start];
    while (stack.length) {
      const u = stack.pop() as NodeId;
      if (reachable.has(u)) continue;
      reachable.add(u);
      for (const v of adj.get(u)!) if (!reachable.has(v)) stack.push(v);
    }
  }
  let maxReach = -1;
  for (const id of ids) if (reachable.has(id)) maxReach = Math.max(maxReach, rank[id]);
  if (maxReach >= 0) {
    for (const id of ids) if (!reachable.has(id)) rank[id] += maxReach + 1;
  }
  return rank;
}

// Compute node positions (top-left, world coords).
export function forceLayout(spec: LayoutSpec): Positions {
  const { ids, start, edges, sizes } = spec;
  const n = ids.length;
  if (n === 0) return {};
  if (n === 1) return { [ids[0]]: { x: ORIGIN, y: ORIGIN } };

  const rank = layerRanks(ids, start, edges);
  const size = (id: NodeId) => sizes[id] ?? { w: NODE_W, h: 160 };

  // Seed: column by rank (longest-path layer), stacked within the column.
  const targetX: Record<NodeId, number> = {};
  const cx: Record<NodeId, number> = {};
  const cy: Record<NodeId, number> = {};
  const perColumn: Record<number, number> = {};
  for (const id of ids) {
    const r = rank[id];
    const row = perColumn[r] ?? 0;
    perColumn[r] = row + 1;
    targetX[id] = r * COL_PITCH;
    cx[id] = targetX[id];
    cy[id] = row * ROW_SEED;
  }

  const k = IDEAL;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const dispX: Record<NodeId, number> = {};
    const dispY: Record<NodeId, number> = {};
    for (const id of ids) {
      dispX[id] = 0;
      dispY[id] = 0;
    }

    // Repulsion between every pair (n is small: whole story is a few dozen nodes).
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = ids[i];
        const b = ids[j];
        let dx = cx[a] - cx[b];
        let dy = cy[a] - cy[b];
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          dx = (i - j) * 0.01 + 0.01;
          dy = 0.01;
          dist = Math.hypot(dx, dy);
        }
        const f = (k * k) / dist;
        const ux = dx / dist;
        const uy = dy / dist;
        dispX[a] += ux * f;
        dispY[a] += uy * f;
        dispX[b] -= ux * f;
        dispY[b] -= uy * f;
      }
    }

    // Attraction along edges (pulls children near their parents).
    for (const [s, t] of edges) {
      if (cx[s] === undefined || cx[t] === undefined) continue;
      const dx = cx[t] - cx[s];
      const dy = cy[t] - cy[s];
      const dist = Math.hypot(dx, dy) || 0.01;
      const f = (dist * dist) / k;
      const ux = dx / dist;
      const uy = dy / dist;
      dispX[s] += ux * f;
      dispY[s] += uy * f;
      dispX[t] -= ux * f;
      dispY[t] -= uy * f;
    }

    // Temperature-limited step (cools over time so the layout settles).
    const temp = ROW_SEED * (1 - iter / ITERATIONS);
    for (const id of ids) {
      const d = Math.hypot(dispX[id], dispY[id]) || 1;
      const step = Math.min(d, temp);
      cx[id] += (dispX[id] / d) * step;
      cy[id] += (dispY[id] / d) * step;
      // Snap x back toward the node's column so the graph keeps flowing left→right.
      cx[id] += (targetX[id] - cx[id]) * X_STIFF;
    }
  }

  // Convert centers → top-left and resolve any remaining box overlaps.
  const pos: Record<NodeId, { x: number; y: number }> = {};
  for (const id of ids) {
    const s = size(id);
    pos[id] = { x: cx[id] - s.w / 2, y: cy[id] - s.h / 2 };
  }
  resolveOverlaps(ids, pos, size);

  // Normalize so the top-left card sits at ORIGIN, and round for clean, stable output.
  let minX = Infinity;
  let minY = Infinity;
  for (const id of ids) {
    minX = Math.min(minX, pos[id].x);
    minY = Math.min(minY, pos[id].y);
  }
  const out: Positions = {};
  for (const id of ids) {
    out[id] = { x: Math.round(pos[id].x - minX + ORIGIN), y: Math.round(pos[id].y - minY + ORIGIN) };
  }
  return out;
}

// Push apart any two cards whose boxes overlap, along the axis of least penetration
// (so stacked same-column cards separate vertically and columns stay intact).
function resolveOverlaps(
  ids: NodeId[],
  pos: Record<NodeId, { x: number; y: number }>,
  size: (id: NodeId) => NodeSize,
): void {
  const n = ids.length;
  for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = ids[i];
        const b = ids[j];
        const sa = size(a);
        const sb = size(b);
        const acx = pos[a].x + sa.w / 2;
        const acy = pos[a].y + sa.h / 2;
        const bcx = pos[b].x + sb.w / 2;
        const bcy = pos[b].y + sb.h / 2;
        const overlapX = (sa.w + sb.w) / 2 + MARGIN - Math.abs(acx - bcx);
        const overlapY = (sa.h + sb.h) / 2 + MARGIN - Math.abs(acy - bcy);
        if (overlapX <= 0 || overlapY <= 0) continue; // not overlapping
        moved = true;
        if (overlapY <= overlapX) {
          const push = overlapY / 2;
          const dir = acy <= bcy ? -1 : 1;
          pos[a].y += dir * push;
          pos[b].y -= dir * push;
        } else {
          const push = overlapX / 2;
          const dir = acx <= bcx ? -1 : 1;
          pos[a].x += dir * push;
          pos[b].x -= dir * push;
        }
      }
    }
    if (!moved) break;
  }
}
