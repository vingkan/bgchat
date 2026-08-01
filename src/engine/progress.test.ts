import { describe, expect, it } from 'vitest';
import type { Choice, DialogueNode, NodeId, StoryFile } from '../story/types';
import { DIAMOND_LIMIT, choiceTag, deriveProgress } from './progress';
import { chosenKey } from './engine';

// Minimal node builder — only the fields deriveProgress reads matter here.
function node(id: NodeId, speaker: string): DialogueNode {
  return { id, speaker, text: '', video: '', choices: [] };
}

// Node with outgoing simple choices, for reachability tests.
function branch(id: NodeId, ...next: NodeId[]): DialogueNode {
  return {
    id,
    speaker: '',
    text: '',
    video: '',
    choices: next.map((n) => ({ kind: 'simple', label: '', next: n }) as Choice),
  };
}
const toSimple = (next: NodeId): Choice => ({ kind: 'simple', label: '', next });
const toCheck = (onSuccess: NodeId, onFailure: NodeId): Choice => ({
  kind: 'check',
  label: '',
  skill: '',
  dc: 10,
  onSuccess,
  onFailure,
});

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

describe('choiceTag', () => {
  // Linear branch behind the choice: b -> c.
  const linear = story([branch('a', 'b'), branch('b', 'c'), node('c', '')]);

  it("returns 'none' when the option has not been taken", () => {
    expect(choiceTag(linear, 'a', toSimple('b'), 0, new Set(), [])).toBe('none');
  });

  it("returns 'chosen' once the option is recorded, even with descendants unvisited", () => {
    const chosen = new Set([chosenKey('a', 0)]);
    expect(choiceTag(linear, 'a', toSimple('b'), 0, chosen, ['b'])).toBe('chosen');
  });

  it("no cross-option bleed: recording a DIFFERENT option leaves this one 'none'", () => {
    const chosen = new Set([chosenKey('a', 1)]); // a sibling option at the same node
    expect(choiceTag(linear, 'a', toSimple('b'), 0, chosen, ['b', 'c'])).toBe('none');
  });

  it("upgrades to 'all' only when the option is chosen AND every reachable node is visited", () => {
    const chosen = new Set([chosenKey('a', 0)]);
    expect(choiceTag(linear, 'a', toSimple('b'), 0, chosen, ['b'])).toBe('chosen'); // c missing
    expect(choiceTag(linear, 'a', toSimple('b'), 0, chosen, ['b', 'c'])).toBe('all');
  });

  it("PRECEDENCE: a fully-visited subgraph does NOT mark an un-chosen option 'all'", () => {
    // Everything behind the option is visited (via other paths), but it was never taken.
    expect(choiceTag(linear, 'a', toSimple('b'), 0, new Set(), ['b', 'c'])).toBe('none');
  });

  it("check outcomes read from the recorded result: succeeded / failed / completed", () => {
    const file = story([node('p', ''), node('q', '')]);
    const check = toCheck('p', 'q');
    const s = new Set([chosenKey('n', 0, 's')]);
    const f = new Set([chosenKey('n', 0, 'f')]);
    const both = new Set([chosenKey('n', 0, 's'), chosenKey('n', 0, 'f')]);
    expect(choiceTag(file, 'n', check, 0, s, [])).toBe('succeeded');
    expect(choiceTag(file, 'n', check, 0, f, [])).toBe('failed');
    expect(choiceTag(file, 'n', check, 0, both, [])).toBe('completed');
    expect(choiceTag(file, 'n', check, 0, new Set(), [])).toBe('none');
  });

  it("check 'all' needs both outcomes recorded AND both targets visited", () => {
    const file = story([node('p', ''), node('q', '')]);
    const check = toCheck('p', 'q');
    const both = new Set([chosenKey('n', 0, 's'), chosenKey('n', 0, 'f')]);
    expect(choiceTag(file, 'n', check, 0, both, ['p'])).toBe('completed'); // q unvisited
    expect(choiceTag(file, 'n', check, 0, both, ['p', 'q'])).toBe('all');
  });

  it("check PRECEDENCE: only-succeeded stays 'succeeded' even if the whole subgraph is visited", () => {
    const file = story([node('p', ''), node('q', '')]);
    const check = toCheck('p', 'q');
    const s = new Set([chosenKey('n', 0, 's')]);
    expect(choiceTag(file, 'n', check, 0, s, ['p', 'q'])).toBe('succeeded');
  });

  it('terminates on a cycle', () => {
    const cyclic = story([branch('a', 'b'), branch('b', 'a')]);
    const chosen = new Set([chosenKey('x', 0)]);
    expect(choiceTag(cyclic, 'x', toSimple('a'), 0, chosen, ['a', 'b'])).toBe('all');
    expect(choiceTag(cyclic, 'x', toSimple('a'), 0, chosen, ['a'])).toBe('chosen');
  });
});
