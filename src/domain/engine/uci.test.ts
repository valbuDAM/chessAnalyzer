import { describe, expect, it } from 'vitest';
import { parseBestMove, parseInfo } from './uci.ts';

describe('parseInfo', () => {
  it('reads depth, centipawn score and pv', () => {
    expect(
      parseInfo('info depth 10 seldepth 14 multipv 1 score cp 25 nodes 9000 nps 300000 pv e2e4 e7e5 g1f3'),
    ).toEqual({
      depth: 10,
      score: { kind: 'cp', cp: 25 },
      pv: ['e2e4', 'e7e5', 'g1f3'],
    });
  });

  it('reads mate scores, including being mated', () => {
    expect(parseInfo('info depth 3 score mate 1 pv a1a8')).toMatchObject({ score: { kind: 'mate', mate: 1 } });
    expect(parseInfo('info depth 3 score mate -2 pv a1a8')).toMatchObject({ score: { kind: 'mate', mate: -2 } });
  });

  it('flags lower and upper bounds', () => {
    expect(parseInfo('info depth 8 score cp 90 lowerbound pv e2e4')).toMatchObject({ bound: 'lower' });
    expect(parseInfo('info depth 8 score cp -90 upperbound pv e2e4')).toMatchObject({ bound: 'upper' });
  });

  it('returns an empty pv when the line has none', () => {
    expect(parseInfo('info depth 1 score cp 0')).toMatchObject({ pv: [] });
  });

  it('ignores lines without depth and score', () => {
    expect(parseInfo('info string NNUE evaluation using nn.nnue')).toBeUndefined();
    expect(parseInfo('info depth 5 currmove e2e4 currmovenumber 1')).toBeUndefined();
    expect(parseInfo('bestmove e2e4')).toBeUndefined();
    expect(parseInfo('info depth x score cp 1')).toBeUndefined();
    expect(parseInfo('info depth 4 score cp abc')).toBeUndefined();
  });
});

describe('parseBestMove', () => {
  it('reads the move, with or without ponder', () => {
    expect(parseBestMove('bestmove e2e4')).toEqual({ move: 'e2e4' });
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ move: 'e2e4' });
  });

  it('maps (none) to null', () => {
    expect(parseBestMove('bestmove (none)')).toEqual({ move: null });
  });

  it('ignores other lines', () => {
    expect(parseBestMove('info depth 1 score cp 0')).toBeUndefined();
    expect(parseBestMove('bestmove')).toBeUndefined();
  });
});
