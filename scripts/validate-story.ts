// Build-gate story validator. Run via `yarn validate-story` (tsx), also wired into
// `yarn build` so a broken story FAILS THE BUILD instead of shipping.
//
// Two things beyond the dev-runtime check:
//   1. structural errors (dangling refs, id/key mismatch) — shared with the app
//   2. every referenced video exists on disk BY EXACT CASE. macOS dev is
//      case-insensitive, but Linux hosts (Netlify/Pages) are case-sensitive, so a
//      "/video/Gate.webm" that works locally 404s in production. This catches it.

import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stories } from '../src/story/registry';
import { referencedVideos, structuralErrors } from '../src/engine/validation';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, '..', 'public');

// Validate every story in the shared registry (keyed by its story key). Add new
// stories in src/story/registry.ts and they're covered here automatically.

const errors: string[] = [];

for (const [name, file] of Object.entries(stories)) {
  for (const e of structuralErrors(file)) errors.push(`[${name}] ${e}`);

  for (const vid of referencedVideos(file)) {
    const rel = vid.replace(/^\//, ''); // "/video/x.webm" -> "video/x.webm"
    const abs = join(PUBLIC, rel);
    if (!existsSync(abs)) {
      errors.push(`[${name}] video "${vid}" not found at public/${rel}`);
      continue;
    }
    // existsSync is case-insensitive on macOS — verify the exact filename is really
    // present in the directory listing.
    const base = basename(abs);
    if (!readdirSync(dirname(abs)).includes(base)) {
      errors.push(
        `[${name}] video "${vid}" case mismatch — no exact "${base}" on disk (works on macOS, 404s on Linux hosts)`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`✗ Story validation failed:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}

console.log('✓ Story validation passed');
