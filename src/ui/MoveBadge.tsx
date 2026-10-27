import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './MoveBadge.css';

export const MOVE_LABELS = [
  'brilliant',
  'great',
  'best',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'blunder',
  'miss',
] as const;
export type MoveLabel = (typeof MOVE_LABELS)[number];

const icon = (d: string, filled = false) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    {...(filled ? { fill: 'currentColor' } : { fill: 'none', stroke: 'currentColor' })}
  >
    <path d={d} />
  </svg>
);

// Annotation glyphs where chess notation has one; small icons otherwise.
const MARKS: Record<MoveLabel, ReactNode> = {
  brilliant: '!!',
  great: '!',
  best: icon('M8 1.5l1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.3 4 13.5l1-4.4-3.4-3 4.5-.5z', true),
  good: icon('M3.5 8.5l3 3 6-7'),
  book: icon('M2 3.5c2-.8 4-.8 6 .6 2-1.4 4-1.4 6-.6v9c-2-.8-4-.8-6 .6-2-1.4-4-1.4-6-.6zM8 4.1v9'),
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  miss: icon('M4.5 4.5l7 7M11.5 4.5l-7 7'),
};

export function MoveBadge({ label }: { label: MoveLabel }) {
  const { t } = useTranslation();
  return (
    <span className="move-badge" data-label={label} role="img" aria-label={t(`moveLabel.${label}`)}>
      {MARKS[label]}
    </span>
  );
}
