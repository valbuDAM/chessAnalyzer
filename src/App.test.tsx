import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import './i18n/index.ts';
import { App } from './App.tsx';
import { getLastGame } from './domain/chesscom.ts';

vi.mock('./domain/chesscom.ts', async (orig) => ({ ...(await orig<object>()), getLastGame: vi.fn() }));

const side = (username: string, rating: number, result: string) => ({ username, rating, result });
const game = {
  url: 'u',
  pgn: '',
  timeClass: 'blitz',
  rated: true,
  endTime: 1709300000,
  white: side('Hikaru', 3200, 'win'),
  black: side('MagnusCarlsen', 3190, 'resigned'),
};

afterEach(() => window.history.pushState(null, '', '/'));

it('renders the title and a labelled user form on /', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Zugzwang' })).toBeInTheDocument();
  expect(screen.getByLabelText('Usuario de chess.com')).toBeInTheDocument();
});

it('goes to /u/:user and shows the last game on submit', async () => {
  vi.mocked(getLastGame).mockResolvedValue(game);
  render(<App />);
  await userEvent.type(screen.getByLabelText('Usuario de chess.com'), ' hikaru {Enter}');
  expect(window.location.pathname).toBe('/u/hikaru');
  expect(await screen.findByText('MagnusCarlsen')).toBeInTheDocument();
  expect(screen.getByText('1-0')).toBeInTheDocument();
});

it('shows the same when /u/:user is opened directly', async () => {
  vi.mocked(getLastGame).mockResolvedValue(game);
  window.history.pushState(null, '', '/u/hikaru');
  render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Buscando');
  expect(await screen.findByText('Hikaru')).toBeInTheDocument();
});

it('shows an error alert when the request fails', async () => {
  vi.mocked(getLastGame).mockRejectedValue(new Error('boom'));
  window.history.pushState(null, '', '/u/nadie');
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
});

it('says so when the user has no games', async () => {
  vi.mocked(getLastGame).mockResolvedValue(null);
  window.history.pushState(null, '', '/u/nuevo');
  render(<App />);
  expect(await screen.findByText('Este usuario no tiene partidas.')).toBeInTheDocument();
});
