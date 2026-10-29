import { afterEach, describe, expect, it, vi } from 'vitest';
import { EngineLoadError } from './engine.ts';
import { type Transport, UciEngine } from './UciEngine.ts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MATE_IN_1 = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';

/** Scripted transport: `reply` maps each command to the lines Stockfish would answer, delivered asynchronously. */
function scriptedTransport(reply: (command: string) => string[] = defaultReply) {
  let onLine: (line: string) => void = () => {};
  let onError: (message: string) => void = () => {};
  const sent: string[] = [];
  const t = {
    sent,
    terminated: false,
    emit: (line: string) => onLine(line),
    fail: (message: string) => onError(message),
    send(command: string) {
      sent.push(command);
      for (const line of reply(command)) queueMicrotask(() => onLine(line));
    },
    onLine: (cb) => {
      onLine = cb;
    },
    onError: (cb) => {
      onError = cb;
    },
    terminate() {
      t.terminated = true;
    },
  } satisfies Transport & Record<string, unknown>;
  return t;
}

function defaultReply(command: string): string[] {
  if (command === 'uci') return ['id name Stockfish 19', 'uciok'];
  if (command === 'isready') return ['readyok'];
  if (command.startsWith('go')) {
    return [
      'info string NNUE evaluation',
      'info depth 9 score cp 10 pv e2e4',
      'info depth 10 score cp 20 lowerbound pv d2d4',
      'info depth 10 score cp 18 pv e2e4 e7e5',
      'bestmove e2e4 ponder e7e5',
    ];
  }
  return [];
}

const goCount = (t: { sent: string[] }) => t.sent.filter((c) => c.startsWith('go')).length;

