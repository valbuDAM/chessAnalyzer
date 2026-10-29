import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Engine, Eval } from '../domain/engine/engine.ts';
import { FakeEngine } from '../domain/engine/FakeEngine.ts';
import { parseGamePgn } from '../domain/pgn.ts';
import '../i18n/index.ts';
import { GameViewer } from './GameViewer.tsx';
import * as sound from './sound.ts';

const PGN = '1. e4 e5 2. Nf3 *';
const ev = (cp: number): Eval => ({ score: { kind: 'cp', cp }, bestMove: 'e2e4', depth: 10, pv: [] });
// The engine speaks from the side to move: positions 1 and 3 have black to move.
const scriptedEngine = () => {
  const fens = parseGamePgn(PGN).map((p) => p.fen);
  return new FakeEngine(Object.fromEntries(fens.map((fen, i) => [fen, ev([20, 30, 25, 10][i] as number)])));
};
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

// Generous timeouts: with many test files running in parallel, jsdom animations starve.
it('updates the board when stepping: a capture removes a pawn, stepping back restores it', {
  timeout: 15_000,
}, async () => {
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
  const engine: Engine = { analyse: () => new Promise(() => {}), stop: vi.fn(), dispose: vi.fn() };
  const { unmount } = render(<GameViewer pgn={PGN} makeEngine={() => engine} />);

  await userEvent.click(screen.getByRole('button', { name: 'Analizar' }));

  expect(screen.getByText('Analizando 0 de 4 posiciones…')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Progreso del análisis' })).toHaveAttribute('max', '4');
  expect(screen.getByRole('button', { name: 'Analizar' })).toBeDisabled();
  unmount();
  expect(engine.stop).toHaveBeenCalledOnce();
  expect(engine.dispose).toHaveBeenCalled();
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
