// Video helpers, isolated so the tricky browser behavior is unit-testable.

// Play a video without letting the harmless rejections throw.
//
// HTMLMediaElement.play() returns a Promise that REJECTS in two expected cases:
//   - AbortError: a new load()/src interrupted this play (happens on fast node
//     advances — the player clicked through before the clip started).
//   - NotAllowedError: autoplay policy blocked it (no user gesture yet).
// Both are normal here and must be swallowed; anything else is a real bug worth a warn.
export function playSafely(el: Pick<HTMLVideoElement, 'play'>): void {
  const result = el.play();
  if (result && typeof (result as Promise<void>).catch === 'function') {
    (result as Promise<void>).catch((err: unknown) => {
      const name = (err as { name?: string } | null)?.name;
      if (name !== 'AbortError' && name !== 'NotAllowedError') {
        // eslint-disable-next-line no-console
        console.warn('video play() failed unexpectedly:', err);
      }
    });
  }
}

// Prefetch upcoming clips so the next transition plays instantly instead of
// stalling on network/decode. Injects <link rel="prefetch"> tags and returns a
// cleanup that removes them. No-op for empty paths (placeholder nodes).
export function prefetchVideos(paths: string[]): () => void {
  if (typeof document === 'undefined') return () => {};
  const links: HTMLLinkElement[] = [];
  for (const href of paths) {
    if (!href) continue;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'video';
    link.href = href;
    document.head.appendChild(link);
    links.push(link);
  }
  return () => links.forEach((l) => l.remove());
}
