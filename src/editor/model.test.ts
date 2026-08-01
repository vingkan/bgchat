import { describe, expect, it } from 'vitest';
import type { CheckChoice, StoryFile } from '../story/types';
import { fromStoryFile, initialState, toStoryFile, type EditorNode, type EditorState } from './model';

// A minimal EditorState with one node and optional skill-modifier overrides.
function stateWith(node: EditorNode, mods: Record<string, number> = {}): EditorState {
  const base = initialState();
  return {
    ...base,
    start: node.id,
    nodes: { [node.id]: node },
    order: [node.id],
    skillMods: { ...base.skillMods, ...mods },
  };
}

const simpleNode = (): EditorNode => ({
  id: 'n1',
  speaker: 'A',
  text: 'hi',
  video: '',
  choices: [{ kind: 'simple', label: 'go', next: '' }],
  x: 10,
  y: 20,
});

const checkNode = (skill: string): EditorNode => ({
  id: 'n1',
  speaker: 'A',
  text: 'hi',
  video: '',
  choices: [{ kind: 'check', label: 'try', skill, dc: 15, onSuccess: '', onFailure: '' }],
  x: 0,
  y: 0,
});

describe('toStoryFile skillModifiers', () => {
  it('persists a modifier for a skill NO node checks (the round-trip bug fix)', () => {
    const file = toStoryFile(stateWith(simpleNode(), { Stealth: 5 }));
    expect(file.skillModifiers).toEqual({ Stealth: 5 });
    const back = fromStoryFile(file);
    expect(back.skillMods.Stealth).toBe(5);
  });

  it('emits only non-zero entries (zeros are the default)', () => {
    const file = toStoryFile(stateWith(simpleNode())); // all mods zero
    expect(file.skillModifiers).toBeUndefined();
  });

  it('still bakes the modifier onto each check AND records it in the table', () => {
    const file = toStoryFile(stateWith(checkNode('Persuasion'), { Persuasion: 3 }));
    const c = file.nodes.n1.choices[0] as CheckChoice;
    expect(c.modifier).toBe(3);
    expect(file.skillModifiers).toEqual({ Persuasion: 3 });
  });
});

describe('fromStoryFile skillModifiers', () => {
  it('lets the table win over a modifier baked onto a check', () => {
    const file: StoryFile = {
      start: 'n1',
      nodes: {
        n1: {
          id: 'n1',
          speaker: 'A',
          text: 'hi',
          video: '',
          choices: [{ kind: 'check', label: 'try', skill: 'Arcana', dc: 15, modifier: 2, onSuccess: '', onFailure: '' }],
        },
      },
      skillModifiers: { Arcana: 7 },
    };
    expect(fromStoryFile(file).skillMods.Arcana).toBe(7);
  });

  it('recovers a baked modifier for older files without a table', () => {
    const file: StoryFile = {
      start: 'n1',
      nodes: {
        n1: {
          id: 'n1',
          speaker: 'A',
          text: 'hi',
          video: '',
          choices: [{ kind: 'check', label: 'try', skill: 'History', dc: 15, modifier: 4, onSuccess: '', onFailure: '' }],
        },
      },
    };
    expect(fromStoryFile(file).skillMods.History).toBe(4);
  });

  it('assigns every node a position on import', () => {
    const file = toStoryFile(stateWith(simpleNode(), { Stealth: 5 }));
    const back = fromStoryFile(file);
    expect(typeof back.nodes.n1.x).toBe('number');
    expect(typeof back.nodes.n1.y).toBe('number');
  });
});
