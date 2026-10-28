import { get, set } from 'idb-keyval';
import { gameId } from './games.ts';

const API = 'https://api.chess.com/pub/player/';

export type Side = { username: string; rating: number; result: string };

export type Game = {
  url: string;
  pgn: string;
  timeClass: string;
  /** Missing on months recovered from their PGN, which does not say. */
  rated?: boolean;
  /** `rules` of the API or the PGN's `Variant`; undefined when the PGN does not say (see `isStandard`). */
  variant?: string | undefined;
  endTime: number;
  white: Side;
  black: Side;
};

export type ErrorKind = 'invalidUser' | 'notFound' | 'rateLimit' | 'offline' | 'timeout' | 'http' | 'shape';

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

async function getBody<T>(url: string, read: (res: Response) => Promise<T>): Promise<T> {
  return serial(async () => {
    const res = await fetchOk(url);
    // read the body inside the slot, or the next request overlaps this download
    return read(res).catch((e) => {
      throw e instanceof SyntaxError ? new ChessComError('Body is not JSON') : transportError(e);
    });
  });
}

const getJson = (url: string): Promise<unknown> => getBody(url, (res) => res.json());

/** undefined when chess.com answers a 404. */
const unlessNotFound = <T>(request: Promise<T>): Promise<T | undefined> =>
  request.catch((e) => {
    if (e instanceof ChessComError && e.kind === 'notFound') return undefined;
    throw e;
  });

/** chess.com usernames are case-insensitive. */
export const normalizeUser = (user: string) => user.trim().toLowerCase();

// chess.com answers other characters (a real name with a space, say) without CORS headers, which looks like a network failure.
function playerUrl(user: string): string {
  const name = normalizeUser(user);
  if (!/^[a-z0-9_-]+$/.test(name)) throw new ChessComError('Not a chess.com username', 'invalidUser');
  return API + name;
}

/** Resolves if the player exists; otherwise throws a ChessComError (kind notFound for an unknown user). */
export async function getPlayer(user: string): Promise<void> {
  const body = await getJson(playerUrl(user));
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
    variant: typeof v.rules === 'string' ? v.rules : undefined,
    endTime: v.end_time,
    white: parseSide(v.white),
    black: parseSide(v.black),
  };
}

/** chess.com's rule: the base time plus 40 increments; daily controls read `1/<seconds per move>`. */
function timeClassOf(timeControl: string): string {
  if (timeControl.includes('/')) return 'daily';
  const [base = 0, increment = 0] = timeControl.split('+').map(Number);
  const seconds = base + 40 * increment;
  return seconds < 180 ? 'bullet' : seconds < 600 ? 'blitz' : 'rapid';
}

function parsePgnGame(pgn: string): Game {
  const tag = (name: string) => new RegExp(`^\\[${name} "(.*)"\\]$`, 'm').exec(pgn)?.[1];
  const url = tag('Link');
  const white = tag('White');
  const black = tag('Black');
  const result = tag('Result');
  const timeControl = tag('TimeControl');
  const whiteElo = Number(tag('WhiteElo'));
  const blackElo = Number(tag('BlackElo'));
  // EndDate reads 2024.03.01 and EndTime may drop the hour's leading zero
  const endMs = Date.parse(`${tag('EndDate')?.replaceAll('.', '-')}T${tag('EndTime')?.padStart(8, '0')}Z`);
  if (!url || !white || !black || !result || !timeControl || Number.isNaN(whiteElo + blackElo + endMs)) {
    throw new ChessComError('Unexpected PGN game');
  }
  // only chess.com's `win` marker matters downstream (see playerView)
  const sideResult = (wins: string) => (result === wins ? 'win' : result === '1/2-1/2' ? 'draw' : 'lose');
  return {
    url,
    pgn,
    timeClass: timeClassOf(timeControl),
    variant: tag('Variant'),
    endTime: endMs / 1000,
    white: { username: white, rating: whiteElo, result: sideResult('1-0') },
    black: { username: black, rating: blackElo, result: sideResult('0-1') },
  };
}

const splitPgn = (text: string) => (text.trim() ? text.trim().split(/\n\s*\n(?=\[Event )/) : []);

/** Monthly archive URLs, oldest first (the URLs end in YYYY/MM, so they sort as strings). */
export async function getArchives(user: string): Promise<string[]> {
  const body = await getJson(`${playerUrl(user)}/games/archives`);
  if (!isRecord(body) || !Array.isArray(body.archives) || !body.archives.every((a) => typeof a === 'string')) {
    throw new ChessComError('Unexpected archives shape');
  }
  return [...body.archives].sort();
}

const DAY_MS = 86_400_000;

/** Immutable once a day has passed since the month ended (UTC), leaving time for late games to be indexed. */
function isClosedMonth(url: string): boolean {
  const m = /\/(\d{4})\/(\d{2})$/.exec(url);
  // the 1-based month doubles as the 0-based index of the next month
  return m !== null && Date.now() >= Date.UTC(Number(m[1]), Number(m[2]), 1) + DAY_MS;
}

// Bump the version whenever Game changes shape.
// shortcut: older versions are never deleted, add a cleanup if storage use ever matters.
const cacheKey = (url: string) => `games:v2:${url}`;

/**
 * Closed months come from IndexedDB once stored; the current one relies on the browser's HTTP cache.
 * chess.com answers some huge months with a 404 on the JSON while still serving their PGN, so that is the fallback.
 * null when both answer a 404, which says nothing about the user.
 */
export async function getMonthGames(url: string): Promise<Game[] | null> {
  if (!url.startsWith(API)) throw new ChessComError('Not a chess.com player API URL');
  const closed = isClosedMonth(url);
  if (closed) {
    // storage is optional: blocked IndexedDB or a full quota just means downloading again
    const cached: unknown = await Promise.resolve()
      .then(() => get(cacheKey(url)))
      .catch(() => undefined);
    if (Array.isArray(cached)) return cached;
  }
  const games = await downloadMonth(url);
  if (games && closed) {
    await Promise.resolve()
      .then(() => set(cacheKey(url), games))
      .catch(() => {});
  }
  return games;
}

async function downloadMonth(url: string): Promise<Game[] | null> {
  const body = await unlessNotFound(getJson(url));
  if (body === undefined) {
    const pgn = await unlessNotFound(getBody(`${url}/pgn`, (res) => res.text()));
    return pgn === undefined ? null : splitPgn(pgn).map(parsePgnGame);
  }
  if (!isRecord(body) || !Array.isArray(body.games)) throw new ChessComError('Unexpected month shape');
  return body.games.map(parseGame).filter((g): g is Game => g !== null);
}

/** The game with that id, looking back month by month from the newest; null if no month has it. */
export async function findGame(user: string, id: string): Promise<Game | null> {
  for (const url of (await getArchives(user)).reverse()) {
    const game = (await getMonthGames(url))?.find((g) => gameId(g) === id);
    if (game) return game;
  }
  return null;
}

export const outcome = ({ white, black }: Pick<Game, 'white' | 'black'>): '1-0' | '0-1' | '½-½' =>
  white.result === 'win' ? '1-0' : black.result === 'win' ? '0-1' : '½-½';
