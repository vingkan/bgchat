import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RollResult } from '../engine/engine';
import { DiceRoll } from './DiceRoll';

const IMPACT_MS = 500; // must match DiceRoll's reveal timer

function makeRoll(over: Partial<RollResult> = {}): RollResult {
  return {
    choiceLabel: 'Persuade',
    skill: 'Persuasion',
    dc: 12,
    die: 5,
    modifier: 0,
    total: 5,
    success: false,
    crit: null,
    ...over,
  };
}

function resultEl(c: HTMLElement) {
  return c.querySelector('.roll-result') as HTMLElement;
}
function faceText(c: HTMLElement) {
  return (c.querySelector('.die .val') as HTMLElement).textContent;
}

describe('DiceRoll', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reveals the result only after the impact timer fires', () => {
    const { container } = render(<DiceRoll roll={makeRoll()} onContinue={() => {}} />);
    // Pre-reveal: result hidden, face still the placeholder.
    expect(resultEl(container).classList.contains('visible')).toBe(false);
    expect(faceText(container)).toBe('?');

    act(() => vi.advanceTimersByTime(IMPACT_MS));
    expect(resultEl(container).classList.contains('visible')).toBe(true);
    expect(resultEl(container).textContent).toMatch(/Failure/);
    expect(faceText(container)).toBe('5');
  });

  it('REGRESSION: a new roll does NOT flash the previous result before animating', () => {
    const rollA = makeRoll({ die: 5, success: false, total: 5 });
    const { container, rerender } = render(<DiceRoll roll={rollA} onContinue={() => {}} />);
    act(() => vi.advanceTimersByTime(IMPACT_MS)); // land roll A -> "Failure" / 5 revealed
    expect(resultEl(container).classList.contains('visible')).toBe(true);
    expect(faceText(container)).toBe('5');

    // A second check arrives (fresh object). BEFORE any timer advance, the prior outcome
    // must already be gone: reset happens during render (pre-paint), not post-paint.
    const rollB = makeRoll({ die: 18, success: true, total: 18 });
    rerender(<DiceRoll roll={rollB} onContinue={() => {}} />);
    expect(resultEl(container).classList.contains('visible')).toBe(false);
    expect(faceText(container)).toBe('?');

    // And when B lands it shows B's result, not a stale A.
    act(() => vi.advanceTimersByTime(IMPACT_MS));
    expect(resultEl(container).classList.contains('visible')).toBe(true);
    expect(resultEl(container).textContent).toMatch(/Success/);
    expect(faceText(container)).toBe('18');
  });
});
