import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { analyseGame, type WhiteScore, winPercent } from '../domain/analysis.ts';
import type { Engine } from '../domain/engine/engine.ts';
import { parseGamePgn } from '../domain/pgn.ts';
import { createEngine } from '../engine/createEngine.ts';
import { formatEval } from '../i18n/format.ts';
import { Board } from './Board.tsx';
import { EvalBar } from './EvalBar.tsx';
import { MoveList, scrollToView } from './MoveList.tsx';
import { playSound, readMuted, soundKind, storeMuted } from './sound.ts';
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
  const [flipped, setFlipped] = useState(false);
  const [muted, setMuted] = useState(readMuted);
  // Read once: a rotation must not undo the reader's own fold.
  const [movesOpen] = useState(() => !window.matchMedia?.('(max-width: 40rem)').matches);
  const engine = useRef<Engine>(null);
  const lastPly = useRef(0);
  const last = (positions?.length ?? 1) - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        (target instanceof HTMLElement && target.matches('input, textarea, select'))
      )
        return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1));
      else if (e.key === 'ArrowRight') setPly((p) => Math.min(last, p + 1));
      else if (e.key === 'Home') setPly(0);
      else if (e.key === 'End') setPly(last);
      else if (e.key.toLowerCase() === 'f') setFlipped((f) => !f);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last]);

  const san = positions?.[ply]?.san;
  useEffect(() => {
    if (lastPly.current !== ply && san && !muted) playSound(soundKind(san, ply === last));
    lastPly.current = ply;
  }, [ply, san, muted, last]);

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
  const current = positions[ply];
  const scores = analysis.status === 'done' ? analysis.scores : undefined;
  const currentScore = scores?.[ply];
  const side = flipped ? (orientation === 'white' ? 'black' : 'white') : orientation;
  // Piece letters spoken in Spanish (Cf3, not Nf3); the only uppercase letters in SAN besides O-O are pieces.
  const spokenSan = current?.san?.replace(/[KQRBN]/g, (c) => t('game.pieceLetters').charAt('KQRBN'.indexOf(c)));
  const announcement = spokenSan
    ? t('game.announce', {
        number: Math.ceil(ply / 2),
        san: spokenSan,
        side: t(ply % 2 ? 'game.sideWhite' : 'game.sideBlack'),
      })
    : t('game.start');

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

  return (
    <section className="game-viewer" aria-label={t('game.title')}>
      <div className="game-viewer-play">
        {currentScore && (
          <EvalBar whitePercent={winPercent(currentScore)} text={formatEval(currentScore)} orientation={side} />
        )}
        <Board fen={current?.fen ?? ''} label={t('game.boardLabel')} orientation={side} />
      </div>
      <p className="game-viewer-status" role="status">
        <span aria-hidden="true">{t('game.move', { current: ply, total: last })}</span>
        {current?.san && <strong aria-hidden="true">{current.san}</strong>}
        <span className="sr-only">{announcement}</span>
      </p>
      <div className="game-viewer-controls">
        <button type="button" disabled={ply === 0} onClick={() => setPly(ply - 1)}>
          {t('game.prev')}
        </button>
        <button type="button" disabled={ply === last} onClick={() => setPly(ply + 1)}>
          {t('game.next')}
        </button>
        <button type="button" aria-pressed={flipped} aria-keyshortcuts="F" onClick={() => setFlipped(!flipped)}>
          {t('game.flip')}
        </button>
        <button
          type="button"
          aria-pressed={!muted}
          onClick={() => {
            storeMuted(!muted);
            setMuted(!muted);
          }}
        >
          {t('game.sound')}
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
      <details
        className="game-viewer-moves"
        open={movesOpen}
        // A closed list cannot scroll itself, so bring the current move into view when it opens.
        onToggle={(e) => scrollToView(e.currentTarget.querySelector<HTMLButtonElement>('[aria-current="step"]'))}
      >
        <summary>{t('game.moves')}</summary>
        <MoveList positions={positions} ply={ply} scores={scores} onSelect={setPly} />
      </details>
    </section>
  );
}
