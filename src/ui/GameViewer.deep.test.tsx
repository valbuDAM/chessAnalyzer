import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAnalysis, writeAnalysis } from '../domain/analysisCache.ts';
import { type Engine, EngineLoadError, type Eval } from '../domain/engine/engine.ts';
import { FakeEngine } from '../domain/engine/FakeEngine.ts';
import { WasmDownloadError } from '../domain/engine/fullWasm.ts';
import type { Variant } from '../domain/engine/variant.ts';
import { parseGamePgn } from '../domain/pgn.ts';
import { detectSettings } from '../engine/createEngine.ts';
import type { DeepDeps } from '../engine/deep.ts';
import '../i18n/index.ts';
import { GameViewer } from './GameViewer.tsx';

const PGN = '1. e4 e5 2. Nf3 *';
const fens = parseGamePgn(PGN).map((p) => p.fen);
const scores = [20, -30, 25, -10].map((cp) => ({ kind: 'cp' as const, cp }));
const settings = (variant: Variant) => ({ variant, depth: detectSettings(variant).depth });
const ev = (cp: number): Eval => ({ score: { kind: 'cp', cp }, bestMove: 'e2e4', depth: 10, pv: [] });
const scripted = (options?: { latency: number }) =>
  new FakeEngine(Object.fromEntries(fens.map((fen, i) => [fen, ev([20, 30, 25, 10][i] as number)])), options);
const unloadable = (): Engine => ({
  analyse: () => Promise.reject(new EngineLoadError('timeout')),
  stop: vi.fn(),
  dispose: vi.fn(),
});

beforeEach(() => clear());

/** The deep-mode dependencies with a download the test finishes, fails or reports progress on by hand. */
function fakeDeep(cached?: Blob) {
  let blob = cached;
  let report: (done: number) => void = () => {};
  let settle = { finish: () => {}, fail: (_: unknown) => {} };
  const deep: DeepDeps = {
    cached: vi.fn(async () => blob),
    download: vi.fn(
      ({ signal, onProgress }) =>
        new Promise<void>((resolve, reject) => {
          report = onProgress;
          settle = {
            finish: () => {
              blob = new Blob(['wasm']);
              resolve();
            },
            fail: reject,
          };
          signal.addEventListener('abort', () => reject(new WasmDownloadError('aborted')));
        }),
    ),
    remove: vi.fn(async () => {
      blob = undefined;
      return true;
    }),
  };
  return {
    deep,
    progress: (bytes: number) => act(async () => report(bytes)),
    finish: () => act(async () => settle.finish()),
    fail: (error: unknown) => act(async () => settle.fail(error)),
  };
}

function view(deep: DeepDeps | undefined, over: Partial<Parameters<typeof GameViewer>[0]> = {}) {
  return render(
    <GameViewer
      pgn={PGN}
      variant="lite-multi"
      deep={deep}
      makeEngine={() => scripted()}
      makeFullEngine={() => scripted()}
      {...over}
    />,
  );
}

const openAbout = () => userEvent.click(screen.getByText('Acerca del análisis'));
const activate = () => userEvent.click(screen.getByRole('button', { name: 'Descargar y activar' }));

describe('activating the deep mode', () => {
  it('shows the size, then the progress in MB, then the mode on, keeping the move', async () => {
    const { deep, progress, finish } = fakeDeep();
    view(deep);
    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await openAbout();
    expect(await screen.findByText(/99 MB/)).toBeInTheDocument();

    await activate();
    await progress(12_400_000);
    expect(screen.getByRole('progressbar', { name: 'Descarga del motor' })).toHaveAttribute('value', '12');
    expect(screen.getByText('Descargando 12 de 99 MB')).toBeInTheDocument();

    await finish();
    expect(await screen.findByRole('button', { name: 'Desactivar y borrar' })).toBeInTheDocument();
    expect(screen.getByText('Stockfish 19 completo, multihilo')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Jugada 2 de 3e5');
  });

  it('cancels the download without an error and offers it again', async () => {
    const { deep } = fakeDeep();
    view(deep);
    await openAbout();
    await activate();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('button', { name: 'Descargar y activar' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cancels the download when leaving the game', async () => {
    const { deep } = fakeDeep();
    const { unmount } = view(deep);
    await openAbout();
    await activate();
    const signal = vi.mocked(deep.download).mock.calls[0]?.[0].signal;

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it.each([
    [new WasmDownloadError('network'), 'No se pudo descargar'],
    [new WasmDownloadError('quota'), 'No hay espacio suficiente'],
    [new WasmDownloadError('size'), 'no era válida'],
    [new WasmDownloadError('hash'), 'no era válida'],
    [new Error('SecurityError'), 'No se pudo activar'],
  ])('says why it failed (%s) and the analysis goes on with lite', async (error, message) => {
    const { deep, fail } = fakeDeep();
    view(deep);
    await openAbout();
    await activate();

    await fail(error);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByText('Stockfish 19 lite, multihilo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar y activar' })).toBeEnabled(); // can retry
    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));
    expect(await screen.findByRole('meter')).toBeInTheDocument();
  });

  it('is not offered where the browser cannot run it', () => {
    view(undefined);
    expect(screen.queryByRole('button', { name: 'Descargar y activar' })).toBeNull();
  });

  it('cannot start while an analysis is running, nor analyse while downloading', async () => {
    const { deep } = fakeDeep();
    view(deep, { makeEngine: () => scripted({ latency: 60_000 }) });
    await openAbout();
    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));
    expect(screen.getByRole('button', { name: 'Descargar y activar' })).toBeDisabled();
  });

  it('blocks "Analizar" while the download runs', async () => {
    const { deep } = fakeDeep();
    view(deep);
    await openAbout();
    await activate();
    expect(screen.getByRole('button', { name: 'Analizar' })).toBeDisabled();
  });
});

