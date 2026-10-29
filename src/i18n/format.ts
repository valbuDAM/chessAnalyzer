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

/** «marzo de 2024»; UTC because archive months are UTC. */
export const formatMonth = (date: Date | number) =>
  new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);

/** Seconds on the clock → «2:59» or «1:00:01»; tenths are dropped. */
export function formatClock(seconds: number): string {
  const s = Math.floor(seconds);
  const mm = Math.floor(s / 60) % 60;
  const ss = String(s % 60).padStart(2, '0');
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

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
