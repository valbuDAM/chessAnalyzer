import 'fake-indexeddb/auto';
import { clear, get, set } from 'idb-keyval';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WhiteScore } from './analysis.ts';
import { readAnalysis, writeAnalysis } from './analysisCache.ts';

vi.mock('idb-keyval', async (importOriginal) => {
  const idb = await importOriginal<typeof import('idb-keyval')>();
  return { ...idb, get: vi.fn(idb.get), set: vi.fn(idb.set) };
});

const FENS = ['fen-0', 'fen-1', 'fen-2'];
const SCORES: WhiteScore[] = [
  { kind: 'cp', cp: 20 },
  { kind: 'mate', mate: -3 },
  { kind: 'final', winner: 'black' },
];
const SETTINGS = { variant: 'lite-single', depth: 12 } as const;

beforeEach(async () => {
  await clear();
  vi.mocked(get).mockClear();
  vi.mocked(set).mockClear();
});

describe('analysis cache', () => {
  it('returns what was written for the same game, variant and depth', async () => {
    await writeAnalysis(FENS, SETTINGS, SCORES);
    expect(await readAnalysis(FENS, SETTINGS)).toEqual(SCORES);
  });

  it('misses on a different game, variant or depth', async () => {
    await writeAnalysis(FENS, SETTINGS, SCORES);
    expect(await readAnalysis([...FENS, 'fen-3'], SETTINGS)).toBeUndefined();
    expect(await readAnalysis(FENS, { ...SETTINGS, variant: 'lite-multi' })).toBeUndefined();
    expect(await readAnalysis(FENS, { ...SETTINGS, depth: 16 })).toBeUndefined();
  });

  it('does not confuse games whose positions concatenate to the same text', async () => {
    await writeAnalysis(['ab', 'c'], SETTINGS, SCORES.slice(0, 2));
    expect(await readAnalysis(['a', 'bc'], SETTINGS)).toBeUndefined();
  });

  it('ignores an entry that does not fit the game (partial or from another schema)', async () => {
    await writeAnalysis(FENS, SETTINGS, SCORES);
    const key = vi.mocked(set).mock.calls[0]?.[0] as string;
    await set(key, SCORES.slice(0, 2));
    expect(await readAnalysis(FENS, SETTINGS)).toBeUndefined();
    await set(key, 'garbage');
    expect(await readAnalysis(FENS, SETTINGS)).toBeUndefined();
  });

  it('carries on without cache when IndexedDB fails', async () => {
    vi.mocked(get).mockRejectedValueOnce(new DOMException('', 'SecurityError'));
    vi.mocked(set).mockRejectedValueOnce(new DOMException('', 'QuotaExceededError'));
    expect(await readAnalysis(FENS, SETTINGS)).toBeUndefined();
    await expect(writeAnalysis(FENS, SETTINGS, SCORES)).resolves.toBeUndefined();
  });
});
