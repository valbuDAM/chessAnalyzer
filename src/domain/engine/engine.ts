/** Always from the point of view of the side to move, as in UCI. */
export type Score = { kind: 'cp'; cp: number } | { kind: 'mate'; mate: number };

export type Eval = {
  score: Score;
  /** UCI notation: castling is the king's real target (e1g1). */
  bestMove: string;
  depth: number;
  pv: string[];
};

export type AnalyseOptions = { depth?: number; movetime?: number };

export interface Engine {
  /** Analyses are queued; `stop()` rejects the running one and the queued ones with an `AbortError`. */
  analyse(fen: string, opts?: AnalyseOptions): Promise<Eval>;
  stop(): void;
  /** Releases the engine; pending analyses reject with `EngineError`. */
  dispose(): void;
}

export const DEFAULT_DEPTH = 12;

export class EngineError extends Error {
  override name = 'EngineError';
}

export const abortError = () => Object.assign(new Error('Analysis aborted'), { name: 'AbortError' });
