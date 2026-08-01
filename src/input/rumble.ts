// Controller haptics for dice-roll results, via the Gamepad Haptics API
// (`gamepad.vibrationActuator.playEffect('dual-rumble', ...)`). This path is scoped to
// real game controllers by definition — it never touches `navigator.vibrate` (the phone
// buzzer) — so only a connected pad ever rumbles. Best-effort: every access is guarded and
// every rejection swallowed, so a missing API / null actuator never throws into gameplay.
// Web-only (the installed PWA doesn't expose it), matching our web-only controller support.

// One dual-rumble step. `strong` = low-frequency heavy motor, `weak` = high-frequency buzzy
// motor (both 0..1). A pattern is a sequence of steps played back to back.
interface RumbleStep {
  duration: number;
  strong: number;
  weak: number;
}

// SUCCESS: two quick ascending beats — light tap, then a stronger one. Reads as "ta-DA".
const SUCCESS: RumbleStep[] = [
  { duration: 120, strong: 0.35, weak: 0.5 },
  { duration: 70, strong: 0, weak: 0 }, // gap
  { duration: 260, strong: 0.9, weak: 0.7 },
];

// FAILURE: one long, heavy, low rumble that lingers then fades — a single "thunk".
// Distinct from success by rhythm (one beat vs two) and by leaning on the heavy motor.
const FAILURE: RumbleStep[] = [
  { duration: 450, strong: 1.0, weak: 0.15 },
  { duration: 180, strong: 0.4, weak: 0 }, // tail-off
];

// A minimal shape for the actuator we use; the DOM lib types don't always include it.
interface VibrationActuator {
  playEffect(type: 'dual-rumble', params: {
    duration: number;
    strongMagnitude: number;
    weakMagnitude: number;
  }): Promise<string>;
}

function actuatorOf(pad: Gamepad | null): VibrationActuator | null {
  const act = (pad as unknown as { vibrationActuator?: VibrationActuator } | null)?.vibrationActuator;
  return act && typeof act.playEffect === 'function' ? act : null;
}

// Play the steps in order by awaiting each effect's completion promise, so we get a real
// sequence without juggling timers. Swallow any rejection — haptics must never break play.
async function playPattern(actuator: VibrationActuator, steps: RumbleStep[]): Promise<void> {
  try {
    for (const s of steps) {
      await actuator.playEffect('dual-rumble', {
        duration: s.duration,
        strongMagnitude: s.strong,
        weakMagnitude: s.weak,
      });
    }
  } catch {
    /* actuator may reject if the pad disconnects mid-pattern; ignore */
  }
}

// Rumble every connected controller with the pattern for this roll outcome. No-op when
// there's no Gamepad API (jsdom) and for any pad without a working vibration actuator.
export function rumbleResult(success: boolean): void {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
  const steps = success ? SUCCESS : FAILURE;
  for (const pad of navigator.getGamepads() ?? []) {
    const actuator = actuatorOf(pad);
    if (actuator) void playPattern(actuator, steps);
  }
}
