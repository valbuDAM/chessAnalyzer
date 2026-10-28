import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Router } from 'wouter';
import type { Game } from '../domain/chesscom.ts';
import { getArchives, getMonthGames } from '../domain/chesscom.ts';
import '../i18n/index.ts';
import { UserPage } from './UserPage.tsx';

vi.mock('../domain/chesscom.ts', async (orig) => ({
  ...(await orig<object>()),
  getArchives: vi.fn(),
  getMonthGames: vi.fn(),
}));

const API = 'https://api.chess.com/pub/player/hikaru/games';
const side = (username: string, result: string) => ({ username, rating: 3000, result });
const game = (id: number, over: Partial<Game>): Game => ({
  url: `https://www.chess.com/game/live/${id}`,
  pgn: '1. e4 e5 *',
  timeClass: 'blitz',
  rated: true,
  endTime: 1709300000 + id,
  white: side('Hikaru', 'win'),
  black: side(`Rival${id}`, 'resigned'),
  ...over,
});
const lost = { white: side('Rival', 'win'), black: side('hikaru', 'resigned') };
const months: Record<string, Game[]> = {
  [`${API}/2024/02`]: [game(1, {}), game(2, { timeClass: 'rapid' })],
  [`${API}/2024/03`]: [game(3, lost), game(4, { ...lost, timeClass: 'bullet' }), game(5, lost)],
};

beforeEach(() => {
  vi.mocked(getArchives).mockImplementation(async () => Object.keys(months)); // fresh array: the page reverses it in place
  vi.mocked(getMonthGames).mockImplementation(async (url) => months[url] ?? []);
});
afterEach(() => {
  vi.clearAllMocks();
  window.history.pushState(null, '', '/');
});

const open = async (search = '') => {
  window.history.pushState(null, '', `/u/hikaru${search}`);
  render(
    <Router>
      <UserPage user="hikaru" />
    </Router>,
  );
  await screen.findByLabelText('Mes');
};

it('applies pace, colour and result together, with a counter and a way out', async () => {
  const user = userEvent.setup();
  await open('?months=2');
  expect(screen.getByText('5 de 5 partidas')).toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText('Ritmo'), 'blitz');
  await user.selectOptions(screen.getByLabelText('Color'), 'black');
  await user.selectOptions(screen.getByLabelText('Resultado'), 'loss');
  expect(screen.getByText('2 de 5 partidas')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2); // games 3 and 5
  expect(window.location.search).toBe('?tc=blitz&color=black&result=loss&months=2');

  await user.selectOptions(screen.getByLabelText('Resultado'), 'draw');
  expect(screen.getByText('Ninguna partida cumple estos filtros.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Quitar filtros' }));
  expect(screen.getByText('5 de 5 partidas')).toBeInTheDocument();
  expect(window.location.search).toBe('?months=2');
});

it('keeps the month select focused while another month loads', async () => {
  const user = userEvent.setup();
  await open();
  const select = screen.getByLabelText('Mes');
  await user.selectOptions(select, '2024-02');
  expect(screen.getByLabelText('Mes')).toBe(select);
  expect(select).toHaveFocus();
  await screen.findByRole('heading', { name: 'febrero de 2024' });
});

it('drops a month the user never played and lists from the newest', async () => {
  await open('?month=2015-01');
  expect(await screen.findByRole('heading', { name: 'marzo de 2024' })).toBeInTheDocument();
  expect(window.location.search).toBe('');
  expect(screen.getByLabelText('Mes')).toHaveValue('');
});
