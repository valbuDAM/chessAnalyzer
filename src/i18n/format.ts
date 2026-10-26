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
