import { describe, expect, it } from 'vitest';
import { firstFocusable, moveFocus, type NavItem } from './menuNav';

const choice = (): NavItem => ({ group: 'choice', disabled: false });
const ctrl = (disabled = false): NavItem => ({ group: 'control', disabled });

// gate-like layout: 4 options, then Back / Restart / Mute / Home.
const withBackEnabled: NavItem[] = [
  choice(),
  choice(),
  choice(),
  choice(),
  ctrl(),
  ctrl(),
  ctrl(),
  ctrl(),
];
// Same, but on the first node Back is disabled (indices: 4=Back off, 5=Restart, ...).
const withBackDisabled: NavItem[] = [
  choice(),
  choice(),
  choice(),
  choice(),
  ctrl(true),
  ctrl(),
  ctrl(),
  ctrl(),
];
// Ending: no options, just the control row (Back disabled).
const endingRow: NavItem[] = [ctrl(true), ctrl(), ctrl(), ctrl()];

describe('firstFocusable', () => {
  it('is the first option when options exist', () => {
    expect(firstFocusable(withBackEnabled)).toBe(0);
  });

  it('skips a disabled control to the first enabled one when there are no options', () => {
    expect(firstFocusable(endingRow)).toBe(1); // Back(0) disabled -> Restart(1)
  });
});

describe('moveFocus', () => {
  it('moves down and up through the options, clamping at the top', () => {
    expect(moveFocus(withBackEnabled, 0, 'down')).toBe(1);
    expect(moveFocus(withBackEnabled, 1, 'down')).toBe(2);
    expect(moveFocus(withBackEnabled, 0, 'up')).toBe(0); // clamp at the first option
    expect(moveFocus(withBackEnabled, 2, 'up')).toBe(1);
  });

  it('drops from the last option into the first enabled control', () => {
    expect(moveFocus(withBackEnabled, 3, 'down')).toBe(4); // -> Back (enabled)
    expect(moveFocus(withBackDisabled, 3, 'down')).toBe(5); // Back disabled -> Restart
  });

  it('returns from a control back up to the last option', () => {
    expect(moveFocus(withBackEnabled, 5, 'up')).toBe(3); // Restart -> last option
    expect(moveFocus(withBackDisabled, 5, 'up')).toBe(3);
  });

  it('moves left/right across the control row and clamps at the ends', () => {
    expect(moveFocus(withBackEnabled, 4, 'right')).toBe(5); // Back -> Restart
    expect(moveFocus(withBackEnabled, 5, 'left')).toBe(4); // Restart -> Back
    expect(moveFocus(withBackEnabled, 7, 'right')).toBe(7); // last control clamps
    expect(moveFocus(withBackDisabled, 5, 'left')).toBe(5); // Back disabled -> clamp at Restart
  });

  it('treats left/right on an option and down within the row as no-ops', () => {
    expect(moveFocus(withBackEnabled, 1, 'left')).toBe(1);
    expect(moveFocus(withBackEnabled, 1, 'right')).toBe(1);
    expect(moveFocus(withBackEnabled, 5, 'down')).toBe(5);
  });

  it('navigates a control-only ending: up/down are no-ops, left/right move', () => {
    expect(moveFocus(endingRow, 1, 'up')).toBe(1);
    expect(moveFocus(endingRow, 1, 'down')).toBe(1);
    expect(moveFocus(endingRow, 1, 'right')).toBe(2);
  });
});
