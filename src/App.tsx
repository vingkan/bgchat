import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { DialoguePlayer } from './components/DialoguePlayer';
import type { StoryFile } from './story/types';
import { DEFAULT_KEY, normalizeKey, stories } from './story/registry';
import './App.css';

// The valid story key in the URL (?key=KEY), or null if absent/unknown.
function keyFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get('key');
  if (!raw) return null;
  const k = normalizeKey(raw);
  return k in stories ? k : null;
}

function App() {
  // Story key drives which story plays. A valid ?key= in the URL selects it and
  // skips the opening screen (started = true); otherwise we show the Begin gate
  // on the default story.
  const [storyKey, setStoryKey] = useState<string>(() => keyFromUrl() ?? DEFAULT_KEY);
  const [started, setStarted] = useState<boolean>(() => keyFromUrl() !== null);
  const [override, setOverride] = useState<StoryFile | null>(null); // dev e2e fixture
  const [Proto, setProto] = useState<ComponentType | null>(null);

  // Full-screen surfaces mounted via the Proto slot. The story editor ships
  // (usable in any build); the e2e/dice surfaces stay dev-only behind the guard.
  // All are dynamically imported so they're code-split out of the core path.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('editor')) {
      void import('./editor/EditorPage').then((m) => setProto(() => m.EditorPage));
      return;
    }
    if (!import.meta.env.DEV) return;
    if (params.has('e2eVideo')) {
      void import('./story/e2eFixture').then((m) => setOverride(m.e2eVideoStory));
    }
    if (params.has('diceProto')) {
      void import('./proto/DiceLab').then((m) => setProto(() => m.DiceLab));
    }
  }, []);

  if (Proto) return <Proto />;

  const story = override ?? stories[storyKey] ?? stories[DEFAULT_KEY];

  // Called by the Begin gate with the typed key. Empty => begin the current story.
  // A valid key => write ?key= and switch. Unknown => false so the gate shows an
  // error. Returns whether Begin should proceed.
  const handleBeginKey = (typed: string): boolean => {
    const k = normalizeKey(typed);
    if (!k) return true; // no key: begin whatever's loaded (default story)
    if (!(k in stories)) return false; // unknown key: gate surfaces the error
    const url = new URL(window.location.href);
    url.searchParams.set('key', k);
    window.history.replaceState({}, '', url);
    setStoryKey(k);
    setStarted(true);
    return true;
  };

  // Home returns to the key screen (the player flips its own `started` off). We only
  // tidy the URL — drop ?key= so a reload also lands on the gate. Progress is untouched:
  // the player stays mounted (in-memory state intact) and localStorage is not cleared.
  const handleHome = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('key');
    window.history.replaceState({}, '', url);
  };

  // Key by story key (not story.start) so switching stories remounts the player
  // and resets engine state — TEST and LOVE both start at node "gate", so keying
  // by start would fail to reset between them.
  return (
    <DialoguePlayer
      key={override ? 'e2e' : storyKey}
      file={story}
      // Real stories persist per-key; the dev e2e fixture stays storage-free.
      storageKey={override ? undefined : storyKey}
      initialStarted={started}
      onBeginKey={handleBeginKey}
      onHome={handleHome}
    />
  );
}

export default App;
