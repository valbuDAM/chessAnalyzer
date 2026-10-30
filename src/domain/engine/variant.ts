export type Variant = 'full-multi' | 'lite-multi' | 'lite-single' | 'asm';

export type Capabilities = { wasm: boolean; threads: boolean };

/** Files in `public/engine/` (vendored by scripts/vendor-engine.mjs). */
export const VARIANT_FILES: Record<Variant, string> = {
  'full-multi': 'stockfish-19.js',
  'lite-multi': 'stockfish-19-lite.js',
  'lite-single': 'stockfish-19-lite-single.js',
  asm: 'stockfish-19-asm.js',
};

/**
 * ADR-029: `full-multi` (opt-in, downloaded) is offered only where lite already runs threaded, on a pointer-precise
 * device with 4 GB or more (or unknown): a memory hang is not covered by the fall back to lite.
 */
export const canOfferFull = ({
  variant,
  coarse,
  deviceMemory,
}: {
  variant: Variant;
  coarse: boolean;
  deviceMemory: number | undefined;
}) => variant === 'lite-multi' && !coarse && (deviceMemory ?? 4) >= 4;

/** ADR-008: the best build the browser can run. Threads need `SharedArrayBuffer`, i.e. cross-origin isolation. */
export function selectVariant({ wasm, threads }: Capabilities): Variant {
  if (!wasm) return 'asm';
  return threads ? 'lite-multi' : 'lite-single';
}
