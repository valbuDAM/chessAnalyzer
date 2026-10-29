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
    if (!p) return null;
    const score = scores?.[n];
    return (
      <button
        type="button"
        ref={ply === n ? scrollToView : undefined}
        aria-current={ply === n ? 'step' : undefined}
        onClick={() => onSelect(n)}
      >
        <span>{p.san}</span>
        {p.clock !== null && <small>{formatClock(p.clock)}</small>}
        {score && <strong>{formatEval(score)}</strong>}
      </button>
    );
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
