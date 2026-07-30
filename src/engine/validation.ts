// Story validation. Pure, environment-agnostic checks shared by two entry points:
//   1. the browser dev-runtime guard (validateStory, throws in dev)
//   2. the Node build-gate script (scripts/validate-story.ts, also checks video files)
// Record keys are plain strings, so TypeScript can't catch a typo'd `next`/`onSuccess`.
// This is what catches it instead — at dev-load and at build time.

import type { StoryFile } from '../story/types';

// References that point at a node id that doesn't exist.
export function findDanglingRefs(file: StoryFile): string[] {
  const errors: string[] = [];
  const ids = new Set(Object.keys(file.nodes));

  if (!ids.has(file.start)) {
    errors.push(`start node "${file.start}" does not exist`);
  }

  for (const [key, node] of Object.entries(file.nodes)) {
    for (const choice of node.choices) {
      if (choice.kind === 'simple') {
        if (!ids.has(choice.next)) {
          errors.push(`node "${key}": choice "${choice.label}" -> missing node "${choice.next}"`);
        }
      } else {
        if (!ids.has(choice.onSuccess)) {
          errors.push(
            `node "${key}": check "${choice.label}" onSuccess -> missing node "${choice.onSuccess}"`,
          );
        }
        if (!ids.has(choice.onFailure)) {
          errors.push(
            `node "${key}": check "${choice.label}" onFailure -> missing node "${choice.onFailure}"`,
          );
        }
      }
    }
  }
  return errors;
}

// Nodes whose `id` field doesn't match their key in the map.
export function findIdKeyMismatches(file: StoryFile): string[] {
  const errors: string[] = [];
  for (const [key, node] of Object.entries(file.nodes)) {
    if (node.id !== key) {
      errors.push(`node key "${key}" has mismatched id "${node.id}"`);
    }
  }
  return errors;
}

// Distinct non-empty video paths the story references (empty = ambient placeholder).
// The build-gate script checks each of these against a real on-disk file (exact case).
export function referencedVideos(file: StoryFile): string[] {
  const vids = new Set<string>();
  for (const node of Object.values(file.nodes)) {
    if (node.video) vids.add(node.video);
  }
  return [...vids];
}

// All structural errors (id/key + dangling refs). Video existence is checked
// separately at build time where the filesystem is available.
export function structuralErrors(file: StoryFile): string[] {
  return [...findIdKeyMismatches(file), ...findDanglingRefs(file)];
}

// Dev-runtime guard: throw loudly on a broken story. Tree-shaken out of prod builds
// by wrapping the call site in `if (import.meta.env.DEV)`.
export function validateStory(file: StoryFile): void {
  const errors = structuralErrors(file);
  if (errors.length > 0) {
    throw new Error(`Invalid story:\n  - ${errors.join('\n  - ')}`);
  }
}
