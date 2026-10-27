import type { Game, Side } from './chesscom.ts';

export type Result = 'win' | 'loss' | 'draw';
export type PlayerView = { color: 'white' | 'black'; opponent: Side; result: Result };
/** `games` is null when chess.com could not serve the month. */
export type Month = { url: string; games: Game[] | null };

/** The numeric id at the end of the game URL (`…/game/live/123` → `123`). */
export const gameId = (game: Pick<Game, 'url'>) => game.url.slice(game.url.lastIndexOf('/') + 1);

/** Full moves played: the last white move number of the movetext. */
// shortcut: counts numbers inside variations too, parse with chessops if a PGN with variations ever shows up.
export function moveCount(pgn: string): number {
  const movetext = pgn.replace(/^\[.*$/gm, '').replace(/\{[^}]*\}/g, '');
  return Math.max(0, ...[...movetext.matchAll(/(\d+)\.(?!\.)/g)].map((m) => Number(m[1])));
}

/** The game seen from `user`; chess.com marks the winner with `win` and the rest of results are losses or draws. */
export function playerView(game: Game, user: string): PlayerView {
  const color = game.black.username.toLowerCase() === user.toLowerCase() ? 'black' : 'white';
  const opponent = color === 'white' ? game.black : game.white;
  const result = game[color].result === 'win' ? 'win' : opponent.result === 'win' ? 'loss' : 'draw';
  return { color, opponent, result };
}

/** UTC timestamp of the first day of an archive month (`…/games/2024/03`). */
export function monthStart(url: string): number {
  return Date.UTC(Number(url.slice(-7, -3)), Number(url.slice(-2)) - 1, 1);
}

/** Appends a month, newest game first, without the games an earlier month already lists. */
export function addMonth(months: Month[], url: string, games: Game[] | null): Month[] {
  const seen = new Set(months.flatMap((m) => m.games?.map((g) => g.url) ?? []));
  const fresh = games?.filter((g) => !seen.has(g.url)).sort((a, b) => b.endTime - a.endTime);
  return [...months, { url, games: fresh ?? null }];
}
