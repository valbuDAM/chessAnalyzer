// @vitest-environment node
import { delay, HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import archives from '../../tests/fixtures/chesscom/archives.json';
import month from '../../tests/fixtures/chesscom/month.json';
import { ChessComError, getArchives, getLastGame, getMonthGames, outcome } from './chesscom';

const API = 'https://api.chess.com/pub/player';
const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('getArchives', () => {
  it('returns the monthly URLs sorted oldest first', async () => {
    server.use(http.get(`${API}/hikaru/games/archives`, () => HttpResponse.json(archives)));
    expect(await getArchives('hikaru')).toEqual([
      `${API}/hikaru/games/2023/12`,
      `${API}/hikaru/games/2024/01`,
      `${API}/hikaru/games/2024/03`,
    ]);
  });

  it('lowercases and encodes the username', async () => {
    server.use(http.get(`${API}/hikaru/games/archives`, () => HttpResponse.json(archives)));
    await expect(getArchives('HiKaru')).resolves.toHaveLength(3);
  });

  it('throws ChessComError with the status on a 404', async () => {
    server.use(http.get(`${API}/nadie/games/archives`, () => new HttpResponse(null, { status: 404 })));
    await expect(getArchives('nadie')).rejects.toMatchObject({ name: 'ChessComError', status: 404 });
  });

  it('rejects a malformed body', async () => {
    server.use(http.get(`${API}/hikaru/games/archives`, () => HttpResponse.json({ archives: [1] })));
    await expect(getArchives('hikaru')).rejects.toBeInstanceOf(ChessComError);
  });
});

describe('getMonthGames', () => {
  const url = `${API}/hikaru/games/2024/03`;

  it('maps games to the domain type and skips ones without pgn', async () => {
    server.use(http.get(url, () => HttpResponse.json(month)));
    const games = await getMonthGames(url);
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      url: 'https://www.chess.com/game/live/100000001',
      timeClass: 'blitz',
      rated: true,
      endTime: 1709300000,
      white: { username: 'Hikaru', rating: 3200, result: 'win' },
      black: { username: 'MagnusCarlsen', rating: 3190, result: 'resigned' },
    });
    expect(games[0]?.pgn).toContain('1. e4 e5');
  });

  it('rejects a game with a malformed player', async () => {
    const [game] = month.games;
    server.use(http.get(url, () => HttpResponse.json({ games: [{ ...game, white: {} }] })));
    await expect(getMonthGames(url)).rejects.toBeInstanceOf(ChessComError);
  });

  it('rejects URLs outside the chess.com player API', async () => {
    await expect(getMonthGames('https://evil.example/pub/player/x/games/2024/03')).rejects.toBeInstanceOf(
      ChessComError,
    );
  });

  it('rejects a malformed body', async () => {
    server.use(http.get(url, () => HttpResponse.json({ games: [{ url: 'x', pgn: '1. e4' }] })));
    await expect(getMonthGames(url)).rejects.toBeInstanceOf(ChessComError);
  });
});

describe('serial queue', () => {
  it('starts the second request only after the first finishes', async () => {
    const log: string[] = [];
    server.use(
      http.get(`${API}/a/games/archives`, async () => {
        log.push('a:start');
        await delay(30);
        log.push('a:end');
        return HttpResponse.json(archives);
      }),
      http.get(`${API}/b/games/archives`, () => {
        log.push('b:start');
        return HttpResponse.json(archives);
      }),
    );
    await Promise.all([getArchives('a'), getArchives('b')]);
    expect(log).toEqual(['a:start', 'a:end', 'b:start']);
  });

  it('keeps going after a failed request', async () => {
    server.use(
      http.get(`${API}/a/games/archives`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${API}/b/games/archives`, () => HttpResponse.json(archives)),
    );
    const [a, b] = await Promise.allSettled([getArchives('a'), getArchives('b')]);
    expect(a.status).toBe('rejected');
    expect(b.status).toBe('fulfilled');
  });
});

describe('getLastGame', () => {
  it('returns the newest game of the newest month that has games', async () => {
    server.use(
      http.get(`${API}/hikaru/games/archives`, () => HttpResponse.json(archives)),
      http.get(`${API}/hikaru/games/2024/03`, () => HttpResponse.json({ games: [] })),
      http.get(`${API}/hikaru/games/2024/01`, () => HttpResponse.json(month)),
    );
    expect((await getLastGame('hikaru'))?.url).toBe('https://www.chess.com/game/live/100000001');
  });

  it('picks the highest end time, whatever the order in the month', async () => {
    const [a] = month.games;
    if (!a) throw new Error('empty fixture');
    const newer = { ...a, url: 'https://www.chess.com/game/live/9', end_time: a.end_time + 1 };
    server.use(
      http.get(`${API}/hikaru/games/archives`, () => HttpResponse.json({ archives: [`${API}/hikaru/games/2024/01`] })),
      http.get(`${API}/hikaru/games/2024/01`, () => HttpResponse.json({ games: [newer, a] })),
    );
    expect((await getLastGame('hikaru'))?.url).toBe(newer.url);
  });

  it('returns null when the user has no games', async () => {
    server.use(http.get(`${API}/nuevo/games/archives`, () => HttpResponse.json({ archives: [] })));
    expect(await getLastGame('nuevo')).toBeNull();
  });
});

describe('outcome', () => {
  const side = (result: string) => ({ username: 'x', rating: 1, result });
  const game = (w: string, b: string) => ({ white: side(w), black: side(b) });
  it('maps results to a score', () => {
    expect(outcome(game('win', 'resigned'))).toBe('1-0');
    expect(outcome(game('checkmated', 'win'))).toBe('0-1');
    expect(outcome(game('agreed', 'agreed'))).toBe('½-½');
  });
});
