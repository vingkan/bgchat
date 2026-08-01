// Editor data model for the dialogue-tree editor (?editor page).
//
// The editor works over an EditorState — the same shape as a StoryFile, but each
// node carries editor-only x/y canvas coordinates, and check choices DON'T store
// a modifier (it's derived on export from the ability the skill belongs to). A
// global abilityMods table holds one modifier per ability.
//
// Export strips x/y and fills each check's `modifier` from abilityMods, producing
// a clean StoryFile ready to paste into src/story/.

import type { Choice, DialogueNode, NodeId, StoryFile } from '../story/types';

// ─── Abilities & skills ──────────────────────────────────────────────────────
// Only the five abilities that own skills (no Constitution — nothing checks it).

export const ABILITIES = [
  'Strength',
  'Dexterity',
  'Intelligence',
  'Wisdom',
  'Charisma',
] as const;

export type Ability = (typeof ABILITIES)[number];

// Grouped skill list — drives the <optgroup> picker and the skill→ability lookup.
export const SKILL_GROUPS: { ability: Ability; skills: string[] }[] = [
  { ability: 'Strength', skills: ['Athletics'] },
  { ability: 'Dexterity', skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] },
  {
    ability: 'Intelligence',
    skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'],
  },
  {
    ability: 'Wisdom',
    skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'],
  },
  { ability: 'Charisma', skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'] },
];

export const SKILL_TO_ABILITY: Record<string, Ability> = Object.fromEntries(
  SKILL_GROUPS.flatMap((g) => g.skills.map((s) => [s, g.ability] as const)),
);

// Flat list of every skill — used to seed the per-skill modifier table.
export const ALL_SKILLS: string[] = SKILL_GROUPS.flatMap((g) => g.skills);

// ─── Difficulty tiers ────────────────────────────────────────────────────────
// Named tiers map to a numeric DC. "Impossible" is a guess (99) — easy to retune.

export const DC_TIERS: { name: string; dc: number }[] = [
  { name: 'Very easy', dc: 5 },
  { name: 'Easy', dc: 10 },
  { name: 'Medium', dc: 15 },
  { name: 'Hard', dc: 20 },
  { name: 'Very hard', dc: 25 },
  { name: 'Nearly impossible', dc: 30 },
  { name: 'Impossible', dc: 99 },
];

export function tierForDc(dc: number): string {
  const hit = DC_TIERS.find((t) => t.dc === dc);
  return hit ? hit.name : `DC ${dc}`;
}

// ─── Ability-modifier reference ──────────────────────────────────────────────
// Standard 5e mapping: modifier -> ability-score range. Used by the ability panel
// so you can see what each modifier "means" while editing. (5e puts +0 at 10–11.)

export const MODIFIER_TABLE: { mod: number; scores: string }[] = [
  { mod: -5, scores: '1' },
  { mod: -4, scores: '2–3' },
  { mod: -3, scores: '4–5' },
  { mod: -2, scores: '6–7' },
  { mod: -1, scores: '8–9' },
  { mod: 0, scores: '10–11' },
  { mod: 1, scores: '12–13' },
  { mod: 2, scores: '14–15' },
  { mod: 3, scores: '16–17' },
  { mod: 4, scores: '18–19' },
  { mod: 5, scores: '20–21' },
  { mod: 6, scores: '22–23' },
  { mod: 7, scores: '24–25' },
  { mod: 8, scores: '26–27' },
  { mod: 9, scores: '28–29' },
  { mod: 10, scores: '30' },
];

export function scoresForMod(mod: number): string {
  return MODIFIER_TABLE.find((m) => m.mod === mod)?.scores ?? '';
}

// ─── Video registry ──────────────────────────────────────────────────────────
// The clips available under public/video/. "" means "no clip" (ambient placeholder).

export const VIDEOS: string[] = [
  '/video/considering.mp4',
  '/video/gesticulating.mp4',
  '/video/opening.mp4',
  '/video/pointing.mp4',
  '/video/wagging.mp4',
];

// ─── Editor state ────────────────────────────────────────────────────────────

