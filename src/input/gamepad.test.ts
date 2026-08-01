import { describe, expect, it } from 'vitest';
import {
  STANDARD_BUTTON_MAP,
  mappingFor,
  readNavPresses,
  type PressedState,
} from './gamepad';

// A minimal standard-mapping pad: `pressed` button indices + optional stick axes.
function pad(pressed: number[] = [], axes: number[] = [0, 0, 0, 0]): Gamepad {
  const down = new Set(pressed);
  const buttons = Array.from({ length: 17 }, (_, i) => ({
    pressed: down.has(i),
    touched: down.has(i),
    value: down.has(i) ? 1 : 0,
  }));
  return {
    buttons,
    axes,
    connected: true,
    id: 'Wireless Controller (STANDARD GAMEPAD)',
    index: 0,
    mapping: 'standard',
    timestamp: 0,
    vibrationActuator: null,
  } as unknown as Gamepad;
}

describe('mappingFor', () => {
  it('maps a standard pad to the standard table (Cross=select, Circle=back, D-pad=12-15)', () => {
    expect(mappingFor(pad())).toBe(STANDARD_BUTTON_MAP);
    expect(STANDARD_BUTTON_MAP[0]).toBe('select');
    expect(STANDARD_BUTTON_MAP[1]).toBe('back');
    expect(STANDARD_BUTTON_MAP[13]).toBe('down');
  });
});

describe('readNavPresses', () => {
  it('emits a press on the rising edge of a D-pad button', () => {
    const { presses, pressed } = readNavPresses([pad([13])], {});
    expect(presses).toEqual(['down']);
    expect(pressed.down).toBe(true);
  });

  it('does NOT repeat while the button is held (edge-triggered)', () => {
    const prev: PressedState = { down: true };
    expect(readNavPresses([pad([13])], prev).presses).toEqual([]);
  });

  it('fires again after a release and re-press', () => {
    const held = readNavPresses([pad([13])], { down: true }); // holding -> nothing
    const released = readNavPresses([pad([])], held.pressed); // let go
    expect(released.presses).toEqual([]);
    const again = readNavPresses([pad([13])], released.pressed); // press again -> edge
    expect(again.presses).toEqual(['down']);
  });

  it('maps Cross to select and Circle to back', () => {
    expect(readNavPresses([pad([0])], {}).presses).toEqual(['select']);
    expect(readNavPresses([pad([1])], {}).presses).toEqual(['back']);
  });

  it('reads the left stick as a direction past the deadzone', () => {
    expect(readNavPresses([pad([], [0, -0.9])], {}).presses).toEqual(['up']);
    expect(readNavPresses([pad([], [0.9, 0])], {}).presses).toEqual(['right']);
  });

  it('ignores stick drift inside the deadzone', () => {
    expect(readNavPresses([pad([], [0.3, -0.3])], {}).presses).toEqual([]);
  });

  it('reports multiple simultaneous presses', () => {
    const { presses } = readNavPresses([pad([12, 0])], {});
    expect(presses).toContain('up');
    expect(presses).toContain('select');
  });

  it('is inert with no pads connected', () => {
    expect(readNavPresses([null, null], {}).presses).toEqual([]);
  });
});
