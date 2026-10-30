import type { Engine } from '../domain/engine/engine.ts';
import { type AnalysisSettings, analysisSettings, uciOptions } from '../domain/engine/settings.ts';
import { type Transport, UciEngine } from '../domain/engine/UciEngine.ts';
import { selectVariant, VARIANT_FILES, type Variant } from '../domain/engine/variant.ts';

/** What this browser can run (ADR-008). Threads also need `SharedArrayBuffer`, which only exists when cross-origin isolated. */
export const detectVariant = (): Variant =>
  selectVariant({
    wasm: typeof WebAssembly === 'object',
    threads: globalThis.crossOriginIsolated === true && typeof SharedArrayBuffer === 'function',
  });

// Each Stockfish build is its own Worker: UCI goes in and out as plain strings.
// `release` runs once, when the engine says `uciok` or the worker fails or is terminated (ADR-029: frees the blob URL).
function workerTransport(url: string, release?: () => void): Transport {
  const worker = new Worker(url);
  let released = false;
  const free = () => {
    if (!released) release?.();
    released = true;
  };
  return {
    send: (command) => worker.postMessage(command),
    onLine: (callback) => {
      worker.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        if (event.data === 'uciok') free();
        callback(event.data);
      };
    },
    onError: (callback) => {
      worker.onerror = (event) => {
        free();
        callback(event.message || `Could not load ${url}`);
      };
      worker.onmessageerror = () => callback('Unreadable message from the engine');
    },
    terminate: () => {
      free();
      worker.terminate();
    },
  };
}

/** ADR-009 for this device. "Mobile" is a touch-first pointer, the same test the CSS uses for touch targets. */
export const detectSettings = (variant: Variant = detectVariant()): AnalysisSettings =>
  analysisSettings({
    variant,
    cores: navigator.hardwareConcurrency || 1,
    mobile: window.matchMedia?.('(pointer: coarse)')?.matches ?? false,
  });

export const createEngine = (variant: Variant = detectVariant()): Engine =>
  new UciEngine(workerTransport(`${import.meta.env.BASE_URL}engine/${VARIANT_FILES[variant]}`), {
    options: uciOptions(detectSettings(variant)),
  });

/** ADR-029: the big-network build reads its wasm from the cached copy. It takes the path from the Worker's `#hash`. */
export function createFullEngine(wasm: Blob): Engine {
  const blobUrl = URL.createObjectURL(wasm);
  return new UciEngine(
    workerTransport(
      `${import.meta.env.BASE_URL}engine/${VARIANT_FILES['full-multi']}#${encodeURIComponent(blobUrl)}`,
      () => URL.revokeObjectURL(blobUrl),
    ),
    { options: uciOptions(detectSettings('full-multi')) },
  );
}
