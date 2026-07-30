import { describe, expect, it, vi } from 'vitest';
import { playSafely, prefetchVideos } from './video';

const err = (name: string) => Object.assign(new Error(name), { name });

describe('playSafely', () => {
  it('swallows AbortError from an interrupted play (fast navigation)', () => {
    const el = { play: () => Promise.reject(err('AbortError')) };
    expect(() => playSafely(el)).not.toThrow();
  });

  it('swallows NotAllowedError from autoplay policy', () => {
    const el = { play: () => Promise.reject(err('NotAllowedError')) };
    expect(() => playSafely(el)).not.toThrow();
  });

  it('warns on an unexpected error but does not throw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = { play: () => Promise.reject(err('WeirdError')) };
    expect(() => playSafely(el)).not.toThrow();
    return Promise.resolve().then(() => {
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  it('tolerates a play() that returns undefined (older browsers)', () => {
    const el = { play: () => undefined as unknown as Promise<void> };
    expect(() => playSafely(el)).not.toThrow();
  });
});

describe('prefetchVideos', () => {
  it('injects prefetch links for non-empty paths and cleans them up', () => {
    const cleanup = prefetchVideos(['/video/a.webm', '', '/video/b.webm']);
    const links = document.head.querySelectorAll('link[rel="prefetch"]');
    expect(links).toHaveLength(2);
    cleanup();
    expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(0);
  });
});
