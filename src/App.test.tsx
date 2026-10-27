import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import './i18n/index.ts';
import { App } from './App.tsx';
import { ChessComError, findGame, type Game, getArchives, getMonthGames, getPlayer } from './domain/chesscom.ts';

vi.mock('./domain/chesscom.ts', async (orig) => ({
  ...(await orig<object>()),
  findGame: vi.fn(),
  getArchives: vi.fn(),
  getMonthGames: vi.fn(),
  getPlayer: vi.fn(),
}));

const API = 'https://api.chess.com/pub/player/hikaru/games';
const side = (username: string, rating: number, result: string) => ({ username, rating, result });
const game = (id: number, endTime: number, over: Partial<Game> = {}): Game => ({
  url: `https://www.chess.com/game/live/${id}`,
  pgn: '1. e4 e5 2. Nf3 *',
  timeClass: 'blitz',
  rated: true,
  endTime,
  white: side('Hikaru', 3200, 'win'),
  black: side(`Rival${id}`, 3190, 'resigned'),
  ...over,
});
// Three months, newest last as the API sends them; game 2 is listed in two months.
const months: Record<string, Game[]> = {
  [`${API}/2024/01`]: [game(1, 1704100000), game(2, 1706700000)],
  [`${API}/2024/02`]: [game(2, 1706700000), game(3, 1707000000), game(4, 1708000000)],
  [`${API}/2024/03`]: [game(5, 1709300000)],
};

beforeEach(() => {
  vi.mocked(getPlayer).mockResolvedValue(undefined);
  vi.mocked(getArchives).mockResolvedValue(Object.keys(months));
  vi.mocked(getMonthGames).mockImplementation(async (url) => months[url] ?? []);
});
afterEach(() => {
  vi.clearAllMocks();
  window.history.pushState(null, '', '/');
});

const opponents = () => screen.getAllByRole('link', { name: /Rival/ }).map((a) => a.textContent?.match(/Rival\d/)?.[0]);

it('renders the title and a labelled user form on /', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Zugzwang' })).toBeInTheDocument();
  expect(screen.getByLabelText('Usuario de chess.com')).toBeInTheDocument();
});

it('goes to /u/:user and lists the newest month on submit', async () => {
  render(<App />);
  await userEvent.type(screen.getByLabelText('Usuario de chess.com'), ' hikaru {Enter}');
  expect(window.location.pathname).toBe('/u/hikaru');
  expect(await screen.findByRole('heading', { name: 'marzo de 2024' })).toBeInTheDocument();
  expect(opponents()).toEqual(['Rival5']);
});

it('appends earlier months in order, without duplicates, and remembers how many', async () => {
  window.history.pushState(null, '', '/u/hikaru');
  render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Cargando');
  const more = await screen.findByRole('button', { name: 'Cargar mes anterior' });

  await userEvent.click(more);
  const february = await screen.findByRole('heading', { name: 'febrero de 2024' });
  await waitFor(() => expect(february).toHaveFocus());
  expect(window.location.search).toBe('?months=2');

  await userEvent.click(screen.getByRole('button', { name: 'Cargar mes anterior' }));
  await screen.findByRole('heading', { name: 'enero de 2024' });
  expect(opponents()).toEqual(['Rival5', 'Rival4', 'Rival3', 'Rival2', 'Rival1']);
  expect(screen.queryByRole('button', { name: 'Cargar mes anterior' })).not.toBeInTheDocument();
});

it('restores the months in the URL when coming back to the list', async () => {
  window.history.pushState(null, '', '/u/hikaru?months=2');
  render(<App />);
  await screen.findByRole('heading', { name: 'febrero de 2024' });
  expect(opponents()).toEqual(['Rival5', 'Rival4', 'Rival3', 'Rival2']);
});

it('says when chess.com cannot serve a month and still lets earlier ones load', async () => {
  vi.mocked(getMonthGames).mockResolvedValueOnce(null);
  window.history.pushState(null, '', '/u/hikaru');
  render(<App />);
  expect(await screen.findByText(/chess.com no puede servir este mes/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cargar mes anterior' }));
  await screen.findByRole('heading', { name: 'febrero de 2024' });
  expect(opponents()).toEqual(['Rival4', 'Rival3', 'Rival2']);
});

it('keeps the list and offers a retry when an earlier month fails', async () => {
  window.history.pushState(null, '', '/u/hikaru');
  render(<App />);
  const more = await screen.findByRole('button', { name: 'Cargar mes anterior' });
  vi.mocked(getMonthGames).mockRejectedValueOnce(new ChessComError('x', 'offline'));
  await userEvent.click(more);
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
  expect(opponents()).toEqual(['Rival5']);
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('heading', { name: 'febrero de 2024' })).toBeInTheDocument();
});

it('opens a game from its card and shows it from the user side', async () => {
  vi.mocked(findGame).mockResolvedValue(
    game(5, 1709300000, { black: side('Hikaru', 3200, 'win'), white: side('Rival5', 3190, 'resigned') }),
  );
  window.history.pushState(null, '', '/u/hikaru');
  render(<App />);
  await userEvent.click(await screen.findByRole('link', { name: /Rival5/ }));
  expect(window.location.pathname).toBe('/u/hikaru/5');
  expect(findGame).toHaveBeenCalledWith('hikaru', '5');
  const summary = await screen.findByRole('region', { name: 'Rival5 contra Hikaru' });
  expect(within(summary).getByText('0-1')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Tablero de la partida' })).toHaveClass('orientation-black');
});

it('says so when the game is not among the user games', async () => {
  vi.mocked(findGame).mockResolvedValue(null);
  window.history.pushState(null, '', '/u/hikaru/999');
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No hay ninguna partida con ese enlace');
  expect(screen.getByRole('link', { name: 'Volver a sus partidas' })).toHaveAttribute('href', '/u/hikaru');
});

it('shows an error alert when the request fails', async () => {
  vi.mocked(getArchives).mockRejectedValue(new Error('boom'));
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
  vi.mocked(getArchives).mockRejectedValueOnce(new ChessComError('x', 'timeout'));
  window.history.pushState(null, '', '/u/hikaru');
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('tardó demasiado');
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('link', { name: /Rival5/ })).toBeInTheDocument();
});

it('says the user does not exist when /u/:user is opened directly', async () => {
  vi.mocked(getArchives).mockRejectedValue(new ChessComError('x', 'notFound', 404));
  window.history.pushState(null, '', '/u/nadie');
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No existe ese usuario en chess.com');
});

it('says so when the user has no games', async () => {
  vi.mocked(getArchives).mockResolvedValue([]);
  window.history.pushState(null, '', '/u/nuevo');
  render(<App />);
  expect(await screen.findByText('Este usuario no tiene partidas.')).toBeInTheDocument();
});
