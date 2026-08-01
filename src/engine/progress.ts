// Pure exploration-progress derivation over a StoryFile + the engine's
// monotonic `visited` list. No React, no DOM — same "analyze a StoryFile and
// return plain data" shape as validation.ts, so it lives beside the engine.
//
// Two tracked dimensions:
//   scenes     — how many distinct nodes the player has visited, out of all nodes.
//   characters — how many distinct speakers the player has met, out of all speakers.
// A speaker is a trimmed, non-empty `node.speaker`; blank/narrator lines don't
// count toward the character total (the read UI shows them as "Unnamed speaker").

import type { NodeId, StoryFile } from '../story/types';

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
