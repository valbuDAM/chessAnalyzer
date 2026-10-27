import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import type { Engine, Score } from './engine/engine.ts';

/** Tracer depth (T1.5): fast enough for a whole game on lite single thread. A selector comes with M4/M5. */
export const ANALYSIS_DEPTH = 10;

/** A position where the game is already over (mate, stalemate, insufficient material): the engine cannot analyse it. */
export type FinalScore = { kind: 'final'; winner: 'white' | 'black' | null };

/** Evaluation from white's point of view. */
export type WhiteScore = Score | FinalScore;

const CAP = 1000;
const clamp = (cp: number) => Math.max(-CAP, Math.min(CAP, cp));
const lichessCurve = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamp(cp))) - 1);

/** White's chance of winning in 0..100 (ADR-011); mate counts as ±1000 cp. */
export function winPercent(score: WhiteScore): number {
  if (score.kind === 'cp') return lichessCurve(score.cp);
  if (score.kind === 'mate') return lichessCurve(score.mate > 0 ? CAP : -CAP);
  return score.winner === null ? 50 : lichessCurve(score.winner === 'white' ? CAP : -CAP);
}

function finalScore(fen: string): FinalScore | undefined {
  const outcome = Chess.fromSetup(parseFen(fen).unwrap()).unwrap().outcome();
  return outcome && { kind: 'final', winner: outcome.winner ?? null };
}

/** The engine speaks from the side to move; the rest of the app speaks from white. */
function toWhite(score: Score, fen: string): Score {
  if (fen.split(' ')[1] !== 'b') return score;
  return score.kind === 'cp' ? { kind: 'cp', cp: -score.cp } : { kind: 'mate', mate: -score.mate };
}

type Options = { depth?: number; onProgress?: (done: number, total: number) => void };

/** Analyses the positions in series; rejects at the first engine failure. */
export async function analyseGame(
  engine: Engine,
  fens: string[],
  { depth = ANALYSIS_DEPTH, onProgress }: Options = {},
): Promise<WhiteScore[]> {
  const scores: WhiteScore[] = [];
  for (const fen of fens) {
    scores.push(finalScore(fen) ?? toWhite((await engine.analyse(fen, { depth })).score, fen));
    onProgress?.(scores.length, fens.length);
  }
  return scores;
}
