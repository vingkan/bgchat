import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoryFile } from './story/types';

// A story WITH openingText, injected via a mocked registry so we exercise the real
// <App/> wiring (storyKey/started, remount-by-key, URL handling) end to end.
const { TEST } = vi.hoisted(() => ({
  TEST: {
    start: 'a',
    openingText: 'OPENING-TEXT',
    nodes: {
      a: { id: 'a', speaker: 'A', text: 'FIRST-NODE', video: '', choices: [{ kind: 'simple', label: 'go on', next: 'b' }] },
      b: { id: 'b', speaker: 'A', text: 'SECOND-NODE', video: '', choices: [] },
    },
  } as StoryFile,
}));

vi.mock('./story/registry', () => ({
  DEFAULT_KEY: 'TEST',
  stories: { TEST },
  normalizeKey: (raw: string) => raw.trim().toUpperCase(),
  lookupStory: (raw: string) => ({ TEST }[raw.trim().toUpperCase() as 'TEST']),
}));

import App from './App';

const unlock = () => screen.getByTestId('unlock');

beforeEach(() => {
  window.history.pushState({}, '', '?key=TEST');
  localStorage.clear();
});

describe('App — opening screen on entry', () => {
  it('Restart -> Begin -> Home -> Unlock shows the opening (no progress made)', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Arrive on the opening card (fresh at start), advance into the story.
    await user.click(await screen.findByRole('button', { name: /begin/i }));
    await screen.findByText('FIRST-NODE');
    // Restart -> opening again -> Begin back into the first node.
    await user.click(screen.getByRole('button', { name: /restart/i }));
    await user.click(await screen.findByRole('button', { name: /begin/i }));
    await screen.findByText('FIRST-NODE');
    // Home to the key screen, then re-enter with the code.
    await user.click(screen.getByRole('button', { name: /home/i }));
    await user.type(await screen.findByPlaceholderText(/story code/i), 'TEST');
    await user.click(unlock());
    // No progress was made, so the opening must show — not the first node.
    expect(await screen.findByText('OPENING-TEXT')).toBeInTheDocument();
  });

  it('Home -> Unlock resumes a mid-story node without the opening', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /begin/i }));
    await user.click(await screen.findByText(/go on/i)); // -> node b (progressed)
    await screen.findByText('SECOND-NODE');
    await user.click(screen.getByRole('button', { name: /home/i }));
    await user.type(await screen.findByPlaceholderText(/story code/i), 'TEST');
    await user.click(unlock());
    expect(await screen.findByText('SECOND-NODE')).toBeInTheDocument();
    expect(screen.queryByText('OPENING-TEXT')).not.toBeInTheDocument();
  });
});
