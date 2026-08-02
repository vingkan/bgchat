// Gamepad → semantic navigation, the pure half (no React, no DOM, no timers).
// The hook in useGamepad.ts is a thin rAF shell over `readNavPresses`, so all the
// mapping/edge-detection logic lives here where it can be unit-tested directly.

// The six semantic inputs the whole game speaks. Keyboard and gamepad both reduce
// to these; consumers never see raw button indices.
export type NavButton = 'up' | 'down' | 'left' | 'right' | 'select' | 'back';

export type PressedState = Partial<Record<NavButton, boolean>>;

// Web Gamepad "standard" mapping button indices. Chromium reports PS4/PS5
// (DualShock/DualSense) AND Xbox pads under this same layout, so this one table
// covers all of them: Cross/A = 0 (select), Circle/B = 1 (back), D-pad = 12–15.
export const STANDARD_BUTTON_MAP: Record<number, NavButton> = {
  0: 'select', // ✕ Cross / A
  1: 'back', // ○ Circle / B
  12: 'up', // D-pad up
  13: 'down', // D-pad down
  14: 'left', // D-pad left
  15: 'right', // D-pad right
};

// Hook point for other controllers. Every pad we support today reports the
// "standard" mapping, so we return the standard table. To add a quirky controller,
// branch on `gp.mapping` (non-standard pads report '') or `gp.id` here and return a
// different index → NavButton map.
export function mappingFor(gp: Gamepad): Record<number, NavButton> {
  // Non-standard pads fall through to the standard indices as a best effort; add a
  // dedicated table here if one ever misbehaves.
  if (gp.mapping !== 'standard') return STANDARD_BUTTON_MAP;
  return STANDARD_BUTTON_MAP;
}

// Left stick has to move past this fraction of full deflection to count as a
// direction, so a resting/drifting stick doesn't spam the menu.
export const AXIS_DEADZONE = 0.5;

const ALL: readonly NavButton[] = ['up', 'down', 'left', 'right', 'select', 'back'];

// Read the current frame's pressed set from every connected pad, then edge-detect
// against `prev` so each physical press fires exactly once (holding does not repeat
// — the natural feel for a menu). Returns the new pressed set to feed back next frame.
//
// `prev === null` means we just started listening (mount / reconnect): adopt whatever
// is currently held as the baseline and emit NOTHING, so a button already down when we
// begin isn't mistaken for a new press. Without this, a button still held across a
// component swap double-fires — e.g. holding ✕ on Restart carries into the freshly
// mounted opening card and auto-triggers its Begin. A held button becomes a press only
// after it's released and pressed again.
export function readNavPresses(
  pads: readonly (Gamepad | null)[],
  prev: PressedState | null,
): { presses: NavButton[]; pressed: PressedState } {
  const pressed: PressedState = {};

  for (const gp of pads) {
    if (!gp) continue;
    const map = mappingFor(gp);
    for (const indexStr of Object.keys(map)) {
      const idx = Number(indexStr);
      if (gp.buttons[idx]?.pressed) pressed[map[idx]] = true;
    }
    // Left stick doubles as a D-pad past the deadzone (axes[1] = vertical, down positive).
    const x = gp.axes[0] ?? 0;
    const y = gp.axes[1] ?? 0;
    if (y <= -AXIS_DEADZONE) pressed.up = true;
    if (y >= AXIS_DEADZONE) pressed.down = true;
    if (x <= -AXIS_DEADZONE) pressed.left = true;
    if (x >= AXIS_DEADZONE) pressed.right = true;
  }

  // First frame after (re)starting the loop: baseline only, no presses (see above).
  if (prev === null) return { presses: [], pressed };

  const presses: NavButton[] = [];
  for (const nav of ALL) {
    if (pressed[nav] && !prev[nav]) presses.push(nav);
  }
  return { presses, pressed };
}
