import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FILES, matches, sha256, unverified } from './vendor-engine.mjs';

describe('vendor-engine', () => {
  it('accepts bytes whose SHA-256 matches and rejects any other', () => {
    const bytes = new TextEncoder().encode('abc');
    const hash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(sha256(bytes)).toBe(hash);
    expect(matches(bytes, hash)).toBe(true);
    expect(matches(new TextEncoder().encode('abd'), hash)).toBe(false);
  });

  it('--check: the engine files committed in public/engine are the pinned ones', async () => {
    expect(await unverified()).toEqual([]);
  });

  it('--check: lists the files that are missing or altered', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'engine-'));
    try {
      const names = FILES.map(([, name]) => name);
      await writeFile(join(dir, names[0] as string), 'tampered');
      expect(await unverified(dir)).toEqual(names);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
