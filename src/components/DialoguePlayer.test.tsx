import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sampleStory } from '../story/sample';
import { DialoguePlayer } from './DialoguePlayer';

function setup(props?: { storageKey?: string }) {
  const user = userEvent.setup();
  render(<DialoguePlayer file={sampleStory} seed={1} storageKey={props?.storageKey} />);
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

  // Helper: the choice <li> whose label matches, for scoping tag assertions to one option.
  function choiceRow(label: RegExp) {
    return screen.getByText(label).closest('.choice') as HTMLElement;
  }

  it('tags an option "Chosen" after it is clicked, and leaves untouched options untagged', async () => {
    const user = setup();
    await begin(user);
    await user.click(screen.getByText(/Tell him the truth/i));
    await screen.findByText(/Honesty buys you a step/i); // on the truth node
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    await screen.findByText(/State your business/i); // back on the gate
    // The truth option was clicked -> "Chosen". Its branch isn't fully explored yet.
    const truth = choiceRow(/Tell him the truth/i);
    expect(within(truth).getByText('Chosen')).toBeInTheDocument();
    expect(within(truth).queryByText('Explored all paths')).not.toBeInTheDocument();
    // A sibling option we never touched carries no tag (no cross-option bleed).
    const persuade = choiceRow(/Convince him you mean no harm/i);
    expect(within(persuade).queryByText('Chosen')).not.toBeInTheDocument();
  });

  it('tags a check with its recorded outcome (Succeeded/Failed) after resolving and returning', async () => {
    const user = setup();
    await begin(user);
    await user.click(screen.getByText(/Convince him you mean no harm/i));
    const cont = await screen.findByRole('button', { name: /continue/i }, { timeout: 3000 });
    await user.click(cont);
    await screen.findByText(/(honest face, I'll give you that|Stand where I can see your hands)/i);
    await user.click(screen.getByRole('button', { name: /^back$/i })); // -> gate
    await screen.findByText(/State your business/i);
    const persuade = choiceRow(/Convince him you mean no harm/i);
    expect(within(persuade).getByText(/^(Succeeded|Failed)$/)).toBeInTheDocument();
  });

  it('upgrades an option to "Explored all paths" once it is chosen and its whole branch is visited', async () => {
    const user = setup();
    await begin(user);
    await user.click(screen.getByText(/Tell him the truth/i)); // -> truth
    await user.click(await screen.findByText(/Thank him and enter/i)); // -> enter (ending)
    await screen.findByText('The End');
    await user.click(screen.getByRole('button', { name: /^back$/i })); // -> truth
    await screen.findByText(/Honesty buys you a step/i);
    await user.click(screen.getByRole('button', { name: /^back$/i })); // -> gate
    await screen.findByText(/State your business/i);
    // The truth option is chosen AND its branch (truth -> enter) is fully visited.
    const truth = choiceRow(/Tell him the truth/i);
    expect(within(truth).getByText('Explored all paths')).toBeInTheDocument();
  });

  it('shows the control row (Back / Restart / Mute / Home) mid-story, not just at endings', async () => {
    const user = setup();
    await begin(user);
    // Still on the opening node, mid-story.
    expect(screen.getByText(/State your business/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
    // No persistence configured => no Reset option.
    expect(screen.queryByRole('button', { name: /^reset$/i })).not.toBeInTheDocument();
  });

  it('offers Reset on every page when persistence is enabled', async () => {
    const user = setup({ storageKey: 'DP-TEST' });
    await begin(user);
    // Mid-story: Reset is available immediately, not only at the ending.
    expect(screen.getByRole('button', { name: /^reset$/i })).toBeInTheDocument();
    await user.click(screen.getByText(/Tell him the truth/i));
    await user.click(await screen.findByText(/Thank him and enter/i));
    await screen.findByText('The End');
    expect(screen.getByRole('button', { name: /^reset$/i })).toBeInTheDocument();
    localStorage.clear();
  });

  it('Home returns to the key screen without losing progress', async () => {
    const user = setup();
    await begin(user);
    await user.click(screen.getByText(/Tell him the truth/i));
    await screen.findByText(/Honesty buys you a step/i); // advanced one node
    await user.click(screen.getByRole('button', { name: /home/i }));
    // Back at the Begin gate (key entry).
    expect(await screen.findByRole('button', { name: /begin/i })).toBeInTheDocument();
    // Re-begin resumes exactly where we were (in-memory progress intact).
    await begin(user);
    expect(await screen.findByText(/Honesty buys you a step/i)).toBeInTheDocument();
  });

  it('arrow keys move a cursor over the options; Enter selects the focused one', async () => {
    const user = setup();
    await begin(user);
    // First directional input reveals the cursor on the first option.
    await user.keyboard('{ArrowDown}');
    const truth = screen.getByText(/Tell him the truth/i).closest('.choice');
    expect(document.activeElement).toBe(truth);
    // Enter activates the focused option natively (no double-fire with the global handler).
    await user.keyboard('{Enter}');
    expect(await screen.findByText(/Honesty buys you a step/i)).toBeInTheDocument();
  });

  it('ArrowDown past the last option drops into the control row; Left/Right cross it, Up returns', async () => {
    const user = setup(); // no storageKey => row is Back / Restart / Mute / Home
    await begin(user);
    // Reveal, then walk down through all four options into the row.
    for (let i = 0; i < 5; i++) await user.keyboard('{ArrowDown}');
    // Back is disabled on the first node, so the cursor lands on Restart.
    const restart = screen.getByRole('button', { name: /restart/i });
    expect(document.activeElement).toBe(restart);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /unmute/i }));
    // Up from the row returns to the last option.
    await user.keyboard('{ArrowUp}');
    const leave = screen.getByText(/Say nothing and turn to leave/i).closest('.choice');
    expect(document.activeElement).toBe(leave);
  });

  it('Backspace triggers Back after a step, and is a no-op on the first node', async () => {
    const user = setup();
    await begin(user);
    // First node: history is empty, Back is disabled, so Backspace does nothing.
    await user.keyboard('{Backspace}');
    expect(screen.getByText(/State your business/i)).toBeInTheDocument();
    // Advance a step, then Backspace walks it back.
    await user.click(screen.getByText(/Tell him the truth/i));
    await screen.findByText(/Honesty buys you a step/i);
    await user.keyboard('{Backspace}');
    expect(await screen.findByText(/State your business/i)).toBeInTheDocument();
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
