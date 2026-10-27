import type { WhiteScore } from '../domain/analysis.ts';

const LOCALE = 'es';

export const formatNumber = (n: number, digits = 0) =>
  new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

/** `ratio` en 0..1 (0.873 → «87,3 %»). */
export const formatPercent = (ratio: number, digits = 1) =>
  new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);

export const formatDate = (date: Date | number) =>
  new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' }).format(date);

/** «+0,3», «−1,3», «#3», «-#2», «1-0»; always from white's point of view. */
export function formatEval(score: WhiteScore): string {
  if (score.kind === 'cp') {
    return new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    }).format(score.cp / 100);
  }
  if (score.kind === 'mate') return `${score.mate < 0 ? '-' : ''}#${Math.abs(score.mate)}`;
  return score.winner === 'white' ? '1-0' : score.winner === 'black' ? '0-1' : '½-½';
}
