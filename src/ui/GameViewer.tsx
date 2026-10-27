import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { analyseGame, type WhiteScore, winPercent } from '../domain/analysis.ts';
import type { Engine } from '../domain/engine/engine.ts';
import { parseGamePgn } from '../domain/pgn.ts';
import { createEngine } from '../engine/createEngine.ts';
import { formatEval } from '../i18n/format.ts';
import { Board } from './Board.tsx';
import { EvalBar } from './EvalBar.tsx';
import './GameViewer.css';

type Analysis =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number }
  | { status: 'done'; scores: WhiteScore[] }
  | { status: 'error' };

export function GameViewer({
  pgn,
  orientation = 'white',
  makeEngine = createEngine,
}: {
  pgn: string;
  /** The side shown at the bottom, for the board and the evaluation bar alike. */
  orientation?: 'white' | 'black';
  makeEngine?: () => Engine;
}) {
  const { t } = useTranslation();
  const positions = useMemo(() => {
    try {
      return parseGamePgn(pgn);
    } catch {
      return null;
    }
  }, [pgn]);
  const [ply, setPly] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis>({ status: 'idle' });
  const engine = useRef<Engine>(null);

  // Leaving the page stops the search; `analyse` ignores whatever the dropped engine rejects with.
  useEffect(
    () => () => {
      engine.current?.stop();
      engine.current?.dispose();
      engine.current = null;
    },
    [],
  );

  if (!positions) return <p role="alert">{t('game.invalid')}</p>;
  const last = positions.length - 1;
  const current = positions[ply];
  const scores = analysis.status === 'done' ? analysis.scores : undefined;
  const currentScore = scores?.[ply];

  const analyse = async () => {
    let own: Engine | undefined;
    setAnalysis({ status: 'running', done: 0, total: positions.length });
    try {
      own = makeEngine();
      engine.current = own;
      const result = await analyseGame(
        own,
        positions.map((p) => p.fen),
        { onProgress: (done, total) => setAnalysis({ status: 'running', done, total }) },
      );
      setAnalysis({ status: 'done', scores: result });
    } catch {
      if (!own || engine.current === own) setAnalysis({ status: 'error' });
    } finally {
      own?.dispose();
      if (engine.current === own) engine.current = null;
    }
  };

  const rows = scores
    ? positions.flatMap((p, n) => {
        const score = scores[n];
        return n > 0 && score ? [{ fen: p.fen, san: p.san, n, score }] : [];
      })
    : [];

  return (
    <section className="game-viewer" aria-label={t('game.title')}>
      <div className="game-viewer-play">
        {currentScore && (
          <EvalBar whitePercent={winPercent(currentScore)} text={formatEval(currentScore)} orientation={orientation} />
        )}
        <Board fen={current?.fen ?? ''} label={t('game.boardLabel')} orientation={orientation} />
      </div>
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
      {analysis.status !== 'done' && (
        <div className="game-viewer-controls">
          <button type="button" disabled={analysis.status === 'running'} onClick={analyse}>
            {t('game.analyse')}
          </button>
        </div>
      )}
      {analysis.status === 'running' && (
        // A native <progress> is announced every few percent; a live region would read out every position.
        <div className="game-viewer-progress">
          <progress max={analysis.total} value={analysis.done} aria-label={t('game.progressLabel')} />
          <span aria-hidden="true">{t('game.analysing', { done: analysis.done, total: analysis.total })}</span>
        </div>
      )}
      {analysis.status === 'error' && <p role="alert">{t('game.analysisError')}</p>}
      {rows.length > 0 && (
        <ol className="game-viewer-evals" aria-label={t('game.evalList')}>
          {rows.map(({ fen, san, n, score }) => (
            <li key={fen} aria-current={ply === n ? 'step' : undefined}>
              <span>
                {Math.ceil(n / 2)}
                {n % 2 === 1 ? '.' : '…'}
              </span>
              <span>{san}</span>
              <strong>{formatEval(score)}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
