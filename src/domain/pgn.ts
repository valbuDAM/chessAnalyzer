import { castlingSide } from 'chessops/chess';
import { makeFen } from 'chessops/fen';
import { makePgn, parseComment, parsePgn, startingPosition } from 'chessops/pgn';
import { parseSan } from 'chessops/san';
import { kingCastlesTo, makeUci } from 'chessops/util';

export type Position = {
  fen: string;
  /** Move that led here; null for the starting position. */
  san: string | null;
  uci: string | null;
  /** Seconds left for the player who just moved, from `[%clk]`; null when absent. */
  clock: number | null;
};

export type PgnProblem =
  | { kind: 'empty' }
  | { kind: 'setup' }
  /** `black`: the move belongs to Black, so it is written «12… Nf6». */
  | { kind: 'illegal'; number: number; black: boolean; san: string };

/** A PGN that cannot be analysed; `problem` is what the UI turns into text. */
export class PgnError extends Error {
  constructor(readonly problem: PgnProblem) {
    super(problem.kind === 'illegal' ? `Illegal move ${problem.san} at move ${problem.number}` : problem.kind);
  }
}

export type PgnGame = {
  /** This game alone, ready for `parseGamePgn`. */
  pgn: string;
  white: string;
  black: string;
  result: string;
  /** Raw `[Date]`, or null when unknown. */
  date: string | null;
};

/** Every game with at least one move in a pasted text; throws `empty` when there is none. */
export function readPgn(text: string): PgnGame[] {
  const games = parsePgn(text)
    .filter((g) => g.moves.children.length > 0)
    .map((g) => {
      const date = g.headers.get('Date');
      return {
        pgn: makePgn(g),
        // chessops fills White, Black and Result with '?' / '*' when the PGN lacks them
        white: g.headers.get('White') as string,
        black: g.headers.get('Black') as string,
        result: g.headers.get('Result') as string,
        date: date && !date.includes('?') ? date : null,
      };
    });
  if (games.length === 0) throw new PgnError({ kind: 'empty' });
  return games;
}

/** Positions of the main line: the start plus one per move (N+1). Throws a `PgnError` on a PGN that is not legal. */
export function parseGamePgn(pgn: string): Position[] {
  const [game] = parsePgn(pgn);
  if (!game) throw new PgnError({ kind: 'empty' });
  const start = startingPosition(game.headers);
  if (start.isErr) throw new PgnError({ kind: 'setup' });
  const pos = start.unwrap();
  const chess960 = game.headers.get('Variant')?.toLowerCase() === 'chess960';
  const positions: Position[] = [{ fen: makeFen(pos.toSetup()), san: null, uci: null, clock: null }];
  for (const node of game.moves.mainline()) {
    const move = parseSan(pos, node.san);
    if (!move)
      throw new PgnError({ kind: 'illegal', number: pos.fullmoves, black: pos.turn === 'black', san: node.san });
    // chessops writes castling as king-takes-rook; standard engines expect the king's real target (960 keeps it).
    const side = chess960 ? undefined : castlingSide(pos, move);
    const uci = makeUci(side && 'from' in move ? { ...move, to: kingCastlesTo(pos.turn, side) } : move);
    pos.play(move);
    positions.push({
      fen: makeFen(pos.toSetup()),
      san: node.san,
      uci,
      clock: node.comments?.map((c) => parseComment(c).clock).find((c) => c !== undefined) ?? null,
    });
  }
  return positions;
}