export interface EditorNode extends DialogueNode {
  x: number;
  y: number;
}

export interface EditorState {
  start: NodeId | null;
  nodes: Record<NodeId, EditorNode>;
  order: NodeId[]; // stable render order (insertion order)
  skillMods: Record<string, number>; // one modifier per skill (sub-ability)
  lastSpeaker: string; // autofilled onto the next new node
  selectedId: NodeId | null;
}

export type Handle = 'next' | 'success' | 'failure';

const STORAGE_KEY = 'bgchat-editor-v1';

function zeroSkillMods(): Record<string, number> {
  return ALL_SKILLS.reduce((acc, s) => ({ ...acc, [s]: 0 }), {} as Record<string, number>);
}

export function initialState(): EditorState {
  return {
    start: null,
    nodes: {},
    order: [],
    skillMods: zeroSkillMods(),
    lastSpeaker: '',
    selectedId: null,
  };
}

// A fresh unique id like "node_1", "node_2", ...
function freshId(nodes: Record<NodeId, EditorNode>): NodeId {
  let n = Object.keys(nodes).length + 1;
  while (nodes[`node_${n}`]) n += 1;
  return `node_${n}`;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'addNode'; x: number; y: number }
  | { type: 'selectNode'; id: NodeId | null }
  | { type: 'moveNode'; id: NodeId; x: number; y: number }
  | { type: 'deleteNode'; id: NodeId }
  | { type: 'setStart'; id: NodeId }
  | { type: 'renameNode'; id: NodeId; newId: NodeId }
  | { type: 'patchNode'; id: NodeId; patch: Partial<Pick<DialogueNode, 'speaker' | 'text' | 'video'>> }
  | { type: 'addChoice'; id: NodeId }
  | { type: 'removeChoice'; id: NodeId; index: number }
  | { type: 'moveChoice'; id: NodeId; from: number; to: number }
  | { type: 'patchChoice'; id: NodeId; index: number; patch: Partial<Choice> }
  | { type: 'setCheck'; id: NodeId; index: number; on: boolean }
  | { type: 'connect'; id: NodeId; index: number; handle: Handle; target: NodeId }
  | { type: 'setSkillMod'; skill: string; mod: number }
  | { type: 'load'; state: EditorState };

