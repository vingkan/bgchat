import type { StoryFile } from './types';

// Dev-only fixture for Playwright video tests. Loaded via `?e2eVideo` and ONLY when
// import.meta.env.DEV is true (see App.tsx), so it is dead-code-eliminated from the
// production bundle. References a real clip (public/video/default.webm) and a
// deliberately missing clip to exercise the graceful fallback.
export const e2eVideoStory: StoryFile = {
  start: 'a',
  nodes: {
    a: {
      id: 'a',
      speaker: 'Test A',
      text: 'First node with a real clip.',
      video: '/video/default-looping.webm',
      choices: [{ kind: 'simple', label: 'Go to B', next: 'b' }],
    },
    b: {
      id: 'b',
      speaker: 'Test B',
      text: 'Second node — subsequent-node playback (WebKit autoplay licensing).',
      video: '/video/default-looping.webm',
      choices: [{ kind: 'simple', label: 'Go to missing', next: 'missing' }],
    },
    missing: {
      id: 'missing',
      speaker: 'Test C',
      text: 'This clip does not exist — the player must fall back to the placeholder.',
      video: '/video/does-not-exist.webm',
      choices: [],
    },
  },
};
