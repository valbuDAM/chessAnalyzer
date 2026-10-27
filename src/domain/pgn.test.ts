// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseGamePgn } from './pgn';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PGN = `[Event "Live Chess"]
[White "hikaru"]
[Black "magnus"]
[Result "1-0"]

1. e4 {[%clk 0:03:00]} 1... e5 {[%clk 0:02:59.9]} 2. Nf3 {[%clk 0:02:58.5]} 2... Nc6 {[%clk 0:02:57]} 3. Bb5 {[%clk 0:02:55]} 1-0`;

describe('parseGamePgn', () => {
  it('returns N+1 positions, the first being the starting one', () => {
    const positions = parseGamePgn(PGN);
    expect(positions).toHaveLength(6);
    expect(positions[0]).toEqual({ fen: START, san: null, uci: null, clock: null });
  });

  it('records SAN, UCI and FEN of every move', () => {
    const [, e4, , , , bb5] = parseGamePgn(PGN);
    expect(e4).toMatchObject({ san: 'e4', uci: 'e2e4', fen: expect.stringContaining('4P3') });
    expect(bb5).toMatchObject({ san: 'Bb5', uci: 'f1b5' });
  });

  it('reads the clock in seconds, fractions included', () => {
    expect(parseGamePgn(PGN).map((p) => p.clock)).toEqual([null, 180, 179.9, 178.5, 177, 175]);
  });

  it('leaves the clock null when a move has no comment', () => {
    expect(parseGamePgn('1. e4 e5 *').map((p) => p.clock)).toEqual([null, null, null]);
  });

  it('writes castling in UCI as king-moves-two', () => {
    const last = parseGamePgn('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O *').at(-1);
    expect(last).toMatchObject({ san: 'O-O', uci: 'e1g1' });
  });

  it('writes queenside castling as king-moves-two', () => {
    const fen = 'r3k3/8/8/8/8/8/8/R3K3 w Qq - 0 1';
    expect(parseGamePgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. O-O-O *`)[1]).toMatchObject({ uci: 'e1c1' });
  });

  it('keeps king-takes-rook for Chess960, as engines expect in that mode', () => {
    const fen = '4k3/8/8/8/8/8/8/1K3R2 w F - 0 1';
    const pgn = `[Variant "Chess960"]\n[SetUp "1"]\n[FEN "${fen}"]\n\n1. O-O *`;
    expect(parseGamePgn(pgn)[1]).toMatchObject({ uci: 'b1f1' });
  });

  it('starts from the FEN header when the game has one', () => {
    const fen = '4k3/8/8/8/8/8/8/4K2R w K - 0 1';
    const positions = parseGamePgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. O-O *`);
    expect(positions[0]?.fen).toBe(fen);
    expect(positions).toHaveLength(2);
  });

  it('throws on an illegal move', () => {
    expect(() => parseGamePgn('1. e4 e4 *')).toThrow(/e4/);
  });
});