export function reducer(state: EditorState, action: EditorState | Action): EditorState {
  // Allow passing a whole state (used by import/restore).
  if ('nodes' in action && !('type' in action)) return action as EditorState;
  const a = action as Action;

  switch (a.type) {
    case 'load':
      return a.state;

    case 'addNode': {
      const id = freshId(state.nodes);
      const node: EditorNode = {
        id,
        speaker: state.lastSpeaker, // autofill from the last speaker used
        text: '',
        video: '',
        choices: [],
        x: a.x,
        y: a.y,
      };
      return {
        ...state,
        nodes: { ...state.nodes, [id]: node },
        order: [...state.order, id],
        start: state.start ?? id, // first node becomes the start
        selectedId: id,
      };
    }

    case 'selectNode':
      return { ...state, selectedId: a.id };

    case 'moveNode': {
      const n = state.nodes[a.id];
      if (!n) return state;
      return { ...state, nodes: { ...state.nodes, [a.id]: { ...n, x: a.x, y: a.y } } };
    }

    case 'deleteNode': {
      const { [a.id]: _gone, ...rest } = state.nodes;
      // Drop dangling targets that pointed at the deleted node.
      const nodes: Record<NodeId, EditorNode> = {};
      for (const [nid, n] of Object.entries(rest)) {
        nodes[nid] = { ...n, choices: n.choices.map((c) => clearTarget(c, a.id)) };
      }
      return {
        ...state,
        nodes,
        order: state.order.filter((x) => x !== a.id),
        start: state.start === a.id ? (state.order.find((x) => x !== a.id) ?? null) : state.start,
        selectedId: state.selectedId === a.id ? null : state.selectedId,
      };
    }

    case 'setStart':
      return { ...state, start: a.id };

    case 'renameNode': {
      const newId = a.newId.trim();
      if (!newId || newId === a.id) return state;
      if (state.nodes[newId]) return state; // collision — ignore (UI blocks)
      const old = state.nodes[a.id];
      if (!old) return state;
      const nodes: Record<NodeId, EditorNode> = {};
      for (const [nid, n] of Object.entries(state.nodes)) {
        const key = nid === a.id ? newId : nid;
        const renamed = nid === a.id ? { ...n, id: newId } : n;
        nodes[key] = { ...renamed, choices: renamed.choices.map((c) => retarget(c, a.id, newId)) };
      }
      return {
        ...state,
        nodes,
        order: state.order.map((x) => (x === a.id ? newId : x)),
        start: state.start === a.id ? newId : state.start,
        selectedId: state.selectedId === a.id ? newId : state.selectedId,
      };
    }

    case 'patchNode': {
      const n = state.nodes[a.id];
      if (!n) return state;
      // Remember the last non-empty speaker to autofill the next new node.
      const lastSpeaker = a.patch.speaker ? a.patch.speaker : state.lastSpeaker;
      return { ...state, lastSpeaker, nodes: { ...state.nodes, [a.id]: { ...n, ...a.patch } } };
    }

    case 'addChoice': {
      const n = state.nodes[a.id];
      if (!n) return state;
      const choice: Choice = { kind: 'simple', label: '', next: '' };
      return {
        ...state,
        nodes: { ...state.nodes, [a.id]: { ...n, choices: [...n.choices, choice] } },
      };
    }

    case 'setCheck': {
      const n = state.nodes[a.id];
      if (!n) return state;
      const choices = n.choices.map((c, i) => {
        if (i !== a.index) return c;
        if (a.on && c.kind === 'simple') {
          // Convert simple -> check, carrying the wired target into onSuccess.
          return { kind: 'check', label: c.label, skill: 'Persuasion', dc: 15, onSuccess: c.next, onFailure: '' } as Choice;
        }
        if (!a.on && c.kind === 'check') {
          // Convert check -> simple, carrying onSuccess back into next.
          return { kind: 'simple', label: c.label, next: c.onSuccess } as Choice;
        }
        return c;
      });
      return { ...state, nodes: { ...state.nodes, [a.id]: { ...n, choices } } };
    }

    case 'removeChoice': {
      const n = state.nodes[a.id];
      if (!n) return state;
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [a.id]: { ...n, choices: n.choices.filter((_, i) => i !== a.index) },
        },
      };
    }

    case 'moveChoice': {
      const n = state.nodes[a.id];
      if (!n) return state;
      const { from, to } = a;
      if (from === to || from < 0 || to < 0 || from >= n.choices.length || to >= n.choices.length) {
        return state;
      }
      const choices = [...n.choices];
      const [moved] = choices.splice(from, 1);
      choices.splice(to, 0, moved);
      return { ...state, nodes: { ...state.nodes, [a.id]: { ...n, choices } } };
    }

    case 'patchChoice': {
      const n = state.nodes[a.id];
      if (!n) return state;
      const choices = n.choices.map((c, i) =>
        i === a.index ? ({ ...c, ...a.patch } as Choice) : c,
      );
      return { ...state, nodes: { ...state.nodes, [a.id]: { ...n, choices } } };
    }

    case 'connect': {
      const n = state.nodes[a.id];
      if (!n || !state.nodes[a.target]) return state;
      const choices = n.choices.map((c, i) => {
        if (i !== a.index) return c;
        if (a.handle === 'next' && c.kind === 'simple') return { ...c, next: a.target };
        if (a.handle === 'success' && c.kind === 'check') return { ...c, onSuccess: a.target };
        if (a.handle === 'failure' && c.kind === 'check') return { ...c, onFailure: a.target };
        return c;
      });
      return { ...state, nodes: { ...state.nodes, [a.id]: { ...n, choices } } };
    }

    case 'setSkillMod':
      return { ...state, skillMods: { ...state.skillMods, [a.skill]: a.mod } };

    default:
      return state;
  }
}

