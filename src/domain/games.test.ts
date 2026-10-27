import { describe, expect, it } from 'vitest';
import type { Game } from './chesscom';
import { addMonth, gameId, monthStart, moveCount, playerView } from './games';

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
