// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { FILES, VERSION } from '../../../scripts/vendor-engine.mjs';
import { cachedWasm, downloadWasm, FULL_WASM, removeWasm, type WasmDeps, type WasmSpec } from './fullWasm.ts';

const bytes = new TextEncoder().encode('0123456789');
// SHA-256 of the ten bytes above, from `printf 0123456789 | sha256sum`.
const spec: WasmSpec = {
  url: 'https://example.test/stockfish-19.wasm',
  sha256: '84d89877f0d4041efb6bf91a16f0248f2fd573e6af05c19f96bedb9f882f7882',
  bytes: 10,
};

const respond = (...chunks: Uint8Array[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { status: 200 },
  );

/** A CacheStorage that keeps entries in a Map; enough for one named cache. `putFails` makes saving throw, as a full disk does. */
function fakeCaches(putFails = false) {
  const store = new Map<string, Response>();
  const cache = {
    put: async (url: string, res: Response) => {
      if (putFails) throw new DOMException('', 'QuotaExceededError');
      store.set(url, res);
    },
    match: async (url: string) => store.get(url)?.clone(),
  };
  const caches = {
    open: async () => cache,
    delete: async () => {
      const had = store.size > 0;
      store.clear();
      return had;
    },
  };
  return { caches: caches as unknown as CacheStorage, store };
}

function setup(over: Partial<WasmDeps> = {}, putFails = false) {
  const { caches, store } = fakeCaches(putFails);
  const fetch = vi.fn(async () => respond(bytes.slice(0, 4), bytes.slice(4)));
  const deps: WasmDeps = { fetch: fetch as unknown as typeof globalThis.fetch, caches, ...over };
  return { deps, fetch, store };
}

describe('downloadWasm', () => {
  it('caches the verified wasm so a second lookup needs no network', async () => {
    const { deps, fetch } = setup();
    const progress: number[] = [];
    await downloadWasm(spec, deps, { onProgress: (done) => progress.push(done) });

    const blob = await cachedWasm(spec, deps.caches);
    expect(blob && new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
    expect(blob?.type).toBe('application/wasm');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(progress).toEqual([4, 10]);
  });

  it('downloads normally with enough room, or when the browser gives no estimate', async () => {
    for (const storage of [{ estimate: async () => ({ quota: 1e9, usage: 0 }) }, { estimate: async () => ({}) }]) {
      const { deps } = setup({ storage });
      await downloadWasm(spec, deps);
      expect(await cachedWasm(spec, deps.caches)).toBeDefined();
    }
  });
});

describe('downloadWasm failures leave nothing cached and say why', () => {
  const fails = async (deps: WasmDeps, kind: string, options = {}) => {
    await expect(downloadWasm(spec, deps, options)).rejects.toMatchObject({ kind });
    expect(await cachedWasm(spec, deps.caches)).toBeUndefined();
  };

  it('hash: the bytes are not the pinned ones', async () => {
    const { deps } = setup({ fetch: (async () => respond(new TextEncoder().encode('0123456780'))) as never });
    await fails(deps, 'hash');
  });

  it.each([
    ['too few bytes', () => respond(bytes.slice(0, 9))],
    ['too many bytes', () => respond(bytes, new Uint8Array(1))],
  ])('size: %s', async (_, res) => {
    const { deps } = setup({ fetch: (async () => res()) as never });
    await fails(deps, 'size');
  });

  it('aborted: cancelled while downloading', async () => {
    const controller = new AbortController();
    const { deps } = setup();
    await fails(deps, 'aborted', { signal: controller.signal, onProgress: () => controller.abort() });
  });

  // A real fetch rejects `read()` when its signal aborts or the connection drops mid-body.
  const brokenBody = () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(bytes.slice(0, 4));
        },
        pull(c) {
          c.error(new TypeError('network error'));
        },
      }),
    );

  it('aborted: the cancel makes the body fail', async () => {
    const controller = new AbortController();
    controller.abort();
    const { deps } = setup({ fetch: (async () => brokenBody()) as never });
    await fails(deps, 'aborted', { signal: controller.signal });
  });

  it('network: the connection drops mid-download', async () => {
    const { deps } = setup({ fetch: (async () => brokenBody()) as never });
    await fails(deps, 'network');
  });

  it('aborted: cancelled before the response arrives', async () => {
    const controller = new AbortController();
    const fetch = async () => {
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    };
    const { deps } = setup({ fetch: fetch as never });
    await fails(deps, 'aborted', { signal: controller.signal });
  });

  it.each([
    ['HTTP error', async () => new Response(null, { status: 503 })],
    ['offline', async () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('network: %s', async (_, fetch) => {
    const { deps } = setup({ fetch: fetch as never });
    await fails(deps, 'network');
  });

  it('quota: not enough room according to the browser, without downloading', async () => {
    const { deps, fetch } = setup({ storage: { estimate: async () => ({ quota: 100, usage: 95 }) } });
    await fails(deps, 'quota');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('quota: the browser refuses to save it', async () => {
    const { deps } = setup({}, true);
    await fails(deps, 'quota');
  });

  it('a failed download also drops the previous copy', async () => {
    const { deps } = setup();
    await downloadWasm(spec, deps);
    await fails({ ...deps, fetch: (async () => new Response(null, { status: 500 })) as never }, 'network');
  });
});

describe('removeWasm', () => {
  it('frees the cached copy', async () => {
    const { deps } = setup();
    await downloadWasm(spec, deps);
    await removeWasm(deps.caches);
    expect(await cachedWasm(spec, deps.caches)).toBeUndefined();
  });
});

describe('FULL_WASM', () => {
  it('is the wasm of the vendored engine version, whose js is pinned in FILES', () => {
    expect(FULL_WASM.url).toBe(`https://unpkg.com/stockfish@${VERSION}/bin/stockfish-19.wasm`);
    expect(FILES.map(([from]) => from)).toContain('bin/stockfish-19.js');
  });
});
