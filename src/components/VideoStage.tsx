import { useEffect, useRef, useState } from 'react';
import { playSafely } from './video';

interface Props {
  src: string; // '' = no clip yet, show the ambient placeholder
  started: boolean; // becomes true after the Begin gesture (unlocks playback)
  muted: boolean;
}

// The film frame. Renders a real <video> when the node names a clip, otherwise the
// ambient placeholder (CSS gradient). Falls back to the placeholder if a clip fails
// to load in production, so a missing/renamed file never shows a blank rectangle.
export function VideoStage({ src, started, muted }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  // Reset the failed flag whenever the source changes.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  // (Re)start playback when the clip or the gesture-unlock changes.
  useEffect(() => {
    const el = ref.current;
    if (!el || !src || failed || !started) return;
    playSafely(el);
  }, [src, started, failed]);

  const showPlaceholder = !src || failed;

  return (
    <div id="video">
      {!showPlaceholder && (
        <video
          ref={ref}
          className="clip"
          data-testid="clip"
          src={src}
          muted={muted}
          loop
          playsInline
          autoPlay={started}
          preload="metadata"
          onError={() => setFailed(true)}
        />
      )}
      <span className="video-label">character video</span>
    </div>
  );
}
