import { useEffect, useRef } from 'react';
import { readNavPresses, type NavButton, type PressedState } from './gamepad';

// Polls connected gamepads once per animation frame and fires `onPress` for each
// button/stick edge, translated to a NavButton. Inert when `enabled` is false, when
// no pad is connected, and in jsdom (which has no navigator.getGamepads).
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
    // null = not yet primed: the first loop adopts the current held state as its baseline
    // so a button already down when we start listening isn't read as a fresh press.
    let prev: PressedState | null = null;

    const loop = () => {
      const { presses, pressed } = readNavPresses(getPads(), prev);
      prev = pressed;
      for (const p of presses) cbRef.current(p);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      prev = null; // re-prime on the next start (reconnect / re-enable)
    };
    // Only run the loop while at least one pad is present, to spare the battery.
    const onDisconnect = () => {
      if (!getPads().some(Boolean)) stop();
    };

    window.addEventListener('gamepadconnected', start);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    if (getPads().some(Boolean)) start(); // a pad may already be connected before mount

    return () => {
      stop();
      window.removeEventListener('gamepadconnected', start);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, [enabled]);
}
