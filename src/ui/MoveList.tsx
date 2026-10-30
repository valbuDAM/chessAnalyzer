import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { WhiteScore } from '../domain/analysis.ts';
import type { Position } from '../domain/pgn.ts';
import { formatClock, formatEval } from '../i18n/format.ts';
import './MoveList.css';

// Scrolls only the list, never the page, and only when the move is out of view. Stable identity: React
// calls a ref function again whenever its identity changes, and that would re-scroll on every render.
export function scrollToView(el: HTMLButtonElement | null) {
  const list = el?.offsetParent;
  if (!el || !list) return;
  if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
  else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight)
    list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
}

// Deferred to the next frame: reading offsetTop inside the key handler forces a layout of the whole list, a second one after
// the frame's own. Stable identity, like `scrollToView`.
const scrollSoon = (el: HTMLButtonElement | null) => {
  if (el) requestAnimationFrame(() => scrollToView(el));
};

// Memoised so a new evaluation re-renders only its own move, not all 300 of a long game.
const Move = memo(function Move({
  position,
  score,
  current,
  ply,
  onSelect,
}: {
  position: Position;
  score: WhiteScore | undefined;
  current: boolean;
  ply: number;
  onSelect: (ply: number) => void;
}) {
  return (
    <button
      type="button"
      ref={current ? scrollSoon : undefined}
      aria-current={current ? 'step' : undefined}
      onClick={() => onSelect(ply)}
    >
      <span>{position.san}</span>
      {position.clock !== null && <small>{formatClock(position.clock)}</small>}
      {score && <strong>{formatEval(score)}</strong>}
    </button>
  );
});

export function MoveList({
  positions,
  ply,
  scores,
  onSelect,
}: {
  positions: Position[];
  ply: number;
  scores?: WhiteScore[] | undefined;
  onSelect: (ply: number) => void;
}) {
  const { t } = useTranslation();

  const move = (n: number) => {
    const p = positions[n];
    return p && <Move position={p} score={scores?.[n]} current={ply === n} ply={n} onSelect={onSelect} />;
  };

  const pairs = Array.from({ length: Math.ceil((positions.length - 1) / 2) }, (_, i) => i + 1);
  return (
    <ol className="move-list" aria-label={t('game.moves')}>
      {pairs.map((n) => (
        <li key={n}>
          <span className="move-list-number">{n}.</span>
          {move(2 * n - 1)}
          {move(2 * n)}
        </li>
      ))}
    </ol>
  );
}
