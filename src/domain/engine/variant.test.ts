import { describe, expect, it } from 'vitest';
import { selectVariant, VARIANT_FILES } from './variant.ts';

describe('selectVariant', () => {
  it.each([
    [{ wasm: true, threads: true }, 'lite-multi'],
    [{ wasm: true, threads: false }, 'lite-single'],
    [{ wasm: false, threads: false }, 'asm'],
    // Threads without WebAssembly cannot happen in a real browser, but the order of the chain must not depend on it.
    [{ wasm: false, threads: true }, 'asm'],
  ] as const)('%j → %s', (caps, variant) => {
    expect(selectVariant(caps)).toBe(variant);
  });

  it('maps each variant to the file vendored by scripts/vendor-engine.mjs', () => {
    expect(VARIANT_FILES).toEqual({
      'lite-multi': 'stockfish-19-lite.js',
      'lite-single': 'stockfish-19-lite-single.js',
      asm: 'stockfish-19-asm.js',
    });
  });
});
