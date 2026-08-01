// Persist a committed GameState to localStorage so a reload resumes the exact playthrough.
//
// Design notes:
// - Store the committed `GameState` ONLY (never the transient `pending` roll). A reload
//   mid-roll simply lands on the pre-roll node — nothing half-applied to reconstruct.
// - Key is versioned AND namespaced per story: localStorage is origin-scoped, and different
//   stories (TEST vs LOVE) have different node ids, so their saves must not collide.
// - Every call is wrapped in try/catch: quota, private-mode, disabled storage, or corrupt
//   data must NEVER break the game. Load failures fall back to `null` (a fresh start).
// - Validation here is STRUCTURAL only (right shape). Whether `currentId` actually exists in
//   the current story is a semantic check the caller does (it has the StoryFile) — see initPlayer.

import type { GameState } from '../engine/engine';

const STORAGE_PREFIX = 'bgchat-progress-v1';

function keyFor(storyKey: string): string {
  return `${STORAGE_PREFIX}:${storyKey}`;
}

// Structural type guard: is this parsed JSON shaped like a GameState?
function isGameState(v: unknown): v is GameState {
  if (typeof v !== 'object' || v === null) return false;
  const g = v as Record<string, unknown>;
  return (
    typeof g.currentId === 'string' &&
    Array.isArray(g.history) &&
    Array.isArray(g.visited) &&
    g.visited.every((id) => typeof id === 'string') &&
    typeof g.rngState === 'number'
  );
}

export function saveGame(storyKey: string, game: GameState): void {
  try {
    localStorage.setItem(keyFor(storyKey), JSON.stringify(game));
  } catch {
    /* storage unavailable or over quota — persistence is best-effort */
  }
}

export function loadGame(storyKey: string): GameState | null {
  try {
    const raw = localStorage.getItem(keyFor(storyKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGameState(parsed) ? parsed : null;
  } catch {
    return null; // unavailable, or corrupt JSON
  }
}

export function clearGame(storyKey: string): void {
  try {
    localStorage.removeItem(keyFor(storyKey));
  } catch {
    /* nothing to do if storage is unavailable */
  }
}
