import { abortError, type Engine, EngineError, type Eval } from './engine.ts';

type InFlight = { timer: ReturnType<typeof setTimeout>; reject: (reason: Error) => void };

/**
 * Engine for consumer tests: answers from a table of scripted evaluations, keyed by FEN.
 * With a `latency` it answers later and, like the real one, `stop()` aborts what is in flight.
 */
export class FakeEngine implements Engine {
  readonly calls: string[] = [];
  readonly #latency: number;
  readonly #inFlight = new Set<InFlight>();
  #disposed = false;

  constructor(
    private readonly evals: Record<string, Eval>,
    { latency = 0 } = {},
  ) {
    this.#latency = latency;
  }

  analyse(fen: string): Promise<Eval> {
    this.calls.push(fen);
    if (this.#disposed) return Promise.reject(new EngineError('Engine disposed'));
    const result = this.evals[fen];
    if (!result) return Promise.reject(new EngineError(`No scripted eval for ${fen}`));
    if (!this.#latency) return Promise.resolve(result);
    return new Promise((resolve, reject) => {
      const entry: InFlight = {
        timer: setTimeout(() => {
          this.#inFlight.delete(entry);
          resolve(result);
        }, this.#latency),
        reject,
      };
      this.#inFlight.add(entry);
    });
  }

  stop(): void {
    this.#rejectInFlight(abortError());
  }

  dispose(): void {
    this.#disposed = true;
    this.#rejectInFlight(new EngineError('Engine disposed'));
  }

  #rejectInFlight(error: Error): void {
    for (const { timer, reject } of this.#inFlight) {
      clearTimeout(timer);
      reject(error);
    }
    this.#inFlight.clear();
  }
}
