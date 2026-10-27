import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseGamePgn } from '../domain/pgn.ts';
import { Board } from './Board.tsx';
import './GameViewer.css';

export function GameViewer({ pgn }: { pgn: string }) {
  const { t } = useTranslation();
  const positions = useMemo(() => {
    try {
      return parseGamePgn(pgn);
    } catch {
      return null;
    }
  }, [pgn]);
  const [ply, setPly] = useState(0);

  if (!positions) return <p role="alert">{t('game.invalid')}</p>;
  const last = positions.length - 1;
  const current = positions[ply];
  return (
    <section className="game-viewer" aria-label={t('game.title')}>
      <Board fen={current?.fen ?? ''} label={t('game.boardLabel')} />
      <p className="game-viewer-status" role="status">
        {t('game.move', { current: ply, total: last })}
        {current?.san && <strong>{current.san}</strong>}
      </p>
      <div className="game-viewer-controls">
        <button type="button" disabled={ply === 0} onClick={() => setPly(ply - 1)}>
          {t('game.prev')}
        </button>
        <button type="button" disabled={ply === last} onClick={() => setPly(ply + 1)}>
          {t('game.next')}
        </button>
      </div>
    </section>
  );
}
