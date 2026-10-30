import { cachedWasm, downloadWasm, FULL_WASM, removeWasm } from '../domain/engine/fullWasm.ts';
import { canOfferFull } from '../domain/engine/variant.ts';
import { detectVariant } from './createEngine.ts';

/** What the viewer needs of the deep mode (ADR-029); the tests replace it. */
export type DeepDeps = {
  cached(): Promise<Blob | undefined>;
  download(options: { signal: AbortSignal; onProgress(done: number): void }): Promise<void>;
  remove(): Promise<unknown>;
};

/** The deep mode of this browser, or `undefined` where it is not offered (ADR-029). */
export function detectDeep(): DeepDeps | undefined {
  let caches: CacheStorage | undefined;
  try {
    caches = globalThis.caches; // reading it throws in some private modes
  } catch {}
  if (
    !caches ||
    !canOfferFull({
      variant: detectVariant(),
      coarse: window.matchMedia?.('(pointer: coarse)')?.matches ?? false,
      deviceMemory: (navigator as { deviceMemory?: number }).deviceMemory,
    })
  )
    return undefined;
  const store = caches;
  return {
    cached: () => cachedWasm(FULL_WASM, store),
    download: (options) =>
      downloadWasm(
        FULL_WASM,
        { fetch: (...args) => fetch(...args), caches: store, storage: navigator.storage },
        options,
      ),
    remove: () => removeWasm(store),
  };
}
