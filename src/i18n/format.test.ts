import { expect, it } from 'vitest';
import { formatDate, formatEval, formatNumber, formatPercent } from './format.ts';

// Intl usa NBSP (U+00A0) como separador en es; se normaliza para comparar.
const plain = (s: string) => s.replace(/[  ]/g, ' ');

it('formats numbers with Spanish decimal comma and fixed digits', () => {
  expect(formatNumber(1234.5, 2)).toBe('1234,50');
  expect(formatNumber(12345.6)).toBe('12.346');
});

it('formats a 0..1 ratio as a percentage', () => {
  expect(plain(formatPercent(0.873))).toBe('87,3 %');
  expect(plain(formatPercent(1, 0))).toBe('100 %');
});

it('formats dates in Spanish', () => {
  expect(formatDate(new Date(2026, 9, 26))).toBe('26 oct 2026');
});

it('formats evaluations: pawns with sign, mates and finished games', () => {
  const minus = (s: string) => s.replace(/−/g, '-');
  expect(formatEval({ kind: 'cp', cp: 30 })).toBe('+0,3');
  expect(minus(formatEval({ kind: 'cp', cp: -130 }))).toBe('-1,3');
  expect(formatEval({ kind: 'cp', cp: 0 })).toBe('0,0');
  expect(formatEval({ kind: 'mate', mate: 3 })).toBe('#3');
  expect(formatEval({ kind: 'mate', mate: -2 })).toBe('-#2');
  expect(formatEval({ kind: 'final', winner: 'white' })).toBe('1-0');
  expect(formatEval({ kind: 'final', winner: 'black' })).toBe('0-1');
  expect(formatEval({ kind: 'final', winner: null })).toBe('½-½');
});
