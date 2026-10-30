import 'fake-indexeddb/auto';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAnalysis, writeAnalysis } from '../domain/analysisCache.ts';
import { type Engine, EngineLoadError, type Eval } from '../domain/engine/engine.ts';
import { FakeEngine } from '../domain/engine/FakeEngine.ts';
import { parseGamePgn } from '../domain/pgn.ts';
import { detectSettings } from '../engine/createEngine.ts';
import '../i18n/index.ts';
import { GameViewer } from './GameViewer.tsx';
import * as sound from './sound.ts';

const PGN = '1. e4 e5 2. Nf3 *';
const ev = (cp: number): Eval => ({ score: { kind: 'cp', cp }, bestMove: 'e2e4', depth: 10, pv: [] });
// The engine speaks from the side to move: positions 1 and 3 have black to move.
const scriptedEngine = (options?: { latency: number }) => {
  const fens = parseGamePgn(PGN).map((p) => p.fen);
  return new FakeEngine(Object.fromEntries(fens.map((fen, i) => [fen, ev([20, 30, 25, 10][i] as number)])), options);
};
// A game analysed by an earlier test would otherwise come straight from the cache.
beforeEach(() => clear());
const minus = (s: string | null) => s?.replace(/−/g, '-');

it('steps through the moves and disables the buttons at both ends', async () => {
  render(<GameViewer pgn="1. e4 e5 2. Nf3 *" />);
  const prev = screen.getByRole('button', { name: 'Anterior' });
  const next = screen.getByRole('button', { name: 'Siguiente' });
  expect(screen.getByRole('status')).toHaveTextContent('Jugada 0 de 3');
  expect(prev).toBeDisabled();

  await userEvent.click(next);
  expect(screen.getByRole('status')).toHaveTextContent('Jugada 1 de 3e4');
  await userEvent.click(next);
  await userEvent.click(next);
  expect(screen.getByRole('status')).toHaveTextContent('Jugada 3 de 3Nf3');
  expect(next).toBeDisabled();

  await userEvent.click(prev);
  expect(screen.getByRole('status')).toHaveTextContent('Jugada 2 de 3e5');
});

it('updates the board when stepping: a capture removes a pawn, stepping back restores it', async () => {
  const { container } = render(<GameViewer pgn="1. e4 d5 2. exd5 *" />);
  const blackPawns = () => container.querySelectorAll('piece.pawn.black').length;
  expect(blackPawns()).toBe(8);
  for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await waitFor(() => expect(blackPawns()).toBe(7), { timeout: 10_000 }); // chessground removes the captured piece after its animation
  await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
  await waitFor(() => expect(blackPawns()).toBe(8), { timeout: 10_000 });
});

it('shows an alert when the PGN is not legal', () => {
  render(<GameViewer pgn="1. e4 e4 *" />);
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo leer');
});

it('analyses the game: evaluation list from white, bar following the current move, engine released', async () => {
  const engine = scriptedEngine();
  const dispose = vi.spyOn(engine, 'dispose');
  render(<GameViewer pgn={PGN} makeEngine={() => engine} />);
  expect(screen.queryByRole('meter')).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

  await waitFor(() => expect(screen.queryByRole('button', { name: 'Analizar' })).toBeNull());
  const rows = within(screen.getByRole('list', { name: 'Jugadas' })).getAllByRole('listitem');
  expect(rows.map((r) => minus(r.textContent))).toEqual(['1.e4-0,3e5+0,3', '2.Nf3-0,1']);
  expect(screen.queryByRole('button', { name: 'Analizar' })).toBeNull();
  expect(dispose).toHaveBeenCalledOnce();

  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '+0,2');
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect(minus(screen.getByRole('meter').getAttribute('aria-valuetext'))).toBe('-0,3');
  expect(within(rows[0] as HTMLElement).getByRole('button', { name: /e4/ })).toHaveAttribute('aria-current', 'step');
});

it('jumps to a move when it is clicked in the list', async () => {
  render(<GameViewer pgn={PGN} />);

  await userEvent.click(screen.getByRole('button', { name: /Nf3/ }));

  expect(screen.getByRole('status')).toHaveTextContent('Jugada 3 de 3Nf3');
});

