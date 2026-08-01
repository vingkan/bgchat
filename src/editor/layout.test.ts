import { describe, expect, it } from 'vitest';
import type { NodeId } from '../story/types';
import { forceLayout, layerRanks, type LayoutSpec, type NodeSize } from './layout';

const CARD: NodeSize = { w: 340, h: 160 };
const sizesFor = (ids: NodeId[], overrides: Record<NodeId, NodeSize> = {}): Record<NodeId, NodeSize> =>
  Object.fromEntries(ids.map((id) => [id, overrides[id] ?? CARD]));

// Do two cards' boxes overlap (ignoring the enforced margin)?
function overlaps(
  a: { x: number; y: number },
  sa: NodeSize,
  b: { x: number; y: number },
  sb: NodeSize,
): boolean {
  const gapX = Math.abs(a.x + sa.w / 2 - (b.x + sb.w / 2)) - (sa.w + sb.w) / 2;
  const gapY = Math.abs(a.y + sa.h / 2 - (b.y + sb.h / 2)) - (sa.h + sb.h) / 2;
  return gapX < -0.5 && gapY < -0.5;
}

describe('layerRanks', () => {
  it('ranks nodes along a chain', () => {
    const r = layerRanks(['a', 'b', 'c'], 'a', [
      ['a', 'b'],
      ['b', 'c'],
    ]);
    expect(r).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('uses LONGEST path so a node sits right of every node that flows into it', () => {
    // a→b directly, but also a→c→d→e→b. BFS would rank b at 1 (backward edge e→b);
    // longest-path ranks b after e so e→b points forward.
    const r = layerRanks(['a', 'b', 'c', 'd', 'e'], 'a', [
      ['a', 'b'],
      ['a', 'c'],
      ['c', 'd'],
      ['d', 'e'],
      ['e', 'b'],
    ]);
    expect(r.e).toBe(3);
    expect(r.b).toBe(4); // > e, so the e→b edge is forward
  });

  it('keeps a genuine loop as the only backward edge', () => {
    const r = layerRanks(['a', 'b'], 'a', [
      ['a', 'b'],
      ['b', 'a'], // loop (back-edge) — ignored for ranking
    ]);
    expect(r.a).toBe(0);
    expect(r.b).toBe(1);
  });

  it('parks unreachable nodes in a trailing lane', () => {
    const r = layerRanks(['a', 'b', 'orphan'], 'a', [['a', 'b']]);
    expect(r.a).toBe(0);
    expect(r.b).toBe(1);
    expect(r.orphan).toBeGreaterThan(r.b);
  });
});

describe('forceLayout', () => {
  it('flows left→right: every node sits right of its ancestors', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const edges: [NodeId, NodeId][] = [
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'd'],
    ];
    const pos = forceLayout({ ids, start: 'a', edges, sizes: sizesFor(ids) });
    expect(pos.b.x).toBeGreaterThan(pos.a.x);
    expect(pos.c.x).toBeGreaterThan(pos.a.x);
    expect(pos.d.x).toBeGreaterThan(pos.b.x);
    expect(pos.d.x).toBeGreaterThan(pos.a.x);
  });

  it('leaves no two cards overlapping, even with tall varied cards', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const edges: [NodeId, NodeId][] = [
      ['a', 'b'],
      ['a', 'c'],
      ['a', 'd'],
      ['b', 'e'],
      ['c', 'e'],
      ['d', 'f'],
    ];
    const sizes = sizesFor(ids, { b: { w: 340, h: 420 }, e: { w: 340, h: 300 } });
    const pos = forceLayout({ ids, start: 'a', edges, sizes });
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(overlaps(pos[ids[i]], sizes[ids[i]], pos[ids[j]], sizes[ids[j]])).toBe(false);
      }
    }
  });

  it('is deterministic: same input → identical output', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const edges: [NodeId, NodeId][] = [
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'd'],
      ['c', 'e'],
    ];
    const spec: LayoutSpec = { ids, start: 'a', edges, sizes: sizesFor(ids) };
    expect(forceLayout(spec)).toEqual(forceLayout(spec));
  });

  it('places an unreachable node to the right of the whole reachable graph', () => {
    const ids = ['a', 'b', 'c', 'orphan'];
    const edges: [NodeId, NodeId][] = [
      ['a', 'b'],
      ['b', 'c'],
    ];
    const pos = forceLayout({ ids, start: 'a', edges, sizes: sizesFor(ids) });
    expect(pos.orphan.x).toBeGreaterThan(pos.c.x);
  });

  it('lays out a long-subtree branch so its edges point forward, not backward', () => {
    // The bug: node `e` flows into `b`, but `b` was also reachable directly from `a`.
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const edges: [NodeId, NodeId][] = [
      ['a', 'b'],
      ['a', 'c'],
      ['c', 'd'],
      ['d', 'e'],
      ['e', 'b'],
    ];
    const pos = forceLayout({ ids, start: 'a', edges, sizes: sizesFor(ids) });
    // Every forward edge goes left→right.
    for (const [s, t] of edges) {
      expect(pos[t].x).toBeGreaterThan(pos[s].x);
    }
  });

  it('handles the trivial cases', () => {
    expect(forceLayout({ ids: [], start: null, edges: [], sizes: {} })).toEqual({});
    expect(forceLayout({ ids: ['solo'], start: 'solo', edges: [], sizes: sizesFor(['solo']) })).toHaveProperty(
      'solo',
    );
  });
});
