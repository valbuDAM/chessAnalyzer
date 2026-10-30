import { afterEach, expect, it, vi } from 'vitest';
import type { Eval } from './engine.ts';
import { FakeEngine } from './FakeEngine.ts';

const eval1: Eval = { score: { kind: 'cp', cp: 12 }, bestMove: 'e2e4', depth: 10, pv: ['e2e4'] };

it('answers scripted positions, records calls, and fails for unknown or disposed use', async () => {
  const engine = new FakeEngine({ a: eval1 });
  await expect(engine.analyse('a')).resolves.toBe(eval1);
  await expect(engine.analyse('b')).rejects.toThrow('No scripted eval');
  engine.stop();
  engine.dispose();
  await expect(engine.analyse('a')).rejects.toThrow('disposed');
  expect(engine.calls).toEqual(['a', 'b', 'a']);
});

afterEach(() => vi.useRealTimers());

it('answers after its latency, and stop rejects what is in flight with an AbortError', async () => {
  vi.useFakeTimers();
  const engine = new FakeEngine({ a: eval1 }, { latency: 100 });
  const slow = engine.analyse('a');
  const settled = vi.fn();
  slow.then(settled, settled);
  await vi.advanceTimersByTimeAsync(99);
  expect(settled).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await expect(slow).resolves.toBe(eval1);

  const aborted = expect(engine.analyse('a')).rejects.toMatchObject({ name: 'AbortError' });
  engine.stop();
  await aborted;
  const next = engine.analyse('a');
  await vi.advanceTimersByTimeAsync(100);
  await expect(next).resolves.toBe(eval1);
});

it('dispose rejects what is in flight with an EngineError', async () => {
  vi.useFakeTimers();
  const engine = new FakeEngine({ a: eval1 }, { latency: 100 });
  const pending = expect(engine.analyse('a')).rejects.toMatchObject({ name: 'EngineError' });
  engine.dispose();
  await pending;
});
