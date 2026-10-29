export type Variant = 'lite-multi' | 'lite-single' | 'asm';

export type Capabilities = { wasm: boolean; threads: boolean };

/** Files in `public/engine/` (vendored by scripts/vendor-engine.mjs). */
export const VARIANT_FILES: Record<Variant, string> = {
  'lite-multi': 'stockfish-19-lite.js',
  'lite-single': 'stockfish-19-lite-single.js',
  asm: 'stockfish-19-asm.js',
};

/** ADR-008: the best build the browser can run. Threads need `SharedArrayBuffer`, i.e. cross-origin isolation. */
export function selectVariant({ wasm, threads }: Capabilities): Variant {
  if (!wasm) return 'asm';
  return threads ? 'lite-multi' : 'lite-single';
}
