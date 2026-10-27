import { expect, it } from 'vitest';
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