it('shows progress and disables the button while analysing; leaving stops and releases the engine', async () => {
  const engine = scriptedEngine({ latency: 60_000 }); // never answers within the test; stop() aborts it
  const stop = vi.spyOn(engine, 'stop');
  const dispose = vi.spyOn(engine, 'dispose');
  const { unmount } = render(<GameViewer pgn={PGN} makeEngine={() => engine} />);

  await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

  expect(screen.getByText('Analizando jugada 0 de 3…')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Progreso del análisis' })).toHaveAttribute('max', '3');
  expect(screen.getByRole('button', { name: 'Analizar' })).toBeDisabled();
  unmount();
  expect(stop).toHaveBeenCalledOnce();
  await waitFor(() => expect(dispose).toHaveBeenCalledOnce());
});

/** An engine the test answers by hand, one position at a time, in the order they were asked. */
function manualEngine() {
  const waiting: Array<(value: Eval) => void> = [];
  const engine: Engine = {
    analyse: () => new Promise((resolve) => waiting.push(resolve)),
    stop: vi.fn(), // a misbehaving engine: it keeps answering after being stopped
    dispose: vi.fn(),
  };
  const answer = async (...cps: number[]) => {
    for (const cp of cps) {
      await waitFor(() => expect(waiting.length).toBeGreaterThan(0)); // the queue asks for one position at a time
      await act(async () => waiting.shift()?.(ev(cp)));
    }
  };
  return { engine, answer, pending: () => waiting.length };
}

const LONG_PGN = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *'; // 6 moves, 7 positions

it('lets you walk the part already analysed while the rest goes on', async () => {
  const { engine, answer } = manualEngine();
  render(<GameViewer pgn={LONG_PGN} makeEngine={() => engine} />);
  await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

  await answer(10, 20, 30, 40); // plies 0..3 of 0..6: past the half
  expect(screen.getByText('Analizando jugada 3 de 6…')).toBeInTheDocument();
  expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '+0,1'); // the start, already there

  for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect(minus(screen.getByRole('meter').getAttribute('aria-valuetext'))).toBe('-0,4'); // ply 3, black to move

  for (let i = 0; i < 2; i++) await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect(screen.queryByRole('meter')).toBeNull(); // ply 5 is not analysed yet
  const rows = within(screen.getByRole('list', { name: 'Jugadas' })).getAllByRole('listitem');
  expect(rows.map((r) => minus(r.textContent))).toEqual(['1.e4-0,2e5+0,3', '2.Nf3-0,4Nc6', '3.Bb5a6']);
});

it('drops the analysis of the previous game: stops it, ignores its late answers and starts the new one clean', async () => {
  const first = manualEngine();
  const { rerender } = render(<GameViewer pgn={LONG_PGN} makeEngine={() => first.engine} />);
  await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));
  await first.answer(10, 20);
  expect(screen.getByRole('meter')).toBeInTheDocument();

  rerender(<GameViewer pgn={PGN} makeEngine={() => manualEngine().engine} />); // opening another game

  expect(first.engine.stop).toHaveBeenCalledOnce();
  await first.answer(30); // the old engine still answers, late
  await waitFor(() => expect(first.engine.dispose).toHaveBeenCalledOnce());
  expect(first.pending()).toBe(0); // and the old analysis asked for nothing more
  expect(screen.queryByRole('meter')).toBeNull();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('Jugada 0 de 3');
  expect(screen.getByRole('button', { name: 'Analizar' })).toBeEnabled();
});

it('keeps the game usable and allows retrying when the engine fails', async () => {
  const engine = new FakeEngine({});
  const dispose = vi.spyOn(engine, 'dispose');
  render(<GameViewer pgn={PGN} makeEngine={() => engine} />);

  await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo analizar la partida');
  expect(dispose).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Analizar' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect(screen.getByRole('status')).toHaveTextContent('Jugada 1 de 3e4');
});

