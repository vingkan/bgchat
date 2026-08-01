import { describe, expect, it } from 'vitest';
import type { DialogueNode, NodeId, StoryFile } from '../story/types';
import { DIAMOND_LIMIT, deriveProgress } from './progress';

// Minimal node builder — only the fields deriveProgress reads matter here.
function node(id: NodeId, speaker: string): DialogueNode {
  return { id, speaker, text: '', video: '', choices: [] };
}

function story(nodes: DialogueNode[]): StoryFile {
  const map: Record<NodeId, DialogueNode> = {};
  for (const n of nodes) map[n.id] = n;
  return { start: nodes[0]?.id ?? 'a', nodes: map };
}

describe('deriveProgress', () => {
  it('counts scenes as distinct visited nodes over total nodes', () => {
    const file = story([node('a', 'Alice'), node('b', 'Bob'), node('c', 'Cara')]);
    const p = deriveProgress(file, ['a', 'b']);
    expect(p.scenes).toEqual({ unlocked: 2, total: 3 });
  });

  it('dedupes repeated visits to the same node', () => {
    const file = story([node('a', 'Alice'), node('b', 'Bob')]);
    const p = deriveProgress(file, ['a', 'a', 'a']);
    expect(p.scenes.unlocked).toBe(1);
  });

  it('ignores visited ids that are not real nodes', () => {
    const file = story([node('a', 'Alice'), node('b', 'Bob')]);
    const p = deriveProgress(file, ['a', 'ghost']);
    expect(p.scenes.unlocked).toBe(1);
  });

  it('counts characters as unique speakers, met vs total', () => {
    // Alice speaks in two nodes; visiting one of them still means "met Alice".
    const file = story([node('a', 'Alice'), node('b', 'Alice'), node('c', 'Bob')]);
    const p = deriveProgress(file, ['a']);
    expect(p.characters.unlocked).toBe(1); // Alice
    expect(p.characters.total).toBe(2); // Alice, Bob
  });

  it('does not count blank or whitespace speakers as characters', () => {
    const file = story([node('a', 'Alice'), node('b', ''), node('c', '   ')]);
    const p = deriveProgress(file, ['a', 'b', 'c']);
    expect(p.characters.total).toBe(1); // only Alice
    expect(p.characters.unlocked).toBe(1);
  });

  it('treats speakers as identical after trimming', () => {
    const file = story([node('a', 'Alice'), node('b', ' Alice ')]);
    const p = deriveProgress(file, ['a', 'b']);
    expect(p.characters.total).toBe(1);
  });

  it('uses icons at or below the diamond limit, a bar above it', () => {
    const few = story(
      Array.from({ length: DIAMOND_LIMIT }, (_, i) => node(`n${i}`, `Speaker ${i}`)),
    );
    expect(deriveProgress(few, []).characters.useIcons).toBe(true);

    const many = story(
      Array.from({ length: DIAMOND_LIMIT + 1 }, (_, i) => node(`n${i}`, `Speaker ${i}`)),
    );
    expect(deriveProgress(many, []).characters.useIcons).toBe(false);
  });

  it('computes a combined percent weighted by raw counts', () => {
    // 3 nodes / 3 speakers total; visit 1 node (its speaker met).
    // (1 scene + 1 char) / (3 + 3) = 2/6 = 33%.
    const file = story([node('a', 'Alice'), node('b', 'Bob'), node('c', 'Cara')]);
    expect(deriveProgress(file, ['a']).percent).toBe(33);
  });

  it('reports 100% when everything is visited', () => {
    const file = story([node('a', 'Alice'), node('b', 'Bob')]);
    const p = deriveProgress(file, ['a', 'b']);
    expect(p.percent).toBe(100);
    expect(p.scenes.unlocked).toBe(p.scenes.total);
    expect(p.characters.unlocked).toBe(p.characters.total);
  });

  it('is safe on an empty visited list', () => {
    const file = story([node('a', 'Alice')]);
    const p = deriveProgress(file, []);
    expect(p).toEqual({
      scenes: { unlocked: 0, total: 1 },
      characters: { unlocked: 0, total: 1, useIcons: true },
      percent: 0,
    });
  });
});
