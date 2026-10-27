import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import '../i18n/index.ts';
import { GameViewer } from './GameViewer.tsx';

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