// Clear any target on a choice that points at `gone` (after deletion).
function clearTarget(c: Choice, gone: NodeId): Choice {
  if (c.kind === 'simple') return c.next === gone ? { ...c, next: '' } : c;
  return {
    ...c,
    onSuccess: c.onSuccess === gone ? '' : c.onSuccess,
    onFailure: c.onFailure === gone ? '' : c.onFailure,
  };
}

// Rewrite any target `from` -> `to` on a choice (after a rename).
function retarget(c: Choice, from: NodeId, to: NodeId): Choice {
  if (c.kind === 'simple') return c.next === from ? { ...c, next: to } : c;
  return {
    ...c,
    onSuccess: c.onSuccess === from ? to : c.onSuccess,
    onFailure: c.onFailure === from ? to : c.onFailure,
  };
}

// ─── Export / import ─────────────────────────────────────────────────────────

// Build a clean StoryFile: drop x/y, fill each check's modifier from the ability
// its skill belongs to.
export function toStoryFile(state: EditorState): StoryFile {
  const nodes: Record<NodeId, DialogueNode> = {};
  for (const id of state.order) {
    const n = state.nodes[id];
    if (!n) continue;
    nodes[id] = {
      id: n.id,
      speaker: n.speaker,
      text: n.text,
      video: n.video,
      choices: n.choices.map((c) => {
        if (c.kind === 'check') {
          const modifier = state.skillMods[c.skill] ?? 0;
          return {
            kind: 'check',
            label: c.label,
            skill: c.skill,
            dc: c.dc,
            modifier,
            onSuccess: c.onSuccess,
            onFailure: c.onFailure,
          };
        }
        return { kind: 'simple', label: c.label, next: c.next };
      }),
    };
  }
  return { start: state.start ?? state.order[0] ?? '', nodes };
}

// Build EditorState from a StoryFile, laying nodes out in columns by BFS depth
// from start (imported JSON has no positions). Modifiers on checks seed the
// ability table (last one wins per ability).
export function fromStoryFile(file: StoryFile): EditorState {
  const ids = Object.keys(file.nodes);
  const depth = bfsDepths(file);
  const perColumn: Record<number, number> = {};
  const COL_W = 320;
  const ROW_H = 200;

  const nodes: Record<NodeId, EditorNode> = {};
  const order: NodeId[] = [];
  const skillMods = zeroSkillMods();

  for (const id of ids) {
    const src = file.nodes[id];
    const d = depth[id] ?? 0;
    const row = perColumn[d] ?? 0;
    perColumn[d] = row + 1;
    nodes[id] = { ...src, x: 60 + d * COL_W, y: 60 + row * ROW_H };
    order.push(id);
    for (const c of src.choices) {
      if (c.kind === 'check' && typeof c.modifier === 'number') {
        skillMods[c.skill] = c.modifier;
      }
    }
  }

  return { start: file.start || ids[0] || null, nodes, order, skillMods, lastSpeaker: '', selectedId: null };
}

function bfsDepths(file: StoryFile): Record<NodeId, number> {
  const depth: Record<NodeId, number> = {};
  const queue: NodeId[] = [];
  if (file.start && file.nodes[file.start]) {
    depth[file.start] = 0;
    queue.push(file.start);
  }
  while (queue.length) {
    const id = queue.shift() as NodeId;
    const node = file.nodes[id];
    if (!node) continue;
    for (const c of node.choices) {
      const targets = c.kind === 'check' ? [c.onSuccess, c.onFailure] : [c.next];
      for (const t of targets) {
        if (t && file.nodes[t] && depth[t] === undefined) {
          depth[t] = depth[id] + 1;
          queue.push(t);
        }
      }
    }
  }
  return depth;
}

// ─── sessionStorage persistence ──────────────────────────────────────────────

export function saveToSession(state: EditorState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full / unavailable — the in-memory state is still the source of truth.
  }
}

export function loadFromSession(): EditorState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EditorState;
    if (!parsed || typeof parsed !== 'object' || !parsed.nodes) return null;
    // Backfill skillMods in case an older snapshot is missing a skill.
    return { ...initialState(), ...parsed, skillMods: { ...zeroSkillMods(), ...parsed.skillMods } };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
