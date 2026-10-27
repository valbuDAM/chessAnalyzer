import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import './i18n/index.ts';
import { App } from './App.tsx';
import { ChessComError, getLastGame, getPlayer } from './domain/chesscom.ts';

vi.mock('./domain/chesscom.ts', async (orig) => ({
  ...(await orig<object>()),
  getLastGame: vi.fn(),
  getPlayer: vi.fn(),
}));

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

beforeEach(() => vi.mocked(getPlayer).mockResolvedValue(undefined));
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
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo contactar con chess.com');
});

it('keeps the typed text and says the user does not exist', async () => {
  vi.mocked(getPlayer).mockRejectedValueOnce(new ChessComError('x', 'notFound', 404));
  render(<App />);
  const input = screen.getByLabelText('Usuario de chess.com');
  await userEvent.type(input, 'usuario_que_no_existe_123{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('No existe ese usuario en chess.com');
  expect(input).toHaveValue('usuario_que_no_existe_123');
  expect(window.location.pathname).toBe('/');
  expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
});

it('offers a retry when offline and continues once it works', async () => {
  vi.mocked(getPlayer).mockRejectedValueOnce(new ChessComError('x', 'offline'));
  render(<App />);
  await userEvent.type(screen.getByLabelText('Usuario de chess.com'), 'hikaru{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(window.location.pathname).toBe('/u/hikaru'));
});

it('offers a retry on the user page too', async () => {
  vi.mocked(getLastGame).mockRejectedValueOnce(new ChessComError('x', 'timeout')).mockResolvedValueOnce(game);
  window.history.pushState(null, '', '/u/hikaru');
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('tardó demasiado');
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('MagnusCarlsen')).toBeInTheDocument();
});

it('says the user does not exist when /u/:user is opened directly', async () => {
  vi.mocked(getLastGame).mockRejectedValue(new ChessComError('x', 'notFound', 404));
  window.history.pushState(null, '', '/u/nadie');
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No existe ese usuario en chess.com');
});

it('says so when the user has no games', async () => {
  vi.mocked(getLastGame).mockResolvedValue(null);
  window.history.pushState(null, '', '/u/nuevo');
  render(<App />);
  expect(await screen.findByText('Este usuario no tiene partidas.')).toBeInTheDocument();
});
