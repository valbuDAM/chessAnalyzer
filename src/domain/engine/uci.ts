import type { Score } from './engine.ts';

export type Info = { depth: number; score: Score; bound?: 'lower' | 'upper'; pv: string[] };

/** Parses an `info` line; `undefined` for lines that carry no depth and score (`info string`, `currmove`…). */
export function parseInfo(line: string): Info | undefined {
  const t = line.split(/\s+/);
  if (t[0] !== 'info') return undefined;
  const depth = Number(t[t.indexOf('depth') + 1]);
  const s = t.indexOf('score');
  const value = Number(t[s + 2]);
  const kind = t[s + 1];
  if (!Number.isInteger(depth) || s < 0 || (kind !== 'cp' && kind !== 'mate') || !Number.isInteger(value)) {
    return undefined;
  }
  const bound = t[s + 3] === 'lowerbound' ? 'lower' : t[s + 3] === 'upperbound' ? 'upper' : undefined;
  const pv = t.includes('pv') ? t.slice(t.indexOf('pv') + 1) : [];
  return { depth, score: kind === 'cp' ? { kind, cp: value } : { kind, mate: value }, ...(bound && { bound }), pv };
}

/** `{ move: null }` when the position has no legal moves (`bestmove (none)`). */
export function parseBestMove(line: string): { move: string | null } | undefined {
  const [head, move] = line.split(/\s+/);
  if (head !== 'bestmove' || !move) return undefined;
  return { move: move === '(none)' ? null : move };
}