it('says the engine could not be loaded, apart from other failures, and the game stays walkable', async () => {
  const engine: Engine = {
    analyse: () => Promise.reject(new EngineLoadError('timeout')),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
  render(<GameViewer pgn={PGN} makeEngine={() => engine} />);

  await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el motor');
  await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect(screen.getByRole('status')).toHaveTextContent('Jugada 1 de 3e4');
});

it.each([
  ['lite-multi', 'Stockfish 19 lite, multihilo'],
  ['lite-single', 'Stockfish 19 lite, un hilo'],
  ['asm', 'Stockfish 19 asm.js, sin WebAssembly'],
] as const)('tells which engine variant analyses the game: %s', (variant, text) => {
  render(<GameViewer pgn={PGN} variant={variant} />);

  const about = screen.getByText('Acerca del análisis').closest('details');
  expect(about).toHaveTextContent(text);
});

it('shows the failure when the engine cannot even be created', async () => {
  const makeEngine = () => {
    throw new Error('no worker');
  };
  render(<GameViewer pgn={PGN} makeEngine={makeEngine} />);

  await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo analizar la partida');
  expect(screen.getByRole('button', { name: 'Analizar' })).toBeEnabled();
});

it('walks the game with the keyboard and announces each move', async () => {
  render(<GameViewer pgn={PGN} />);
  const status = screen.getByRole('status');

  await userEvent.keyboard('{ArrowRight}');
  expect(status).toHaveTextContent('1. e4, blancas');
  await userEvent.keyboard('{ArrowRight}{ArrowRight}');
  expect(status).toHaveTextContent('2. Cf3, blancas');
  await userEvent.keyboard('{ArrowLeft}');
  expect(status).toHaveTextContent('1. e5, negras');
  await userEvent.keyboard('{Home}');
  expect(status).toHaveTextContent('Posición inicial');
  await userEvent.keyboard('{End}{ArrowRight}');
  expect(status).toHaveTextContent('2. Cf3, blancas');
  await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
  expect(status).toHaveTextContent('Posición inicial');
});

it('flips the board with F and the button, and ignores keys with modifiers', async () => {
  render(<GameViewer pgn={PGN} />);
  const flip = screen.getByRole('button', { name: 'Girar tablero' });
  expect(flip).toHaveAttribute('aria-pressed', 'false');
  await userEvent.keyboard('f');
  expect(flip).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(flip);
  expect(flip).toHaveAttribute('aria-pressed', 'false');

  await userEvent.keyboard('{Control>}{ArrowRight}{/Control}');
  expect(screen.getByRole('status')).toHaveTextContent('Posición inicial');
});

describe('analysis cache', () => {
  const fens = parseGamePgn(PGN).map((p) => p.fen);
  const cacheSettings = () => ({ variant: 'lite-single', depth: detectSettings('lite-single').depth }) as const;

  it('shows a saved analysis on opening, without starting the engine', async () => {
    await writeAnalysis(fens, cacheSettings(), [
      { kind: 'cp', cp: 20 },
      { kind: 'cp', cp: -30 },
      { kind: 'cp', cp: 25 },
      { kind: 'cp', cp: -10 },
    ]);
    const makeEngine = vi.fn(() => scriptedEngine());

    render(<GameViewer pgn={PGN} variant="lite-single" makeEngine={makeEngine} />);

    expect(await screen.findByRole('meter')).toHaveAttribute('aria-valuetext', '+0,2');
    expect(screen.queryByRole('button', { name: 'Analizar' })).toBeNull();
    expect(makeEngine).not.toHaveBeenCalled();
  });

  it('saves a finished analysis, so reopening the game needs no engine', async () => {
    render(<GameViewer pgn={PGN} variant="lite-single" makeEngine={() => scriptedEngine()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));
    await waitFor(async () => expect(await readAnalysis(fens, cacheSettings())).toHaveLength(4));
  });

  it('does not save an analysis that was left half way', async () => {
    const { unmount } = render(
      <GameViewer pgn={PGN} variant="lite-single" makeEngine={() => scriptedEngine({ latency: 50 })} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));
    unmount();
    await new Promise((r) => setTimeout(r, 300));
    expect(await readAnalysis(fens, cacheSettings())).toBeUndefined();
  });
});

describe('sounds', () => {
  afterEach(() => localStorage.clear());

  it('play when stepping, stop when muted, and stay muted after a reload', async () => {
    const play = vi.spyOn(sound, 'playSound').mockImplementation(() => {});
    const { unmount } = render(<GameViewer pgn={PGN} />);
    const toggle = screen.getByRole('button', { name: 'Sonidos' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(play).toHaveBeenCalledWith('move');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    play.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(play).not.toHaveBeenCalled();

    unmount();
    render(<GameViewer pgn={PGN} />);
    expect(screen.getByRole('button', { name: 'Sonidos' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(play).not.toHaveBeenCalled();
  });
});
