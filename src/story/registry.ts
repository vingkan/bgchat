import type { StoryFile } from './types';
import { sampleStory } from './sample';
import { loveStory } from './love';

// The keyed story registry. A story is reached by its key (case-insensitive,
// 1–8 chars) via ?key=KEY in the URL or the input on the opening screen.
// TEST is the example story the tests bind to (imported as `sampleStory`);
// add new authored stories here.
export const DEFAULT_KEY = 'TEST';

export const stories: Record<string, StoryFile> = {
  TEST: sampleStory,
  LOVE: loveStory,
};

// Uppercase + trim so lookups are case-insensitive. Registry membership is the
// validity gate — an unknown or out-of-range key just won't resolve.
export const normalizeKey = (raw: string): string => raw.trim().toUpperCase();

export const lookupStory = (raw: string): StoryFile | undefined => stories[normalizeKey(raw)];
