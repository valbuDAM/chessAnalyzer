// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isStandard, PgnError, parseGamePgn, readPgn } from './pgn';

describe('isStandard', () => {
  it('is true when the variant is missing or a standard name, whatever the case', () => {
    for (const v of [undefined, 'chess', 'Chess', 'Standard']) expect(isStandard(v)).toBe(true);
  });

  it('is false for anything else', () => {
    for (const v of ['chess960', 'Chess960', 'crazyhouse', 'bughouse', 'kingofthehill', 'threecheck', '']) {
      expect(isStandard(v)).toBe(false);
    }
  });
});

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

  it('refuses a variant, naming it', () => {
    const fen = '4k3/8/8/8/8/8/8/1K3R2 w F - 0 1';
    const pgn = `[Variant "Chess960"]\n[SetUp "1"]\n[FEN "${fen}"]\n\n1. O-O *`;
    expect(() => parseGamePgn(pgn)).toThrowError(
      expect.objectContaining({ problem: { kind: 'variant', name: 'Chess960' } }),
    );
  });

  it('accepts the standard names of the Variant header', () => {
    for (const name of ['Standard', 'chess', 'CHESS']) {
      expect(parseGamePgn(`[Variant "${name}"]\n\n1. e4 *`)).toHaveLength(2);
    }
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

  it('reports who moved and the move number of an illegal move', () => {
    expect(problem(() => parseGamePgn('1. e4 e4 *'))).toEqual({ kind: 'illegal', number: 1, black: true, san: 'e4' });
    expect(problem(() => parseGamePgn('1. e4 e5 2. Ke3 e4 3. Qh5 Nc6 4. Qxh7 *'))).toEqual({
      kind: 'illegal',
      number: 2,
      black: false,
      san: 'Ke3',
    });
  });

  it('counts from the FEN when the game does not start at move 1', () => {
    const fen = '4k3/8/8/8/8/8/8/4K2R b K - 0 20';
    expect(problem(() => parseGamePgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n20... Ke7 21. Ra5 *`))).toMatchObject({
      number: 21,
      black: false,
      san: 'Ra5',
    });
  });

  it('reports a text with no game at all', () => {
    expect(problem(() => parseGamePgn(''))).toEqual({ kind: 'empty' });
  });

  it('reports an unusable starting position', () => {
    expect(problem(() => parseGamePgn('[SetUp "1"]\n[FEN "nonsense"]\n\n1. e4 *'))).toEqual({ kind: 'setup' });
  });
});

describe('readPgn', () => {
  const two = `[White "a"]\n[Black "b"]\n[Result "1-0"]\n[Date "2024.03.01"]\n\n1. e4 {[%clk 0:03:00]} e5 1-0\n\n[White "c"]\n[Black "d"]\n\n1. d4 *`;

  it('lists every game with its players, result and date', () => {
    const games = readPgn(two);
    expect(games.map(({ white, black, result, date }) => ({ white, black, result, date }))).toEqual([
      { white: 'a', black: 'b', result: '1-0', date: '2024.03.01' },
      { white: 'c', black: 'd', result: '*', date: null },
    ]);
  });

  it('gives each game its own PGN, comments included', () => {
    const [first, second] = readPgn(two);
    expect(parseGamePgn(first?.pgn ?? '').map((p) => p.clock)).toEqual([null, 180, null]);
    expect(parseGamePgn(second?.pgn ?? '')).toHaveLength(2);
  });

  it.each(['', '   \n', '[White "a"]\n\n*'])('says there is no game in %j', (text) => {
    expect(problem(() => readPgn(text))).toEqual({ kind: 'empty' });
  });
});

function problem(run: () => unknown) {
  try {
    run();
  } catch (e) {
    if (e instanceof PgnError) return e.problem;
    throw e;
  }
  throw new Error('did not throw');
}
