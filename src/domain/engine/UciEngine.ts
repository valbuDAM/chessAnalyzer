import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import {
  type AnalyseOptions,
  abortError,
  DEFAULT_DEPTH,
  type Engine,
  EngineError,
  EngineLoadError,
  type Eval,
} from './engine.ts';
import { type Info, parseBestMove, parseInfo } from './uci.ts';

export type Transport = {
  send(command: string): void;
  onLine(callback: (line: string) => void): void;
  onError(callback: (message: string) => void): void;
  terminate(): void;
};

type Job = {
  fen: string;
  opts: AnalyseOptions;
  resolve: (value: Eval) => void;
  reject: (reason: Error) => void;
  settled: boolean;
  searching: boolean;
  last?: Info;
  best?: { move: string | null };
};

type Waiter = { test: (line: string) => boolean; resolve: () => void; reject: (reason: Error) => void };

// shortcut: standard chess rules only (no Chess960 castling); add Chess960 when a task needs it.
function invalidReason(fen: string): string | undefined {
  const setup = parseFen(fen);
  if (setup.isErr) return `Invalid FEN: ${fen}`;
  const pos = Chess.fromSetup(setup.value);
  if (pos.isErr) return `Illegal position: ${fen}`;
  if (pos.value.isEnd()) return `Game is over in this position: ${fen}`;
  return undefined;
}

const goCommand = ({ depth, movetime }: AnalyseOptions) => {
  const parts = ['go'];
  if (depth !== undefined || movetime === undefined) parts.push('depth', String(depth ?? DEFAULT_DEPTH));
  if (movetime !== undefined) parts.push('movetime', String(movetime));
  return parts.join(' ');
};

/** UCI protocol on top of any `Transport`: lazy handshake, serial queue, stop that waits for the aborted `bestmove`. */
export class UciEngine implements Engine {
  readonly #transport: Transport;
  readonly #queue: Job[] = [];
  readonly #waiters = new Set<Waiter>();
  #running = false;
  #current: Job | undefined;
  #started: Promise<void> | undefined;
  #failure: EngineError | undefined;
  #ready = false;
  readonly #startTimeout: number;
  readonly #options: Record<string, number>;

  /**
   * `startTimeout`: ms the engine has to answer the handshake before it counts as not loaded (T4.1).
   * `options`: UCI options (`Threads`, `Hash`, `MultiPV`…) set once, before the first search (T4.2).
   */
  constructor(transport: Transport, { startTimeout = 10_000, options = {} } = {}) {
    this.#transport = transport;
    this.#startTimeout = startTimeout;
    this.#options = options;
    transport.onLine((line) => this.#onLine(line));
    transport.onError((message) => this.#fail(new (this.#ready ? EngineError : EngineLoadError)(message)));
  }

  analyse(fen: string, opts: AnalyseOptions = {}): Promise<Eval> {
    if (this.#failure) return Promise.reject(this.#failure);
    // Stockfish reads an unusable limit as "no limit", and the search would never end.
    if ([opts.depth, opts.movetime].some((n) => n !== undefined && !(Number.isInteger(n) && n > 0))) {
      return Promise.reject(new EngineError('depth and movetime must be positive integers'));
    }
    const invalid = invalidReason(fen);
    if (invalid) return Promise.reject(new EngineError(invalid));
    return new Promise((resolve, reject) => {
      this.#queue.push({ fen, opts, resolve, reject, settled: false, searching: false });
      void this.#pump();
    });
  }

  stop(): void {
    for (const job of this.#queue.splice(0)) this.#settle(job, abortError());
    const job = this.#current;
    if (!job || job.settled) return;
    if (job.searching) this.#transport.send('stop');
    this.#settle(job, abortError());
  }

  dispose(): void {
    this.#fail(new EngineError('Engine disposed'));
    this.#transport.terminate();
  }

  async #pump(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    for (let job = this.#queue.shift(); job; job = this.#queue.shift()) await this.#execute(job);
    this.#running = false;
  }

  async #execute(job: Job): Promise<void> {
    this.#current = job;
    try {
      this.#started ??= this.#handshake();
      await this.#started;
      if (job.settled) return;
      this.#transport.send('ucinewgame');
      await this.#ask('isready', (line) => line === 'readyok');
      if (job.settled) return;
      job.searching = true;
      this.#transport.send(`position fen ${job.fen}`);
      // Even when aborted we wait for its `bestmove`, or it would be mistaken for the next search's.
      await this.#ask(goCommand(job.opts), (line) => parseBestMove(line) !== undefined);
      this.#finish(job);
    } catch (error) {
      this.#settle(job, error instanceof Error ? error : new EngineError(String(error)));
    } finally {
      job.searching = false;
      this.#current = undefined;
    }
  }

  async #handshake(): Promise<void> {
    // Failing rejects the pending `#ask`, so this one timer is cleared on success, timeout, error and dispose alike.
    const timer = setTimeout(
      () => this.#fail(new EngineLoadError('The engine did not start in time')),
      this.#startTimeout,
    );
    try {
      await this.#ask('uci', (line) => line === 'uciok');
      for (const [name, value] of Object.entries(this.#options)) {
        this.#transport.send(`setoption name ${name} value ${value}`);
      }
      await this.#ask('isready', (line) => line === 'readyok');
      this.#ready = true;
    } finally {
      clearTimeout(timer);
    }
  }

  #finish(job: Job): void {
    if (job.settled) return;
    if (!job.best?.move || !job.last) {
      this.#settle(job, new EngineError(`No move found for ${job.fen}`));
      return;
    }
    const { depth, score, pv } = job.last;
    job.settled = true;
    job.resolve({ score, bestMove: job.best.move, depth, pv });
  }

  #settle(job: Job, error: Error): void {
    if (job.settled) return;
    job.settled = true;
    job.reject(error);
  }

  #ask(command: string, test: Waiter['test']): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#waiters.add({ test, resolve, reject });
      this.#transport.send(command);
    });
  }

  #onLine(line: string): void {
    const job = this.#current;
    if (job?.searching) {
      const best = parseBestMove(line);
      const info = best ? undefined : parseInfo(line);
      if (best) job.best = best;
      // With MultiPV > 1 the other lines would overwrite the best one.
      else if (info && !info.bound && info.multipv === 1) job.last = info;
    }
    for (const waiter of this.#waiters) {
      if (!waiter.test(line)) continue;
      this.#waiters.delete(waiter);
      waiter.resolve();
    }
  }

  #fail(error: EngineError): void {
    this.#failure ??= error;
    for (const job of this.#queue.splice(0)) this.#settle(job, error);
    if (this.#current) this.#settle(this.#current, error);
    for (const waiter of this.#waiters) waiter.reject(error);
    this.#waiters.clear();
  }
}
