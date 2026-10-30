/** ADR-029: the big-network Stockfish wasm (99 MB) is never hosted here; it is downloaded once, verified and kept in the Cache API. */

export type WasmSpec = { url: string; sha256: string; bytes: number };

/** Must match `VERSION` in scripts/vendor-engine.mjs (a test checks it): the vendored `stockfish-19.js` expects this wasm. */
export const STOCKFISH_VERSION = '19.0.1';

export const FULL_WASM: WasmSpec = {
  url: `https://unpkg.com/stockfish@${STOCKFISH_VERSION}/bin/stockfish-19.wasm`,
  sha256: 'a599d78d72e0722d8895be84aca8b492d12e8bba3cdfcbcbc4a64017888c6667',
  bytes: 99_076_105,
};

const CACHE_NAME = 'zugzwang-engine';

export type WasmErrorKind = 'quota' | 'network' | 'size' | 'hash' | 'aborted';

export class WasmDownloadError extends Error {
  override name = 'WasmDownloadError';
  constructor(readonly kind: WasmErrorKind) {
    super(kind);
  }
}

export type WasmDeps = {
  fetch: typeof globalThis.fetch;
  caches: CacheStorage;
  /** `navigator.storage`; where it is missing the quota is only found out when saving. */
  storage?: Pick<StorageManager, 'estimate'>;
};

const hex = (digest: ArrayBuffer) =>
  Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');

/** The verified wasm, or `undefined` if it was never downloaded or the browser evicted it. Never touches the network. */
export async function cachedWasm({ url }: WasmSpec, caches: CacheStorage): Promise<Blob | undefined> {
  const res = await (await caches.open(CACHE_NAME)).match(url);
  return res?.blob();
}

/** "Desactivar y borrar": frees the 99 MB. */
export const removeWasm = (caches: CacheStorage): Promise<boolean> => caches.delete(CACHE_NAME);

/**
 * Downloads, verifies and caches the wasm. Anything that goes wrong leaves nothing in the cache (a previous copy
 * included, so a new version replaces the old one) and throws a `WasmDownloadError` whose `kind` says why.
 * Progress is in bytes against the pinned size: unpkg sends gzip without `Content-Length`.
 */
export async function downloadWasm(
  { url, sha256, bytes }: WasmSpec,
  { fetch, caches, storage }: WasmDeps,
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (done: number) => void } = {},
): Promise<void> {
  await removeWasm(caches);
  const { quota, usage } = (await storage?.estimate()) ?? {};
  if (quota !== undefined && usage !== undefined && quota - usage < bytes) throw new WasmDownloadError('quota');

  const body = await fetchBody(fetch, url, signal);
  const data = new Uint8Array(bytes);
  let done = 0;
  const reader = body.getReader();
  for (;;) {
    const { value, done: finished } = await reader.read().catch(() => {
      throw new WasmDownloadError(signal?.aborted ? 'aborted' : 'network');
    });
    if (signal?.aborted) {
      stop(reader);
      throw new WasmDownloadError('aborted');
    }
    if (finished) break;
    if (done + value.length > bytes) {
      stop(reader);
      throw new WasmDownloadError('size');
    }
    data.set(value, done);
    done += value.length;
    onProgress?.(done);
  }
  if (done !== bytes) throw new WasmDownloadError('size');
  if (hex(await crypto.subtle.digest('SHA-256', data)) !== sha256) throw new WasmDownloadError('hash');

  try {
    await (await caches.open(CACHE_NAME)).put(
      url,
      new Response(data, { headers: { 'Content-Type': 'application/wasm' } }),
    );
  } catch {
    await removeWasm(caches);
    throw new WasmDownloadError('quota');
  }
}

/** Cancelling a stream that already failed rejects; there is nothing left to free then. */
const stop = (reader: ReadableStreamDefaultReader) => void reader.cancel().catch(() => {});

async function fetchBody(fetch: WasmDeps['fetch'], url: string, signal?: AbortSignal) {
  try {
    const res = await fetch(url, signal && { signal });
    if (res.ok && res.body) return res.body;
  } catch {
    if (signal?.aborted) throw new WasmDownloadError('aborted');
  }
  throw new WasmDownloadError('network');
}