describe('UciEngine', () => {
  it('does the handshake once, lazily, and returns the last non-bound info with the best move', async () => {
    const t = scriptedTransport();
    const engine = new UciEngine(t);
    expect(t.sent).toEqual([]);

    const result = await engine.analyse(START, { depth: 10 });

    expect(result).toEqual({ score: { kind: 'cp', cp: 18 }, bestMove: 'e2e4', depth: 10, pv: ['e2e4', 'e7e5'] });
    expect(t.sent).toEqual(['uci', 'isready', 'ucinewgame', 'isready', `position fen ${START}`, 'go depth 10']);

    await engine.analyse(START, { depth: 10 });
    expect(t.sent.filter((c) => c === 'uci')).toHaveLength(1);
  });

  it('reports mate scores', async () => {
    const t = scriptedTransport((c) =>
      c.startsWith('go') ? ['info depth 3 score mate 1 pv a1a8', 'bestmove a1a8'] : defaultReply(c),
    );
    const result = await new UciEngine(t).analyse(MATE_IN_1, { depth: 5 });
    expect(result).toMatchObject({ score: { kind: 'mate', mate: 1 }, bestMove: 'a1a8' });
  });

  it('uses the default depth, movetime, or both', async () => {
    const t = scriptedTransport();
    const engine = new UciEngine(t);
    await engine.analyse(START);
    await engine.analyse(START, { movetime: 50 });
    await engine.analyse(START, { depth: 8, movetime: 50 });
    expect(t.sent.filter((c) => c.startsWith('go'))).toEqual([
      'go depth 12',
      'go movetime 50',
      'go depth 8 movetime 50',
    ]);
  });

  it('rejects limits that Stockfish would read as "no limit"', async () => {
    const t = scriptedTransport();
    const engine = new UciEngine(t);
    for (const opts of [{ depth: 0 }, { depth: Number.NaN }, { depth: -3 }, { movetime: 0 }, { depth: 1.5 }]) {
      await expect(engine.analyse(START, opts)).rejects.toThrow('positive integers');
    }
    expect(t.sent).toEqual([]);
  });

  it('rejects invalid, illegal and finished positions without talking to the engine', async () => {
    const t = scriptedTransport();
    const engine = new UciEngine(t);
    await expect(engine.analyse('nonsense')).rejects.toThrow('Invalid FEN');
    await expect(engine.analyse('8/8/8/8/8/8/8/8 w - - 0 1')).rejects.toThrow('Illegal position');
    await expect(engine.analyse('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).rejects.toThrow('Game is over');
    expect(t.sent).toEqual([]);
  });

  it('runs analyses in series', async () => {
    const t = scriptedTransport((c) => (c.startsWith('go') ? [] : defaultReply(c)));
    const engine = new UciEngine(t);
    const first = engine.analyse(START, { depth: 1 });
    const second = engine.analyse(START, { depth: 2 });
    await vi.waitFor(() => expect(goCount(t)).toBe(1));
    await Promise.resolve();
    expect(goCount(t)).toBe(1);

    t.emit('info depth 1 score cp 1 pv e2e4');
    t.emit('bestmove e2e4');
    await expect(first).resolves.toMatchObject({ depth: 1 });
    await vi.waitFor(() => expect(goCount(t)).toBe(2));
    t.emit('info depth 2 score cp 2 pv d2d4');
    t.emit('bestmove d2d4');
    await expect(second).resolves.toMatchObject({ bestMove: 'd2d4' });
  });

  it('stop aborts the running and the queued analyses, and waits for the aborted bestmove', async () => {
    const t = scriptedTransport((c) => (c.startsWith('go') ? [] : defaultReply(c)));
    const engine = new UciEngine(t);
    const running = engine.analyse(START, { depth: 30 });
    const queued = engine.analyse(START, { depth: 30 });
    const running$ = expect(running).rejects.toMatchObject({ name: 'AbortError' });
    const queued$ = expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(goCount(t)).toBe(1));

    engine.stop();
    await running$;
    await queued$;
    expect(t.sent).toContain('stop');

    const next = engine.analyse(START, { depth: 5 });
    await Promise.resolve();
    expect(goCount(t)).toBe(1); // still waiting for the stopped search's bestmove

    t.emit('info depth 20 score cp 99 pv a2a3'); // belongs to the aborted search
    t.emit('bestmove a2a3');
    await vi.waitFor(() => expect(goCount(t)).toBe(2));
    t.emit('info depth 5 score cp 7 pv e2e4');
    t.emit('bestmove e2e4');
    await expect(next).resolves.toMatchObject({ score: { kind: 'cp', cp: 7 }, bestMove: 'e2e4' });
  });

  it('stop during the handshake never sends go', async () => {
    const t = scriptedTransport(() => []);
    const engine = new UciEngine(t);
    const pending = expect(engine.analyse(START)).rejects.toMatchObject({ name: 'AbortError' });
    engine.stop();
    await pending;
    t.emit('uciok');
    t.emit('readyok');
    await Promise.resolve();
    expect(goCount(t)).toBe(0);
  });

  it('stop with nothing running does nothing', () => {
    const t = scriptedTransport();
    new UciEngine(t).stop();
    expect(t.sent).toEqual([]);
  });

  it('rejects when the engine finds no move or no score', async () => {
    const none = scriptedTransport((c) => (c.startsWith('go') ? ['bestmove (none)'] : defaultReply(c)));
    await expect(new UciEngine(none).analyse(START)).rejects.toThrow('No move found');
    const noInfo = scriptedTransport((c) => (c.startsWith('go') ? ['bestmove e2e4'] : defaultReply(c)));
    await expect(new UciEngine(noInfo).analyse(START)).rejects.toThrow('No move found');
  });

  it('turns a transport failure into EngineError for everything pending and for later calls', async () => {
    const t = scriptedTransport(() => []);
    const engine = new UciEngine(t);
    const a = expect(engine.analyse(START)).rejects.toMatchObject({ name: 'EngineError', message: 'worker died' });
    const b = expect(engine.analyse(START)).rejects.toMatchObject({ name: 'EngineError', message: 'worker died' });
    t.fail('worker died');
    await a;
    await b;
    await expect(engine.analyse(START)).rejects.toMatchObject({ message: 'worker died' });
  });

  describe('start-up', () => {
    afterEach(() => vi.useRealTimers());

    it('fails with EngineLoadError when the engine does not answer `uci` within the timeout', async () => {
      vi.useFakeTimers();
      const engine = new UciEngine(
        scriptedTransport(() => []),
        { startTimeout: 10_000 },
      );
      const first = expect(engine.analyse(START)).rejects.toBeInstanceOf(EngineLoadError);
      await vi.advanceTimersByTimeAsync(9_999);
      await vi.advanceTimersByTimeAsync(1);
      await first;
      await expect(engine.analyse(START)).rejects.toBeInstanceOf(EngineLoadError);
    });

    it('waits 10 s by default', async () => {
      vi.useFakeTimers();
      const engine = new UciEngine(scriptedTransport(() => []));
      const result = expect(engine.analyse(START)).rejects.toBeInstanceOf(EngineLoadError);
      await vi.advanceTimersByTimeAsync(10_000);
      await result;
    });

    it('does not time out an engine that loaded, nor a long search', async () => {
      vi.useFakeTimers();
      const t = scriptedTransport((c) => (c.startsWith('go') ? [] : defaultReply(c)));
      const engine = new UciEngine(t, { startTimeout: 100 });
      const search = engine.analyse(START);
      await vi.waitFor(() => expect(goCount(t)).toBe(1));
      await vi.advanceTimersByTimeAsync(60_000);
      t.emit('info depth 1 score cp 1 pv e2e4');
      t.emit('bestmove e2e4');
      await expect(search).resolves.toMatchObject({ bestMove: 'e2e4' });
    });

    it('reports a transport error before the handshake as a load failure', async () => {
      const t = scriptedTransport(() => []);
      const pending = expect(new UciEngine(t).analyse(START)).rejects.toBeInstanceOf(EngineLoadError);
      t.fail('Could not load the worker');
      await pending;
    });

    it('reports a transport error after the handshake as a plain EngineError', async () => {
      const t = scriptedTransport();
      const engine = new UciEngine(t);
      await engine.analyse(START);
      t.fail('crashed');
      const error = await engine.analyse(START).catch((e) => e);
      expect(error).toMatchObject({ name: 'EngineError', message: 'crashed' });
      expect(error).not.toBeInstanceOf(EngineLoadError);
    });
  });

  it('dispose terminates the transport and rejects what is pending', async () => {
    const t = scriptedTransport(() => []);
    const engine = new UciEngine(t);
    const pending = expect(engine.analyse(START)).rejects.toMatchObject({ name: 'EngineError' });
    engine.dispose();
    await pending;
    expect(t.terminated).toBe(true);
    await expect(engine.analyse(START)).rejects.toThrow('disposed');
  });
});
