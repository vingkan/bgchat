import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { DialoguePlayer } from './components/DialoguePlayer';
import type { StoryFile } from './story/types';
import { sampleStory } from './story/sample';
import './App.css';

function App() {
  const [story, setStory] = useState<StoryFile>(sampleStory);
  const [Proto, setProto] = useState<ComponentType | null>(null);

  // Dev-only: Playwright loads a video fixture via ?e2eVideo. The import.meta.env.DEV
  // guard + dynamic import keep this out of the production bundle entirely.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('e2eVideo')) {
      void import('./story/e2eFixture').then((m) => setStory(m.e2eVideoStory));
    }
    // Dev-only dice animation lab (?diceProto). Same dead-code guard as above.
    if (params.has('diceProto')) {
      void import('./proto/DiceLab').then((m) => setProto(() => m.DiceLab));
    }
  }, []);

  if (Proto) return <Proto />;

  // key by the story's entry node so swapping stories fully remounts the player
  // (fresh engine state); without this, stale currentId would point at a node the
  // new story doesn't have.
  return <DialoguePlayer key={story.start} file={story} />;
}

export default App;
