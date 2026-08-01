import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sampleStory } from '../story/sample';
import type { StoryFile } from '../story/types';
import { DialoguePlayer } from './DialoguePlayer';

function setup(props?: { storageKey?: string }) {
  const user = userEvent.setup();
  render(<DialoguePlayer file={sampleStory} seed={1} storageKey={props?.storageKey} />);
  return user;
}

// The code gate's button is "Unlock" (identified by its testid); the opening card's
// advance button is "Begin". Keep the two distinct everywhere in these tests.
async function begin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('unlock'));
}

describe('DialoguePlayer', () => {
  it('shows the Unlock gate first, then the opening node', async () => {
    const user = setup();
    expect(screen.getByTestId('unlock')).toBeInTheDocument();
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
    // Back at the Unlock gate (key entry).
    expect(await screen.findByTestId('unlock')).toBeInTheDocument();
    // Re-unlock resumes exactly where we were (in-memory progress intact).
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

describe('DialoguePlayer — unmute nudge', () => {
  // Node "a" opts into the nudge; node "b" doesn't, so we can prove it's per-node.
  const nudgeStory: StoryFile = {
    start: 'a',
    nodes: {
      a: {
        id: 'a',
        speaker: 'Ada',
        text: 'Listen closely.',
        video: '',
        nudgeUnmute: true,
        choices: [{ kind: 'simple', label: 'Go on', next: 'b' }],
      },
      b: { id: 'b', speaker: 'Ada', text: 'A quiet room.', video: '', choices: [] },
    },
  };

  async function beginNudge() {
    const user = userEvent.setup();
    render(<DialoguePlayer file={nudgeStory} seed={1} />);
    await user.click(screen.getByTestId('unlock'));
    return user;
  }

  it('shows the "Sound on" nudge on a nudgeUnmute node while sound is off', async () => {
    await beginNudge();
    expect(screen.getByText(/sound on/i)).toBeInTheDocument();
  });

  it('the nudge disappears the moment the player unmutes', async () => {
    const user = await beginNudge();
    await user.click(screen.getByRole('button', { name: /unmute/i }));
    expect(screen.queryByText(/sound on/i)).not.toBeInTheDocument();
    // The control now offers Mute — sound is on, so there's nothing left to nudge.
    expect(screen.getByRole('button', { name: /^mute$/i })).toBeInTheDocument();
  });

  it('does not nudge on a node that has not opted in', async () => {
    const user = await beginNudge();
    await user.click(screen.getByText(/Go on/i)); // -> node "b" (no nudgeUnmute)
    await screen.findByText(/quiet room/i);
    expect(screen.queryByText(/sound on/i)).not.toBeInTheDocument();
  });
});

describe('DialoguePlayer — opening screen', () => {
  const OPENING = 'A story begins in the dark.';
  const openingStory: StoryFile = {
    start: 'a',
    openingText: OPENING,
    nodes: {
      a: {
        id: 'a',
        speaker: 'Ada',
        text: 'Listen closely.',
        video: '',
        choices: [{ kind: 'simple', label: 'Go on', next: 'b' }],
      },
      b: { id: 'b', speaker: 'Ada', text: 'A quiet room.', video: '', choices: [] },
    },
  };

  // Render + click Unlock (the code gate), landing on the opening card.
  async function toOpening(storageKey?: string) {
    const user = userEvent.setup();
    render(<DialoguePlayer file={openingStory} seed={1} storageKey={storageKey} />);
    await user.click(screen.getByTestId('unlock'));
    return user;
  }

  it('shows the opening card after Begin, before the first node', async () => {
    await toOpening();
    // The card is up (it overlays the not-yet-entered first-node stage).
    expect(screen.getByText(OPENING)).toBeInTheDocument();
  });

  it('clicking the opening Begin enters the first node', async () => {
    const user = await toOpening();
    await user.click(screen.getByRole('button', { name: /begin/i })); // the opening card's Begin
    expect(await screen.findByText(/Listen closely/i)).toBeInTheDocument();
    expect(screen.queryByText(OPENING)).not.toBeInTheDocument();
    // Still can't go back on the very first node.
    expect(screen.getByRole('button', { name: /^back$/i })).toBeDisabled();
  });

  it('the opening Begin is selectable by keyboard (a fresh Enter enters the first node)', async () => {
    const user = await toOpening();
    // The card owns its own key handling (Enter/Space), independent of focus, but only
    // after the unlocking key has been released (arm-on-keyup). Release, then press.
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    await user.keyboard('{Enter}');
    expect(await screen.findByText(/Listen closely/i)).toBeInTheDocument();
    expect(screen.queryByText(OPENING)).not.toBeInTheDocument();
  });

  it('a key still held from unlocking cannot skip the card (arm-on-keyup)', async () => {
    await toOpening();
    expect(screen.getByText(OPENING)).toBeInTheDocument();
    // The unlock Enter is still held: keydowns (incl. auto-repeat) arrive before any keyup.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true }));
    // The card must stay up — not armed until a keyup (the node stage stays behind it).
    expect(screen.getByText(OPENING)).toBeInTheDocument();
  });

  it('Restart returns to the opening card', async () => {
    const user = await toOpening();
    await user.click(screen.getByRole('button', { name: /begin/i })); // into node a
    await screen.findByText(/Listen closely/i);
    await user.click(screen.getByRole('button', { name: /restart/i }));
    // The opening card is back up over the (reset-to-start) stage.
    expect(await screen.findByText(OPENING)).toBeInTheDocument();
    // ...and the opening Begin is offered again, gating re-entry.
    expect(screen.getByRole('button', { name: /begin/i })).toBeInTheDocument();
  });

  it('Reset returns to the opening card', async () => {
    const user = await toOpening('OPEN-TEST');
    await user.click(screen.getByRole('button', { name: /begin/i })); // into node a
    await screen.findByText(/Listen closely/i);
    await user.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(await screen.findByText(OPENING)).toBeInTheDocument();
    localStorage.clear();
  });

  it('reloading on the start node shows the opening card, even with prior history', async () => {
    // A save sitting on the start node (fresh, a reload there, or a loop back to it).
    localStorage.setItem(
      'bgchat-progress-v1:OPEN-TEST',
      JSON.stringify({
        currentId: 'a',
        history: [{ nodeId: 'a', choice: { kind: 'simple', label: 'Go on', next: 'b' }, roll: null }],
        visited: ['a', 'b'],
        chosen: ['a#0'],
        rngState: 1,
      }),
    );
    render(<DialoguePlayer file={openingStory} seed={1} storageKey="OPEN-TEST" initialStarted />);
    expect(await screen.findByText(OPENING)).toBeInTheDocument();
    localStorage.clear();
  });

  it('re-entering from Home shows the opening again when no progress was made', async () => {
    const user = await toOpening();
    await user.click(screen.getByRole('button', { name: /begin/i })); // opening -> node a
    await screen.findByText(/Listen closely/i);
    // Home without progressing, then re-enter from the key screen.
    await user.click(screen.getByRole('button', { name: /home/i }));
    await user.click(await screen.findByTestId('unlock')); // key-screen Unlock
    // Still on the start node, so the opening card returns.
    expect(await screen.findByText(OPENING)).toBeInTheDocument();
  });

  it('re-entering from Home resumes the mid-story node without the opening', async () => {
    const user = await toOpening();
    await user.click(screen.getByRole('button', { name: /begin/i })); // opening -> node a
    await user.click(await screen.findByText(/Go on/i)); // -> node b (progressed)
    await screen.findByText(/A quiet room/i);
    await user.click(screen.getByRole('button', { name: /home/i }));
    await user.click(await screen.findByTestId('unlock')); // key-screen Unlock
    // Mid-story: resume node b directly, no opening card.
    expect(await screen.findByText(/A quiet room/i)).toBeInTheDocument();
    expect(screen.queryByText(OPENING)).not.toBeInTheDocument();
  });

  it('resuming a mid-story save skips the opening card and lands on the saved node', async () => {
    // Seed a save that has progressed to node "b" (matches progressStore's key + shape).
    localStorage.setItem(
      'bgchat-progress-v1:OPEN-TEST',
      JSON.stringify({
        currentId: 'b',
        history: [{ nodeId: 'a', choice: { kind: 'simple', label: 'Go on', next: 'b' }, roll: null }],
        visited: ['a', 'b'],
        chosen: ['a#0'],
        rngState: 1,
      }),
    );
    render(<DialoguePlayer file={openingStory} seed={1} storageKey="OPEN-TEST" initialStarted />);
    expect(await screen.findByText(/A quiet room/i)).toBeInTheDocument();
    expect(screen.queryByText(OPENING)).not.toBeInTheDocument();
    localStorage.clear();
  });
});
