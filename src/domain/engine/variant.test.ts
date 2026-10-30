import { describe, expect, it } from 'vitest';
import { canOfferFull, selectVariant, VARIANT_FILES } from './variant.ts';

describe('canOfferFull (ADR-029)', () => {
  const ok = { variant: 'lite-multi', coarse: false, deviceMemory: 8 } as const;

  it.each([
    ['a desktop with memory to spare', ok, true],
    ['a browser that does not report its memory', { ...ok, deviceMemory: undefined }, true],
    ['exactly 4 GB', { ...ok, deviceMemory: 4 }, true],
    ['less than 4 GB', { ...ok, deviceMemory: 2 }, false],
    ['a touch-first device', { ...ok, coarse: true }, false],
    ['no threads', { ...ok, variant: 'lite-single' }, false],
    ['already on full', { ...ok, variant: 'full-multi' }, false],
  ] as const)('%s → %s', (_, input, expected) => {
    expect(canOfferFull(input)).toBe(expected);
  });
});

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
      'full-multi': 'stockfish-19.js',
      'lite-multi': 'stockfish-19-lite.js',
      'lite-single': 'stockfish-19-lite-single.js',
      asm: 'stockfish-19-asm.js',
    });
  });
});
