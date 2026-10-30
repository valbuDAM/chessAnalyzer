import { useCallback, useEffect, useRef, useState } from 'react';
import { WasmDownloadError, type WasmErrorKind } from '../domain/engine/fullWasm.ts';
import type { DeepDeps } from '../engine/deep.ts';

export type DeepError = Exclude<WasmErrorKind, 'aborted'> | 'unknown';

export type DeepState =
  | { status: 'unavailable' }
  // Looking in the cache; the viewer works with lite meanwhile.
  | { status: 'checking' }
  | { status: 'off'; error?: DeepError }
  | { status: 'downloading'; mb: number }
  | { status: 'on' };

/** ADR-029: "on" means the verified wasm is in the Cache API, nothing else is stored. */
export function useDeepMode(deps: DeepDeps | undefined) {
  const [state, setState] = useState<DeepState>({ status: deps ? 'checking' : 'unavailable' });
  const abort = useRef<AbortController>(null);

  // A cache that cannot be read (private mode, evicted storage) is a mode that is not there.
  const refresh = useCallback(async () => {
    if (!deps) return;
    const wasm = await deps.cached().catch(() => undefined);
    setState({ status: wasm ? 'on' : 'off' });
  }, [deps]);

  useEffect(() => {
    void refresh();
    return () => abort.current?.abort();
  }, [refresh]);

  const activate = async () => {
    if (!deps) return;
    const own = new AbortController();
    abort.current = own;
    setState({ status: 'downloading', mb: 0 });
    try {
      await deps.download({
        signal: own.signal,
        // Once per chunk would repaint the viewer thousands of times: report whole megabytes.
        onProgress: (done) => {
          const mb = Math.floor(done / 1e6);
          setState((s) => (s.status === 'downloading' && s.mb === mb ? s : { status: 'downloading', mb }));
        },
      });
      setState({ status: 'on' });
    } catch (error) {
      const kind = error instanceof WasmDownloadError ? error.kind : 'unknown';
      setState(kind === 'aborted' ? { status: 'off' } : { status: 'off', error: kind });
    }
  };

  const cancel = () => abort.current?.abort();

  const remove = async () => {
    await deps?.remove().catch(() => {});
    await refresh();
  };

  return { state, activate, cancel, remove, refresh };
}
