import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { analyseGame, type WhiteScore, winPercent } from '../domain/analysis.ts';
import { readAnalysis, writeAnalysis } from '../domain/analysisCache.ts';
import { type Engine, EngineLoadError } from '../domain/engine/engine.ts';
import type { Variant } from '../domain/engine/variant.ts';
import { parseGamePgn } from '../domain/pgn.ts';
import { createEngine, createFullEngine, detectSettings, detectVariant } from '../engine/createEngine.ts';
import { type DeepDeps, detectDeep } from '../engine/deep.ts';
import { formatEval } from '../i18n/format.ts';
import { Board } from './Board.tsx';
import { DeepMode } from './DeepMode.tsx';
import { EvalBar } from './EvalBar.tsx';
import { MoveList, scrollToView } from './MoveList.tsx';
import { playSound, readMuted, soundKind, storeMuted } from './sound.ts';
import { useDeepMode } from './useDeepMode.ts';
import './GameViewer.css';

type Analysis =
  | { status: 'idle' }
  // `scores` is the part of the game analysed so far, always from the first position on.
  | { status: 'running'; scores: WhiteScore[]; variant: Variant }
  // `variant` is the engine that produced the scores: the deep mode can fall back to lite (ADR-029).
  | { status: 'done'; scores: WhiteScore[]; variant: Variant; fellBack?: boolean }
  | { status: 'error'; engineLoad: boolean };

type Props = {
  pgn: string;
  /** The side shown at the bottom, for the board and the evaluation bar alike. */
  orientation?: 'white' | 'black';
  makeEngine?: () => Engine;
  /** The engine build `makeEngine` will load, shown in "About the analysis". */
  variant?: Variant;
  /** The deep mode of this browser (ADR-029); `undefined` where it is not offered. */
  deep?: DeepDeps | undefined;
  makeFullEngine?: (wasm: Blob) => Engine;
};

// Another game starts from scratch: its position, its analysis, and no answer of the previous one reaches it.
export const GameViewer = (props: Props) => <Viewer key={props.pgn} {...props} />;

function Viewer({
  pgn,
  orientation = 'white',
  makeEngine = createEngine,
  variant = detectVariant(),
  deep,
  makeFullEngine = createFullEngine,
}: Props) {
  const { t } = useTranslation();
  const [deepDeps] = useState(() => deep ?? detectDeep());
  const deepMode = useDeepMode(deepDeps);
  // The variant shown and read from the cache: the deep mode replaces the detected one while it is on.
  const active: Variant = deepMode.state.status === 'on' ? 'full-multi' : variant;
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
  const analysisAbort = useRef<AbortController>(null);
  const lastPly = useRef(0);
  const last = (positions?.length ?? 1) - 1;
  const fens = useMemo(() => positions?.map((p) => p.fen) ?? [], [positions]);
  const depth = detectSettings(active).depth;

  // A game analysed before opens already done, and changing the mode shows the analysis of that mode (or "Analyse").
  // Whatever is running is left alone: its result arrives on its own.
  useEffect(() => {
    let stale = false;
    if (positions)
      void readAnalysis(fens, { variant: active, depth }).then((saved) => {
        if (stale) return;
        setAnalysis((a) => {
          if (a.status === 'running') return a;
          if (saved) return { status: 'done', scores: saved, variant: active };
          return a.status === 'idle' ? a : { status: 'idle' };
        });
      });
    return () => {
      stale = true;
    };
  }, [positions, fens, active, depth]);

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

  // Leaving the page aborts the analysis: the engine stops, is released by `analyse`, and nothing more is shown.
  useEffect(() => () => analysisAbort.current?.abort(), []);

  if (!positions) return <p role="alert">{t('game.invalid')}</p>;
  const current = positions[ply];
  const scores = analysis.status === 'running' || analysis.status === 'done' ? analysis.scores : undefined;
  const currentScore = scores?.[ply];
  // The first position is the start, not a move: "move N of M" counts the moves analysed.
  const moves = Math.max(0, (scores?.length ?? 0) - 1);
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
    const abort = new AbortController();
    analysisAbort.current = abort;
    setAnalysis({ status: 'running', scores: [], variant: active });
    const run = async (engine: Engine, used: Variant, fellBack: boolean) => {
      try {
        const result = await analyseGame(engine, fens, {
          depth,
          signal: abort.signal,
          onProgress: (so) => setAnalysis({ status: 'running', scores: so, variant: used }),
        });
        setAnalysis({ status: 'done', scores: result, variant: used, ...(fellBack && { fellBack }) });
        void writeAnalysis(fens, { variant: used, depth }, result);
      } finally {
        engine.dispose();
      }
    };
    try {
      // ADR-029: if the copy is gone or does not load, this game goes with lite and the copy is kept for the next try.
      const wasm = active === 'full-multi' ? await deepDeps?.cached().catch(() => undefined) : undefined;
      let fellBack = active === 'full-multi' && !wasm;
      if (fellBack) void deepMode.refresh(); // the browser evicted it: offer the download again
      if (wasm) {
        try {
          return await run(makeFullEngine(wasm), 'full-multi', false);
        } catch (error) {
          if (!(error instanceof EngineLoadError) || abort.signal.aborted) throw error;
          fellBack = true;
        }
      }
      await run(makeEngine(), variant, fellBack);
    } catch (error) {
      if (!abort.signal.aborted) setAnalysis({ status: 'error', engineLoad: error instanceof EngineLoadError });
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
          <button
            type="button"
            disabled={analysis.status === 'running' || deepMode.state.status === 'downloading'}
            onClick={analyse}
          >
            {t('game.analyse')}
          </button>
        </div>
      )}
      {analysis.status === 'running' && (
        // A native <progress> is announced every few percent; a live region would read out every position.
        <div className="game-viewer-progress">
          <progress max={last} value={moves} aria-label={t('game.progressLabel')} />
          <span aria-hidden="true">{t('game.analysing', { done: moves, total: last })}</span>
        </div>
      )}
      {analysis.status === 'error' && (
        <p role="alert">{t(analysis.engineLoad ? 'game.engineLoadError' : 'game.analysisError')}</p>
      )}
      {analysis.status === 'done' && analysis.fellBack && <p role="alert">{t('game.fellBack')}</p>}
      <details className="game-viewer-about">
        <summary>{t('game.about')}</summary>
        <p>
          {t(`game.variant.${analysis.status === 'running' || analysis.status === 'done' ? analysis.variant : active}`)}
        </p>
        <DeepMode mode={deepMode} busy={analysis.status === 'running'} />
      </details>
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
