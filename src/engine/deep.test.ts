import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectDeep } from './deep.ts';

const cache = { match: vi.fn(async () => undefined) };
const caches = { open: vi.fn(async () => cache), delete: vi.fn(async () => true) };

/** A browser that could run the deep mode: isolated (so threaded), precise pointer, 8 GB. */
function browser({ memory = 8 as number | undefined, coarse = false, withCaches = true, isolated = true } = {}) {
  vi.stubGlobal('crossOriginIsolated', isolated);
  vi.stubGlobal('caches', withCaches ? caches : undefined);
  vi.stubGlobal('matchMedia', () => ({ matches: coarse }));
  vi.stubGlobal('navigator', { ...navigator, deviceMemory: memory, hardwareConcurrency: 8 });
}

afterEach(() => vi.unstubAllGlobals());

describe('detectDeep (ADR-029)', () => {
  it('is offered where lite runs threaded, on a precise pointer, with enough memory', async () => {
    browser();
    const deep = detectDeep();
    expect(deep).toBeDefined();
    expect(await deep?.cached()).toBeUndefined(); // reads the Cache API, never the network
    expect(caches.open).toHaveBeenCalled();
  });

  it.each([
    ['without the Cache API', { withCaches: false }],
    ['on a touch device', { coarse: true }],
    ['with little memory', { memory: 2 }],
    ['without threads', { isolated: false }],
  ])('is not offered %s', (_, options) => {
    browser(options);
    expect(detectDeep()).toBeUndefined();
  });

  it('is offered when the browser does not report its memory', () => {
    browser({ memory: undefined });
    expect(detectDeep()).toBeDefined();
  });

  it('is not offered where reading the Cache API throws', () => {
    browser();
    vi.stubGlobal('caches', undefined);
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      get() {
        throw new DOMException('', 'SecurityError');
      },
    });
    expect(detectDeep()).toBeUndefined();
    delete (globalThis as { caches?: unknown }).caches;
  });
});
