import { get, set } from 'idb-keyval';
import type { WhiteScore } from './analysis.ts';
import type { Variant } from './engine/variant.ts';

type Settings = { variant: Variant; depth: number };

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// The scores depend only on the positions, so the key hashes the FENs, not the PGN (comments and clocks do not matter).
// Bump `v1` when the shape of `WhiteScore` or the way it is computed changes.
const cacheKey = async (fens: string[], { variant, depth }: Settings) =>
  `analysis:v1:${variant}:${depth}:${await sha256Hex(fens.join('\n'))}`;

/** The saved analysis of this game, or undefined: never saved, a different engine or depth, or IndexedDB unavailable. */
export async function readAnalysis(fens: string[], settings: Settings): Promise<WhiteScore[] | undefined> {
  try {
    const saved = await get<unknown>(await cacheKey(fens, settings));
    return Array.isArray(saved) && saved.length === fens.length ? (saved as WhiteScore[]) : undefined;
  } catch {
    return undefined;
  }
}

// shortcut: entries are never evicted (a few KB per game), add an LRU limit if the quota ever fills up.
/** Saves a complete analysis; a full quota or a blocked IndexedDB just means no cache. */
export async function writeAnalysis(fens: string[], settings: Settings, scores: WhiteScore[]): Promise<void> {
  try {
    await set(await cacheKey(fens, settings), scores);
  } catch {}
}
