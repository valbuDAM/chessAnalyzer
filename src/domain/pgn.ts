import { castlingSide } from 'chessops/chess';
import { makeFen } from 'chessops/fen';
import { parseComment, parsePgn, startingPosition } from 'chessops/pgn';
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

/** Positions of the main line: the start plus one per move (N+1). Throws on a PGN that is not legal. */
export function parseGamePgn(pgn: string): Position[] {
  const [game] = parsePgn(pgn);
  if (!game) throw new Error('No game in PGN');
  const pos = startingPosition(game.headers).unwrap();
  const chess960 = game.headers.get('Variant')?.toLowerCase() === 'chess960';
  const positions: Position[] = [{ fen: makeFen(pos.toSetup()), san: null, uci: null, clock: null }];
  for (const node of game.moves.mainline()) {
    const move = parseSan(pos, node.san);
    if (!move) throw new Error(`Illegal move ${node.san} at ply ${positions.length}`);
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
