import { describe, expect, it } from 'vitest';
import { matches, sha256 } from './vendor-engine.mjs';

describe('vendor-engine', () => {
  it('accepts bytes whose SHA-256 matches and rejects any other', () => {
    const bytes = new TextEncoder().encode('abc');
    const hash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(sha256(bytes)).toBe(hash);
    expect(matches(bytes, hash)).toBe(true);
    expect(matches(new TextEncoder().encode('abd'), hash)).toBe(false);
  });
});
