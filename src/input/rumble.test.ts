import { afterEach, describe, expect, it, vi } from 'vitest';
import { rumbleResult } from './rumble';

type PlayEffect = ReturnType<typeof vi.fn>;

// A pad whose vibrationActuator.playEffect is a spy that resolves like a real one.
function padWithActuator(): { pad: Gamepad; playEffect: PlayEffect } {
  const playEffect = vi.fn().mockResolvedValue('complete');
  const pad = { vibrationActuator: { playEffect } } as unknown as Gamepad;
  return { pad, playEffect };
}

function stubPads(pads: Array<Gamepad | null>) {
  vi.stubGlobal('navigator', { getGamepads: () => pads } as unknown as Navigator);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// playPattern awaits each step's promise, so let the microtask queue drain to see them all.
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

describe('rumbleResult', () => {
  it('plays the success pattern (light-then-strong, two beats + a gap)', async () => {
    const { pad, playEffect } = padWithActuator();
    stubPads([pad]);

    rumbleResult(true);
    await flush();

    expect(playEffect).toHaveBeenCalledTimes(3);
    expect(playEffect.mock.calls[0][0]).toBe('dual-rumble');
    // first beat is a light tap...
    expect(playEffect.mock.calls[0][1].strongMagnitude).toBe(0.35);
    // ...building to a stronger final beat.
    expect(playEffect.mock.calls[2][1].strongMagnitude).toBe(0.9);
  });

  it('plays the failure pattern (one heavy rumble, distinct from success)', async () => {
    const { pad, playEffect } = padWithActuator();
    stubPads([pad]);

    rumbleResult(false);
    await flush();

    // Different shape than success: fewer steps, and it opens at full heavy-motor strength.
    expect(playEffect).toHaveBeenCalledTimes(2);
    expect(playEffect.mock.calls[0][1].strongMagnitude).toBe(1.0);
  });

  it('rumbles every connected controller', async () => {
    const a = padWithActuator();
    const b = padWithActuator();
    stubPads([a.pad, b.pad]);

    rumbleResult(true);
    await flush();

    expect(a.playEffect).toHaveBeenCalled();
    expect(b.playEffect).toHaveBeenCalled();
  });

  it('no-ops without the Gamepad API (jsdom)', () => {
    vi.stubGlobal('navigator', {} as unknown as Navigator);
    expect(() => rumbleResult(true)).not.toThrow();
  });

  it('no-ops with no pads connected', () => {
    stubPads([null, null]);
    expect(() => rumbleResult(false)).not.toThrow();
  });

  it('skips a pad with no vibration actuator, without throwing', () => {
    const noActuator = { vibrationActuator: null } as unknown as Gamepad;
    stubPads([noActuator]);
    expect(() => rumbleResult(true)).not.toThrow();
  });
});
