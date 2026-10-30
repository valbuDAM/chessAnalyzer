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
function workerTransport(url: string): Transport {
  const worker = new Worker(url);
  return {
    send: (command) => worker.postMessage(command),
    onLine: (callback) => {
      worker.onmessage = (event) => {
        if (typeof event.data === 'string') callback(event.data);
      };
    },
    onError: (callback) => {
      worker.onerror = (event) => callback(event.message || `Could not load ${url}`);
      worker.onmessageerror = () => callback('Unreadable message from the engine');
    },
    terminate: () => worker.terminate(),
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
