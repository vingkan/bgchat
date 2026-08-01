import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DialogueNode, NodeId, StoryFile } from '../story/types';
import { ProgressTracker } from './ProgressTracker';

function node(id: NodeId, speaker: string): DialogueNode {
  return { id, speaker, text: '', video: '', choices: [] };
}

function story(nodes: DialogueNode[]): StoryFile {
  const map: Record<NodeId, DialogueNode> = {};
  for (const n of nodes) map[n.id] = n;
  return { start: nodes[0]?.id ?? 'a', nodes: map };
}

describe('ProgressTracker', () => {
  it('shows the combined explored percentage', () => {
    // visit 1 of 3 scenes, meet 1 of 3 speakers => 2/6 = 33%.
    const file = story([node('a', 'Alice'), node('b', 'Bob'), node('c', 'Cara')]);
    render(<ProgressTracker file={file} visited={['a']} />);
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('labels scenes and characters with unlocked / total counts', () => {
    const file = story([node('a', 'Alice'), node('b', 'Bob'), node('c', 'Cara')]);
    render(<ProgressTracker file={file} visited={['a', 'b']} />);
    expect(screen.getByText('Moments')).toBeInTheDocument();
    expect(screen.getByText('Characters')).toBeInTheDocument();
    // scenes 2/3, characters 2/3 — both the "2" and the "/ 3" appear twice.
    expect(screen.getAllByText('2').length).toBe(2);
    expect(screen.getAllByText('/ 3').length).toBe(2);
  });

  it('renders diamonds for the characters when there are few speakers', () => {
    const file = story([node('a', 'Alice'), node('b', 'Bob'), node('c', 'Cara')]);
    const { container } = render(<ProgressTracker file={file} visited={['a']} />);
    const pips = container.querySelectorAll('.progress-pips .pip');
    expect(pips.length).toBe(3); // one per unique speaker
    expect(container.querySelectorAll('.progress-pips .pip.on').length).toBe(1); // Alice met
  });

  it('renders a bar for the characters when there are many speakers', () => {
    const file = story(
      Array.from({ length: 11 }, (_, i) => node(`n${i}`, `Speaker ${i}`)),
    );
    const { container } = render(<ProgressTracker file={file} visited={['n0']} />);
    expect(container.querySelector('.progress-pips')).toBeNull();
    // scenes bar + characters bar = 2 bars.
    expect(container.querySelectorAll('.progress-bar').length).toBe(2);
  });

  it('always renders the scenes indicator as a bar', () => {
    const file = story([node('a', 'Alice'), node('b', 'Bob')]);
    const { container } = render(<ProgressTracker file={file} visited={['a']} />);
    expect(container.querySelector('.progress-bar')).not.toBeNull();
  });
});
