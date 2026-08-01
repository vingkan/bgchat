// Pure exploration-progress derivation over a StoryFile + the engine's
// monotonic `visited` list. No React, no DOM — same "analyze a StoryFile and
// return plain data" shape as validation.ts, so it lives beside the engine.
//
// Two tracked dimensions:
//   scenes     — how many distinct nodes the player has visited, out of all nodes.
//   characters — how many distinct speakers the player has met, out of all speakers.
// A speaker is a trimmed, non-empty `node.speaker`; blank/narrator lines don't
// count toward the character total (the read UI shows them as "Unnamed speaker").

import type { Choice, NodeId, StoryFile } from '../story/types';
import { choiceTargets } from '../story/types';
import { chosenKey } from './engine';

// At or below this many unique speakers the UI renders a row of diamond icons;
// above it, a progress bar. Mirrors the approved design prototype.
export const DIAMOND_LIMIT = 10;

export interface StoryProgress {
  scenes: { unlocked: number; total: number };
  characters: { unlocked: number; total: number; useIcons: boolean };
  // Combined percentage across both dimensions (0–100, integer). Weighted by
  // raw counts, so scenes (the larger pool) dominate — matches the prototype.
  percent: number;
}

// Normalize a speaker for identity/counting: trim, and treat blank as "no
// character". Returns '' for anything that shouldn't count.
function normSpeaker(speaker: string): string {
  return speaker.trim();
}

export function deriveProgress(file: StoryFile, visited: NodeId[]): StoryProgress {
  const nodes = file.nodes;

  const sceneTotal = Object.keys(nodes).length;

  // Distinct visited ids that are real nodes (defensive: `visited` is already
  // monotonic + deduped, but never trust it to only hold live keys).
  const visitedIds = new Set<NodeId>();
  for (const id of visited) {
    if (nodes[id]) visitedIds.add(id);
  }
  const sceneUnlocked = visitedIds.size;

  // Unique speakers across all nodes, and across visited nodes.
  const allSpeakers = new Set<string>();
  for (const n of Object.values(nodes)) {
    const s = normSpeaker(n.speaker);
    if (s) allSpeakers.add(s);
  }
  const metSpeakers = new Set<string>();
  for (const id of visitedIds) {
    const s = normSpeaker(nodes[id].speaker);
    if (s) metSpeakers.add(s);
  }

  const charTotal = allSpeakers.size;
  const charUnlocked = metSpeakers.size;

  const denom = sceneTotal + charTotal;
  const percent = denom === 0 ? 0 : Math.round(((sceneUnlocked + charUnlocked) / denom) * 100);

  return {
    scenes: { unlocked: sceneUnlocked, total: sceneTotal },
    characters: { unlocked: charUnlocked, total: charTotal, useIcons: charTotal <= DIAMOND_LIMIT },
    percent,
  };
}

// The replayability tag on one choice, grounded in what the player actually did:
//   'chosen'    — a plain option that has been clicked
//   'succeeded' — a check that has passed (but not yet failed)
//   'failed'    — a check that has failed (but not yet passed)
//   'completed' — a check where BOTH outcomes have happened
//   'all'       — the option is completed AND every node reachable behind it is visited
//   'none'      — nothing recorded for this option yet
// 'all' is a strict UPGRADE of a completed option, never a shortcut: a fully-visited
// subgraph reached via other paths does not mark an un-completed option "all".
export type ChoiceTag = 'all' | 'completed' | 'succeeded' | 'failed' | 'chosen' | 'none';

// Forward transitive closure from a set of start nodes (starts included). A
// seen-set walk, so cycles (A -> B -> A) terminate. Ids not present in
// file.nodes are ignored (defensive — the graph can be edited under a save).
function reachableFrom(file: StoryFile, starts: NodeId[]): Set<NodeId> {
  const seen = new Set<NodeId>();
  const stack = [...starts];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || !file.nodes[id]) continue;
    seen.add(id);
    for (const c of file.nodes[id].choices) stack.push(...choiceTargets(c));
  }
  return seen;
}

// True once every node reachable behind the choice has been visited.
function fullyVisited(file: StoryFile, choice: Choice, seen: Set<NodeId>): boolean {
  const descendants = reachableFrom(file, choiceTargets(choice));
  if (descendants.size === 0) return false;
  for (const id of descendants) if (!seen.has(id)) return false;
  return true;
}

// Tag for one choice at `nodeId` position `index`, from the monotonic `chosen` record
// (the click history) and `visited` (for the "all" upgrade).
export function choiceTag(
  file: StoryFile,
  nodeId: NodeId,
  choice: Choice,
  index: number,
  chosen: Set<string>,
  visited: NodeId[],
): ChoiceTag {
  const seen = new Set(visited);

  if (choice.kind === 'check') {
    const s = chosen.has(chosenKey(nodeId, index, 's'));
    const f = chosen.has(chosenKey(nodeId, index, 'f'));
    const completed = s && f;
    if (completed && fullyVisited(file, choice, seen)) return 'all';
    if (completed) return 'completed';
    if (s) return 'succeeded';
    if (f) return 'failed';
    return 'none';
  }

  const picked = chosen.has(chosenKey(nodeId, index));
  if (picked && fullyVisited(file, choice, seen)) return 'all';
  return picked ? 'chosen' : 'none';
}
