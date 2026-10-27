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

export type ErrorKind = 'notFound' | 'rateLimit' | 'offline' | 'timeout' | 'http' | 'shape';

export class ChessComError extends Error {
  override name = 'ChessComError';
  constructor(
    message: string,
    readonly kind: ErrorKind = 'shape',
    readonly status?: number,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 15_000;
const RETRIES = 3;
const BACKOFF_MS = 1000;

// Requests run one at a time, as chess.com asks of clients; a failure must not block the queue.
let tail: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task);
  tail = run.catch(() => {});
  return run;
}

// The timeout signal also covers the body download, so both fetch() and res.json() can fail this way.
const transportError = (e: unknown) =>
  new ChessComError('Request failed', e instanceof DOMException && e.name === 'TimeoutError' ? 'timeout' : 'offline');

async function fetchOk(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    if (globalThis.navigator?.onLine === false) throw new ChessComError('Browser is offline', 'offline');
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw transportError(e);
    }
    if (res.ok) return res;
    if (res.status === 429 && attempt < RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS * 2 ** attempt));
      continue;
    }
    const kind = res.status === 404 ? 'notFound' : res.status === 429 ? 'rateLimit' : 'http';
    throw new ChessComError(`chess.com responded ${res.status}`, kind, res.status);
  }
}

async function getJson(url: string): Promise<unknown> {
  return serial(async () => {
    const res = await fetchOk(url);
    // read the body inside the slot, or the next request overlaps this download
    return res.json().catch((e) => {
      throw e instanceof SyntaxError ? new ChessComError('Body is not JSON') : transportError(e);
    });
  });
}

/** chess.com usernames are case-insensitive. */
export const normalizeUser = (user: string) => user.trim().toLowerCase();

/** Resolves if the player exists; otherwise throws a ChessComError (kind notFound for an unknown user). */
export async function getPlayer(user: string): Promise<void> {
  const body = await getJson(`${API}${encodeURIComponent(normalizeUser(user))}`);
  if (!isRecord(body) || typeof body.username !== 'string') throw new ChessComError('Unexpected profile shape');
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
  const body = await getJson(`${API}${encodeURIComponent(normalizeUser(user))}/games/archives`);
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

/** Newest game, looking back month by month until one has games; null if the user never played. */
export async function getLastGame(user: string): Promise<Game | null> {
  for (const url of (await getArchives(user)).reverse()) {
    const games = await getMonthGames(url);
    if (games.length) return games.reduce((a, b) => (b.endTime > a.endTime ? b : a));
  }
  return null;
}

export const outcome = ({ white, black }: Pick<Game, 'white' | 'black'>): '1-0' | '0-1' | '½-½' =>
  white.result === 'win' ? '1-0' : black.result === 'win' ? '0-1' : '½-½';
