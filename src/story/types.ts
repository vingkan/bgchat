// Story data model for bgchat.
//
// The entire dialogue is DATA, not code: a StoryFile is a plain map of
// nodeId -> DialogueNode plus an entry point. The engine is a generic
// interpreter over this structure. Adding story content never requires a
// component change.
//
// Graph shape: a general DIRECTED graph. Cycles are allowed (A -> B -> A is
// legal); nothing in the engine assumes a DAG. `visited` handles re-entry.

export type NodeId = string;

// A single beat of dialogue.
export interface DialogueNode {
  // INVARIANT: `id` must equal this node's key in StoryFile.nodes.
  // Enforced by validateStory (not by the type system — Record keys are strings).
  id: NodeId;
  speaker: string; // character name shown on screen
  text: string; // the line the character says
  // Path to a local clip under public/, e.g. "/video/gate-intro.webm".
  // Empty string ("") means "no clip yet" — the UI shows the ambient placeholder.
  // validateStory only checks non-empty paths against real files on disk.
  video: string;
  choices: Choice[]; // empty array = terminal / ending node
  // When true, and this node's audio matters, the player nudges the viewer to
  // unmute on arrival (a pulsing "Sound on" ring on the footer Unmute control) —
  // but only while sound is still off. Optional; absent/false means no nudge.
  // Not editable in the story editor, but preserved across import/export.
  nudgeUnmute?: boolean;
}

// A choice is one of two transition types (discriminated union on `kind`).
export type Choice = SimpleChoice | CheckChoice;

// A plain transition: go straight to the next node.
export interface SimpleChoice {
  kind: 'simple';
  label: string; // what the player clicks
  next: NodeId; // where it goes
}

// A skill check: roll d20 + modifier vs a DC, branch on pass/fail.
export interface CheckChoice {
  kind: 'check';
  label: string; // e.g. "Persuade the guard"
  skill: string; // "Persuasion" — shown in the [tag]
  dc: number; // difficulty class, e.g. 15
  modifier?: number; // added to the d20 roll (default 0)
  onSuccess: NodeId;
  onFailure: NodeId;
}

// The whole story: an entry point plus the node map.
export interface StoryFile {
  start: NodeId;
  nodes: Record<NodeId, DialogueNode>;
  // Per-skill modifier table (e.g. { Stealth: 5, Persuasion: 2 }). Optional for
  // back-compat with older story files. When present, the engine reads a check's
  // modifier from here by its `skill`, so the same skill is consistent everywhere
  // and a modifier survives export/import even if no node currently checks it.
  // Falls back to a check's own `modifier` when a skill is absent here.
  skillModifiers?: Record<string, number>;
}

// The node id a choice leads to on its "primary" (success/next) path.
// Used for "seen"-branch styling in the UI.
export function primaryTarget(choice: Choice): NodeId {
  return choice.kind === 'check' ? choice.onSuccess : choice.next;
}

// Every node id a choice can transition to directly (both branches of a check).
export function choiceTargets(choice: Choice): NodeId[] {
  return choice.kind === 'check' ? [choice.onSuccess, choice.onFailure] : [choice.next];
}
