import { useEffect, useRef } from 'react';
import { readNavPresses, type NavButton, type PressedState } from './gamepad';

// Polls connected gamepads once per animation frame and fires `onPress` for each
// button/stick edge, translated to a NavButton. Inert when `enabled` is false and in
// jsdom (which has no navigator.getGamepads); with no pad connected each frame simply
// reads nothing.
export function useGamepad(enabled: boolean, onPress: (button: NavButton) => void) {
  // Keep the latest callback in a ref so the long-lived poll loop always calls the
  // freshest closure (current focus index, current game state) without re-subscribing.
  const cbRef = useRef(onPress);
  useEffect(() => {
    cbRef.current = onPress;
  });

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator.getGamepads !== 'function') return; // e.g. jsdom
    const getPads = () => navigator.getGamepads() ?? [];

    let raf = 0;
    let prev: PressedState = {};

    const loop = () => {
      const { presses, pressed } = readNavPresses(getPads(), prev);
      prev = pressed;
      for (const p of presses) cbRef.current(p);
      raf = requestAnimationFrame(loop);
    };

    // Poll unconditionally while enabled — reading getPads() every frame. We deliberately
    // do NOT gate the loop start on the `gamepadconnected` event: Chromium only delivers it
    // after a button press while the document is focused, and an installed PWA window on
    // macOS routinely never receives it, which left the loop dead there. `enabled` is already
    // scoped to active gameplay screens, so a continuous rAF here costs nothing.
    raf = requestAnimationFrame(loop);

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);
}
