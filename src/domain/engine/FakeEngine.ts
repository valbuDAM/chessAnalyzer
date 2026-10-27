import { type Engine, EngineError, type Eval } from './engine.ts';

/** Engine for consumer tests: answers from a table of scripted evaluations, keyed by FEN. */
export class FakeEngine implements Engine {
  readonly calls: string[] = [];
  #disposed = false;

  constructor(private readonly evals: Record<string, Eval>) {}

  analyse(fen: string): Promise<Eval> {
    this.calls.push(fen);
    if (this.#disposed) return Promise.reject(new EngineError('Engine disposed'));
    const result = this.evals[fen];
    return result ? Promise.resolve(result) : Promise.reject(new EngineError(`No scripted eval for ${fen}`));
  }

  stop(): void {}

  dispose(): void {
    this.#disposed = true;
  }
}
