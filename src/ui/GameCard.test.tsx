import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Router } from 'wouter';
import type { Game } from '../domain/chesscom.ts';
import '../i18n/index.ts';
import { GameCard } from './GameCard.tsx';

const game: Game = {
  url: 'https://www.chess.com/game/live/100000001',
  pgn: '[Event "Live Chess"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0',
  timeClass: 'rapid',
  rated: true,
  endTime: 1709300000,
  white: { username: 'Hikaru', rating: 3200, result: 'resigned' },
  black: { username: 'MagnusCarlsen', rating: 3190, result: 'win' },
};

it('shows the game from the user side and links to it', () => {
  render(
    <Router>
      <GameCard game={game} user="hikaru" />
    </Router>,
  );
  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('href', '/u/hikaru/100000001');
  expect(link).toHaveAccessibleName(/^Derrota MagnusCarlsen 3190 Rápida, con blancas, 3 jugadas 1 mar 2024$/);
  expect(link).toHaveAttribute('data-result', 'loss');
});

it('names a draw and the black pieces', () => {
  const drawn = { ...game, white: { ...game.white, result: 'agreed' }, black: { ...game.black, result: 'agreed' } };
  render(<GameCard game={drawn} user="MagnusCarlsen" />);
  expect(screen.getByRole('link')).toHaveAccessibleName(/^Tablas Hikaru 3200 Rápida, con negras, 3 jugadas/);
});