describe('with the deep mode on', () => {
  const wasm = new Blob(['wasm']);

  it('opens already on when the wasm is in the cache, without downloading', async () => {
    const { deep } = fakeDeep(wasm);
    view(deep);
    expect(await screen.findByRole('button', { name: 'Desactivar y borrar' })).toBeInTheDocument();
    expect(deep.download).not.toHaveBeenCalled();
  });

  it('analyses with the full engine, built from the cached wasm, and saves it as full', async () => {
    const { deep } = fakeDeep(wasm);
    const makeFullEngine = vi.fn(() => scripted());
    const makeEngine = vi.fn(() => scripted());
    view(deep, { makeFullEngine, makeEngine });
    await screen.findByRole('button', { name: 'Desactivar y borrar' });

    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

    expect(await screen.findByRole('meter')).toBeInTheDocument();
    expect(makeFullEngine).toHaveBeenCalledWith(wasm);
    expect(makeEngine).not.toHaveBeenCalled();
    await waitFor(async () => expect(await readAnalysis(fens, settings('full-multi'))).toHaveLength(4));
    expect(await readAnalysis(fens, settings('lite-multi'))).toBeUndefined();
  });

  it('shows the analysis of each mode when switching, and asks to analyse if there is none', async () => {
    await writeAnalysis(fens, settings('lite-multi'), scores);
    const { deep, finish } = fakeDeep();
    view(deep);
    expect(await screen.findByRole('meter')).toBeInTheDocument(); // the lite one
    await openAbout();
    await activate();
    await finish();

    expect(await screen.findByRole('button', { name: 'Analizar' })).toBeInTheDocument(); // none for full yet
    expect(screen.queryByRole('meter')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar y borrar' }));
    expect(await screen.findByRole('meter')).toBeInTheDocument(); // lite again
    expect(deep.remove).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Descargar y activar' })).toBeInTheDocument();
  });

  it('cannot be removed while analysing', async () => {
    const { deep } = fakeDeep(wasm);
    view(deep, { makeFullEngine: () => scripted({ latency: 60_000 }) });
    await screen.findByRole('button', { name: 'Desactivar y borrar' });
    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));
    expect(screen.getByRole('button', { name: 'Desactivar y borrar' })).toBeDisabled();
  });

  it('analyses with lite, says so and saves it as lite when the copy does not load; the next try is full again', async () => {
    const { deep } = fakeDeep(wasm);
    const makeFullEngine = vi.fn(unloadable);
    view(deep, { makeFullEngine });
    await screen.findByRole('button', { name: 'Desactivar y borrar' });

    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('con lite');
    expect(await screen.findByRole('meter')).toBeInTheDocument();
    await waitFor(async () => expect(await readAnalysis(fens, settings('lite-multi'))).toHaveLength(4));
    expect(await readAnalysis(fens, settings('full-multi'))).toBeUndefined();
    await openAbout();
    expect(screen.getByText('Stockfish 19 lite, multihilo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar y borrar' })).toBeInTheDocument(); // copy kept
  });

  it('goes back to lite and offers the download again when the browser evicted the copy', async () => {
    const { deep } = fakeDeep(wasm);
    view(deep);
    await screen.findByRole('button', { name: 'Desactivar y borrar' });
    vi.mocked(deep.cached).mockResolvedValue(undefined);

    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

    expect(await screen.findByRole('meter')).toBeInTheDocument();
    await openAbout();
    expect(await screen.findByRole('button', { name: 'Descargar y activar' })).toBeInTheDocument();
    expect(screen.getByText('Stockfish 19 lite, multihilo')).toBeInTheDocument();
  });
});
