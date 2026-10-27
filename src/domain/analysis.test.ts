import { describe, expect, it, vi } from 'vitest';
import { ANALYSIS_DEPTH, analyseGame, winPercent } from './analysis.ts';
import { type Engine, EngineError, type Eval } from './engine/engine.ts';
import { FakeEngine } from './engine/FakeEngine.ts';

const WHITE_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BLACK_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const MATED_WHITE = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'; // 1.f3 e5 2.g4 Qh4#
const STALEMATE = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
const BARE_KINGS = '8/8/8/4k3/8/3K4/8/8 w - - 0 1';

const ev = (score: Eval['score']): Eval => ({ score, bestMove: 'e2e4', depth: 10, pv: [] });

describe('winPercent', () => {
  it('is 50 at equality and follows the lichess curve', () => {
    expect(winPercent({ kind: 'cp', cp: 0 })).toBe(50);
    expect(winPercent({ kind: 'cp', cp: 100 })).toBeCloseTo(59.1, 1);
    expect(winPercent({ kind: 'cp', cp: -100 })).toBeCloseTo(40.9, 1);
  });

  it('clamps centipawns at ±1000 and counts mate as ±1000', () => {
    const cap = winPercent({ kind: 'cp', cp: 1000 });
    expect(cap).toBeCloseTo(97.55, 1);
    expect(winPercent({ kind: 'cp', cp: 5000 })).toBe(cap);
    expect(winPercent({ kind: 'mate', mate: 3 })).toBe(cap);
    expect(winPercent({ kind: 'mate', mate: -3 })).toBeCloseTo(100 - cap, 10);
  });

  it('gives a finished game the extreme or the middle', () => {
    expect(winPercent({ kind: 'final', winner: 'white' })).toBe(winPercent({ kind: 'cp', cp: 1000 }));
    expect(winPercent({ kind: 'final', winner: 'black' })).toBeCloseTo(100 - winPercent({ kind: 'cp', cp: 1000 }), 10);
    expect(winPercent({ kind: 'final', winner: null })).toBe(50);
  });
});

describe('analyseGame', () => {
  it('returns white-point-of-view scores, flipping the ones for black to move', async () => {
    const engine = new FakeEngine({
      [WHITE_TO_MOVE]: ev({ kind: 'cp', cp: 20 }),
      [BLACK_TO_MOVE]: ev({ kind: 'cp', cp: 30 }),
    });
    expect(await analyseGame(engine, [WHITE_TO_MOVE, BLACK_TO_MOVE])).toEqual([
      { kind: 'cp', cp: 20 },
      { kind: 'cp', cp: -30 },
    ]);
  });

  it('flips mate scores too', async () => {
    const engine = new FakeEngine({ [BLACK_TO_MOVE]: ev({ kind: 'mate', mate: 2 }) });
    expect(await analyseGame(engine, [BLACK_TO_MOVE])).toEqual([{ kind: 'mate', mate: -2 }]);
  });

  it('resolves finished positions without asking the engine', async () => {
    const engine = new FakeEngine({});
    expect(await analyseGame(engine, [MATED_WHITE, STALEMATE, BARE_KINGS])).toEqual([
      { kind: 'final', winner: 'black' },
      { kind: 'final', winner: null },
      { kind: 'final', winner: null },
    ]);
    expect(engine.calls).toEqual([]);
  });

  it('reports progress after each position, finished ones included', async () => {
    const engine = new FakeEngine({ [WHITE_TO_MOVE]: ev({ kind: 'cp', cp: 0 }) });
    const onProgress = vi.fn();
    await analyseGame(engine, [WHITE_TO_MOVE, MATED_WHITE], { onProgress });
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('analyses at the tracer depth unless told otherwise', async () => {
    const analyse = vi.fn(async () => ev({ kind: 'cp', cp: 0 }));
    const engine: Engine = { analyse, stop: () => {}, dispose: () => {} };
    await analyseGame(engine, [WHITE_TO_MOVE]);
    await analyseGame(engine, [WHITE_TO_MOVE], { depth: 4 });
    expect(analyse.mock.calls).toEqual([
      [WHITE_TO_MOVE, { depth: ANALYSIS_DEPTH }],
      [WHITE_TO_MOVE, { depth: 4 }],
    ]);
  });

  it('stops at the first engine failure', async () => {
    const engine = new FakeEngine({});
    await expect(analyseGame(engine, [WHITE_TO_MOVE, BLACK_TO_MOVE])).rejects.toBeInstanceOf(EngineError);
    expect(engine.calls).toEqual([WHITE_TO_MOVE]);
  });
});
