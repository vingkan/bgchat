import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sampleStory } from '../story/sample';
import { DialoguePlayer } from './DialoguePlayer';

function setup() {
  const user = userEvent.setup();
  render(<DialoguePlayer file={sampleStory} seed={1} />);
  return user;
}

async function begin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /begin/i }));
}

describe('DialoguePlayer', () => {
  it('shows the Begin gate first, then the opening node', async () => {
    const user = setup();
    expect(screen.getByRole('button', { name: /begin/i })).toBeInTheDocument();
    await begin(user);
    expect(screen.getByText('Gate Warden Aldric')).toBeInTheDocument();
    expect(screen.getByText(/State your business/i)).toBeInTheDocument();
  });

  it('advances on a simple choice', async () => {
    const user = setup();
    await begin(user);
    await user.click(screen.getByText(/Tell him the truth/i));
    expect(await screen.findByText(/Honesty buys you a step/i)).toBeInTheDocument();
  });

  it('Back is disabled at the start and works after a step', async () => {
    const user = setup();
    await begin(user);
    expect(screen.getByRole('button', { name: /^back$/i })).toBeDisabled();
    await user.click(screen.getByText(/Tell him the truth/i));
    await screen.findByText(/Honesty buys you a step/i); // ensure we're on the new node
    const back = screen.getByRole('button', { name: /^back$/i });
    expect(back).toBeEnabled();
    await user.click(back);
    expect(await screen.findByText(/State your business/i)).toBeInTheDocument();
  });

  it('marks a branch "seen" after visiting and returning (replayability)', async () => {
    const user = setup();
    await begin(user);
    await user.click(screen.getByText(/Tell him the truth/i));
    await screen.findByText(/Honesty buys you a step/i); // on the truth node
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    // Back on the gate, the truth branch we explored should now be marked.
    expect(await screen.findByText('seen')).toBeInTheDocument();
  });

  it('reaches the ending and offers Restart', async () => {
    const user = setup();
    await begin(user);
    await user.click(screen.getByText(/Tell him the truth/i));
    await user.click(await screen.findByText(/Thank him and enter/i));
    expect(await screen.findByText('The End')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument();
  });

  it('runs a skill check: overlay -> Continue routes to a branch', async () => {
    const user = setup();
    await begin(user);
    await user.click(screen.getByText(/Convince him you mean no harm/i));
    expect(await screen.findByRole('dialog', { name: /skill check/i })).toBeInTheDocument();
    const cont = await screen.findByRole('button', { name: /continue/i }, { timeout: 3000 });
    await user.click(cont);
    // Persuasion routes to either persuaded (success) or suspicious (failure).
    const landed = await screen.findByText(
      /(honest face, I'll give you that|Stand where I can see your hands)/i,
    );
    expect(landed).toBeInTheDocument();
  });

  it('selects a choice with the number keys', async () => {
    const user = setup();
    await begin(user);
    await user.keyboard('1'); // first choice -> truth
    expect(await screen.findByText(/Honesty buys you a step/i)).toBeInTheDocument();
  });
});
