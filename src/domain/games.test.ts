import { describe, expect, it } from 'vitest';
import type { Game } from './chesscom';
import { addMonth, buildQuery, filterGames, gameId, monthStart, moveCount, parseQuery, playerView } from './games';

const side = (username: string, rating: number, result: string) => ({ username, rating, result });
const game = (url: string, endTime: number, over: Partial<Game> = {}): Game => ({
  url,
  pgn: '',
  timeClass: 'blitz',
  rated: true,
  endTime,
  white: side('Hikaru', 3200, 'win'),
  black: side('MagnusCarlsen', 3190, 'resigned'),
  ...over,
});

describe('gameId', () => {
  it('is the last segment of the game URL', () => {
    expect(gameId(game('https://www.chess.com/game/live/100000001', 0))).toBe('100000001');
    expect(gameId(game('https://www.chess.com/game/daily/42', 0))).toBe('42');
  });
});

describe('moveCount', () => {
  it('counts full moves, whoever moved last', () => {
    expect(moveCount('[White "a"]\n\n1. e4 e5 2. Nf3 Nc6 1-0')).toBe(2);
    expect(moveCount('1. f3 e5 2. g4 Qh4# 0-1')).toBe(2);
    expect(moveCount('1. e4 1-0')).toBe(1);
  });

  it('ignores clock comments and black move numbers', () => {
    expect(moveCount('1. e4 {[%clk 0:03:00]} 1... e5 {[%clk 0:02:59]} 2. Nf3 2... Nc6 3. Bb5 1-0')).toBe(3);
  });

  it('ignores numbers in the headers', () => {
    expect(moveCount('[Date "2024.03.01"]\n[WhiteElo "3200"]\n\n1-0')).toBe(0);
  });
});

describe('playerView', () => {
  it('sees the game from the user, whatever the case of the name', () => {
    expect(playerView(game('u', 0), 'hikaru')).toEqual({
      color: 'white',
      opponent: side('MagnusCarlsen', 3190, 'resigned'),
      result: 'win',
    });
    expect(playerView(game('u', 0), 'MAGNUSCARLSEN')).toMatchObject({ color: 'black', result: 'loss' });
  });

  it('calls anything but a win or a loss a draw', () => {
    const drawn = game('u', 0, { white: side('a', 1, 'agreed'), black: side('b', 1, 'repetition') });
    expect(playerView(drawn, 'b').result).toBe('draw');
  });
});

describe('monthStart', () => {
  it('reads the UTC start of the month from an archive URL', () => {
    expect(monthStart('https://api.chess.com/pub/player/hikaru/games/2024/03')).toBe(Date.UTC(2024, 2, 1));
  });
});

describe('addMonth', () => {
  it('appends the month newest first', () => {
    const months = addMonth([], 'm1', [game('a', 1), game('c', 3), game('b', 2)]);
    expect(months).toEqual([{ url: 'm1', games: [game('c', 3), game('b', 2), game('a', 1)] }]);
  });

  it('keeps a month chess.com could not serve, so the list can say so and go on', () => {
    const months = addMonth(addMonth([], 'm2', null), 'm1', [game('y', 5)]);
    expect(months).toEqual([
      { url: 'm2', games: null },
      { url: 'm1', games: [game('y', 5)] },
    ]);
  });

  it('drops games already listed in an earlier month', () => {
    const first = addMonth([], 'm2', [game('x', 10)]);
    const months = addMonth(first, 'm1', [game('x', 10), game('y', 5)]);
    expect(months.map((m) => m.games?.map((g) => g.url))).toEqual([['x'], ['y']]);
  });
});

describe('filterGames', () => {
  const games = [
    game('a', 3, {}), // Hikaru white wins, blitz
    game('b', 2, { timeClass: 'rapid', white: side('Hikaru', 1, 'resigned'), black: side('x', 1, 'win') }),
    game('c', 1, { white: side('x', 1, 'win'), black: side('hikaru', 1, 'timeout') }),
  ];
  const all = { timeClass: '', color: '', result: '' } as const;

  it('keeps everything with no filters', () => {
    expect(filterGames(games, 'hikaru', all)).toHaveLength(3);
  });

  it('combines pace, colour and result', () => {
    expect(
      filterGames(games, 'hikaru', { timeClass: 'blitz', color: 'black', result: 'loss' }).map((g) => g.url),
    ).toEqual(['c']);
    expect(filterGames(games, 'hikaru', { ...all, timeClass: 'rapid' }).map((g) => g.url)).toEqual(['b']);
    expect(filterGames(games, 'hikaru', { ...all, result: 'win' }).map((g) => g.url)).toEqual(['a']);
  });
});

describe('query string', () => {
  it('round-trips and omits defaults', () => {
    const q = { timeClass: 'blitz', color: 'black', result: 'loss', month: '2025-03', months: 2 } as const;
    expect(buildQuery(q)).toBe('?tc=blitz&color=black&result=loss&month=2025-03&months=2');
    expect(parseQuery(buildQuery(q))).toEqual(q);
    expect(buildQuery({ timeClass: '', color: '', result: '', month: '', months: 1 })).toBe('');
  });

  it('drops values it does not know', () => {
    expect(parseQuery('?tc=chess960&color=red&result=x&month=nope&months=-4')).toEqual({
      timeClass: '',
      color: '',
      result: '',
      month: '',
      months: 1,
    });
  });
});
