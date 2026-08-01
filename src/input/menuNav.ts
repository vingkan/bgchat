// Roving-cursor math for the dialogue screen, DOM-free so it can be unit-tested.
// The nav order is: every story option (a "choice"), then the bottom control row
// (Back / Restart / Mute / [Reset] / Home) — all "control"s. Disabled items (e.g.
// Back on the first node) are never landed on.

export type NavGroup = 'choice' | 'control';
export type NavItem = { group: NavGroup; disabled: boolean };
export type NavDir = 'up' | 'down' | 'left' | 'right';

// First landable index: the first enabled item. Choices precede controls and are
// never disabled, so this is the first option when any exist, else the first
// enabled control.
export function firstFocusable(items: NavItem[]): number {
  return items.findIndex((it) => !it.disabled);
}

function seek(items: NavItem[], from: number, step: number, group: NavGroup): number {
  for (let i = from + step; i >= 0 && i < items.length; i += step) {
    if (!items[i].disabled && items[i].group === group) return i;
  }
  return -1;
}

function edgeOfGroup(items: NavItem[], group: NavGroup, last: boolean): number {
  const range = last ? [...items.keys()].reverse() : [...items.keys()];
  for (const i of range) if (items[i].group === group && !items[i].disabled) return i;
  return -1;
}

// Move the cursor per the confirmed model, clamping (never wrapping) at edges and
// returning the current index unchanged when a move has nowhere to go.
export function moveFocus(items: NavItem[], current: number, dir: NavDir): number {
  const cur = items[current];
  if (!cur) return current;

  if (dir === 'down') {
    if (cur.group !== 'choice') return current; // within the row, down does nothing
    const nextChoice = seek(items, current, +1, 'choice');
    if (nextChoice !== -1) return nextChoice;
    const firstCtrl = edgeOfGroup(items, 'control', false); // last option drops to the row
    return firstCtrl !== -1 ? firstCtrl : current;
  }

  if (dir === 'up') {
    if (cur.group === 'choice') {
      const prevChoice = seek(items, current, -1, 'choice');
      return prevChoice !== -1 ? prevChoice : current; // clamp at the first option
    }
    const lastChoice = edgeOfGroup(items, 'choice', true); // row → back up to the options
    return lastChoice !== -1 ? lastChoice : current;
  }

  // left / right only traverse the horizontal control row.
  if (cur.group === 'control') {
    const next = seek(items, current, dir === 'right' ? +1 : -1, 'control');
    return next !== -1 ? next : current; // clamp at the row ends
  }
  return current; // left/right on an option: no-op
}
