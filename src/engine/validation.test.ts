import { describe, expect, it } from 'vitest';
import type { StoryFile } from '../story/types';
import { sampleStory } from '../story/sample';
import {
  findDanglingRefs,
  findIdKeyMismatches,
  referencedVideos,
  structuralErrors,
  validateStory,
} from './validation';

const clone = (): StoryFile => structuredClone(sampleStory);

describe('validateStory (sample story)', () => {
  it('has no structural errors', () => {
    expect(structuralErrors(sampleStory)).toEqual([]);
  });

  it('does not throw', () => {
    expect(() => validateStory(sampleStory)).not.toThrow();
  });
});

describe('findDanglingRefs', () => {
  it('flags a simple choice pointing at a missing node', () => {
    const f = clone();
    (f.nodes.gate.choices[0] as { next: string }).next = 'nowhere';
    expect(findDanglingRefs(f).some((e) => e.includes('nowhere'))).toBe(true);
  });

  it('flags a check onSuccess and onFailure pointing at missing nodes', () => {
    const f = clone();
    const chk = f.nodes.gate.choices[1] as { onSuccess: string; onFailure: string };
    chk.onSuccess = 'ghostA';
    chk.onFailure = 'ghostB';
    const errs = findDanglingRefs(f);
    expect(errs.some((e) => e.includes('ghostA'))).toBe(true);
    expect(errs.some((e) => e.includes('ghostB'))).toBe(true);
  });

  it('flags a start node that does not exist', () => {
    const f = clone();
    f.start = 'missing-start';
    expect(findDanglingRefs(f).some((e) => e.includes('missing-start'))).toBe(true);
  });
});

describe('findIdKeyMismatches', () => {
  it('flags a node whose id does not match its key', () => {
    const f = clone();
    f.nodes.gate.id = 'not-gate';
    expect(findIdKeyMismatches(f).some((e) => e.includes('not-gate'))).toBe(true);
  });

  it('throws through validateStory on a mismatch', () => {
    const f = clone();
    f.nodes.truth.id = 'wrong';
    expect(() => validateStory(f)).toThrow(/mismatched id/);
  });
});

describe('referencedVideos', () => {
  it('returns empty for the placeholder-only sample story', () => {
    expect(referencedVideos(sampleStory)).toEqual([]);
  });

  it('collects distinct non-empty video paths', () => {
    const f = clone();
    f.nodes.gate.video = '/video/a.webm';
    f.nodes.truth.video = '/video/a.webm'; // duplicate
    f.nodes.enter.video = '/video/b.webm';
    expect(referencedVideos(f).sort()).toEqual(['/video/a.webm', '/video/b.webm']);
  });
});
