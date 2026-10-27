// @vitest-environment node
import 'fake-indexeddb/auto';
import { clear, get, set } from 'idb-keyval';
import { delay, HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import archives from '../../tests/fixtures/chesscom/archives.json';
import month from '../../tests/fixtures/chesscom/month.json';
import { ChessComError, getArchives, getLastGame, getMonthGames, getPlayer, normalizeUser, outcome } from './chesscom';

const API = 'https://api.chess.com/pub/player';
vi.mock('idb-keyval', async (importOriginal) => {
  const idb = await importOriginal<typeof import('idb-keyval')>();
  return { ...idb, get: vi.fn(idb.get), set: vi.fn(idb.set) };
});

const server = setupServer();
beforeAll(() => server.listen());
afterEach(async () => {
  server.resetHandlers();
  vi.useRealTimers();
  await clear();
});
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
    await expect(getArchives('nadie')).rejects.toMatchObject({ name: 'ChessComError', kind: 'notFound', status: 404 });
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

describe('getMonthGames cache', () => {
  const url = `${API}/hikaru/games/2024/03`;
  let requests = 0;
  const serveMonth = () => {
    requests = 0;
    server.use(
      http.get(url, () => {
        requests++;
        return HttpResponse.json(month);
      }),
    );
  };
  const at = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
  };

  it('downloads a closed month only once', async () => {
    serveMonth();
    const first = await getMonthGames(url);
    expect(await getMonthGames(url)).toEqual(first);
    expect(requests).toBe(1);
  });

  it('closes a month 24 h after it ends, in UTC', async () => {
    serveMonth();
    at('2024-04-01T23:59:59.999Z');
    await getMonthGames(url);
    await getMonthGames(url);
    expect(requests).toBe(2);
    at('2024-04-02T00:00:00.000Z');
    await getMonthGames(url);
    await getMonthGames(url);
    expect(requests).toBe(3);
  });

  it('falls back to the network when IndexedDB fails', async () => {
    serveMonth();
    vi.mocked(get).mockRejectedValueOnce(new Error('blocked'));
    vi.mocked(set).mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    await expect(getMonthGames(url)).resolves.toHaveLength(1);
    expect(requests).toBe(1);
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

describe('normalizeUser', () => {
  it('trims and lowercases', () => expect(normalizeUser('  HiKaru ')).toBe('hikaru'));
});

describe('getPlayer', () => {
  it('resolves for an existing player', async () => {
    server.use(http.get(`${API}/hikaru`, () => HttpResponse.json({ username: 'hikaru' })));
    await expect(getPlayer(' HiKaru ')).resolves.toBeUndefined();
  });

  it('rejects an unknown player with kind notFound', async () => {
    server.use(http.get(`${API}/nadie`, () => new HttpResponse(null, { status: 404 })));
    await expect(getPlayer('nadie')).rejects.toMatchObject({ kind: 'notFound' });
  });

  it('rejects an unexpected body with kind shape', async () => {
    server.use(http.get(`${API}/hikaru`, () => HttpResponse.json({ nope: 1 })));
    await expect(getPlayer('hikaru')).rejects.toMatchObject({ kind: 'shape' });
  });
});

describe('failures', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const rateLimited = () => new Response(null, { status: 429 });
  const stubFetch = (...results: unknown[]) => {
    const fetchMock = vi.fn();
    for (const r of results) {
      fetchMock.mockImplementationOnce(() => (r instanceof Error ? Promise.reject(r) : Promise.resolve(r)));
    }
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('retries a 429 with exponential backoff and then succeeds', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(rateLimited(), rateLimited(), Response.json(archives));
    const result = getArchives('hikaru');
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after 3 retries with kind rateLimit', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(rateLimited(), rateLimited(), rateLimited(), rateLimited());
    const result = expect(getArchives('hikaru')).rejects.toMatchObject({ kind: 'rateLimit', status: 429 });
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000);
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('reports offline without sending the request', async () => {
    const fetchMock = stubFetch();
    vi.stubGlobal('navigator', { onLine: false });
    await expect(getArchives('hikaru')).rejects.toMatchObject({ kind: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a network failure as offline', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    await expect(getArchives('hikaru')).rejects.toMatchObject({ kind: 'offline' });
  });

  it('reports a timeout', async () => {
    stubFetch(new DOMException('timed out', 'TimeoutError'));
    await expect(getArchives('hikaru')).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('reports a timeout while the body downloads', async () => {
    stubFetch({ ok: true, json: () => Promise.reject(new DOMException('timed out', 'TimeoutError')) });
    await expect(getArchives('hikaru')).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('reports other statuses as http', async () => {
    stubFetch(new Response(null, { status: 500 }));
    await expect(getArchives('hikaru')).rejects.toMatchObject({ kind: 'http', status: 500 });
  });

  it('reports a body that is not JSON as shape', async () => {
    stubFetch(new Response('<html>'));
    await expect(getArchives('hikaru')).rejects.toMatchObject({ kind: 'shape' });
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
