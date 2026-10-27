const API = 'https://api.chess.com/pub/player/';

export type Side = { username: string; rating: number; result: string };

export type Game = {
  url: string;
  pgn: string;
  timeClass: string;
  rated: boolean;
  endTime: number;
  white: Side;
  black: Side;
};

export class ChessComError extends Error {
  override name = 'ChessComError';
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

// Requests run one at a time, as chess.com asks of clients; a failure must not block the queue.
let tail: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task);
  tail = run.catch(() => {});
  return run;
}

async function getJson(url: string): Promise<unknown> {
  return serial(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new ChessComError(`chess.com responded ${res.status}`, res.status);
    return res.json(); // read the body inside the slot, or the next request overlaps this download
  });
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function parseSide(v: unknown): Side {
  if (isRecord(v) && typeof v.username === 'string' && typeof v.rating === 'number' && typeof v.result === 'string') {
    return { username: v.username, rating: v.rating, result: v.result };
  }
  throw new ChessComError('Unexpected player shape');
}

function parseGame(v: unknown): Game | null {
  if (!isRecord(v)) throw new ChessComError('Unexpected game shape');
  if (typeof v.pgn !== 'string') return null; // e.g. daily games without a PGN
  if (
    typeof v.url !== 'string' ||
    typeof v.time_class !== 'string' ||
    typeof v.rated !== 'boolean' ||
    typeof v.end_time !== 'number'
  ) {
    throw new ChessComError('Unexpected game shape');
  }
  return {
    url: v.url,
    pgn: v.pgn,
    timeClass: v.time_class,
    rated: v.rated,
    endTime: v.end_time,
    white: parseSide(v.white),
    black: parseSide(v.black),
  };
}

/** Monthly archive URLs, oldest first (the URLs end in YYYY/MM, so they sort as strings). */
export async function getArchives(user: string): Promise<string[]> {
  const body = await getJson(`${API}${encodeURIComponent(user.toLowerCase())}/games/archives`);
  if (!isRecord(body) || !Array.isArray(body.archives) || !body.archives.every((a) => typeof a === 'string')) {
    throw new ChessComError('Unexpected archives shape');
  }
  return [...body.archives].sort();
}

export async function getMonthGames(url: string): Promise<Game[]> {
  if (!url.startsWith(API)) throw new ChessComError('Not a chess.com player API URL');
  const body = await getJson(url);
  if (!isRecord(body) || !Array.isArray(body.games)) throw new ChessComError('Unexpected month shape');
  return body.games.map(parseGame).filter((g): g is Game => g !== null);
}
