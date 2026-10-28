import { useTranslation } from 'react-i18next';
import { Link, Redirect } from 'wouter';
import type { PgnGame } from '../domain/pgn.ts';
import { GameViewer } from './GameViewer.tsx';
import './Home.css';

const KEY = 'zugzwang:pgn';

let current: PgnGame | null = null;

/** Survives a reload but not the tab; a long PGN does not fit in the URL. */
export function storePastedGame(game: PgnGame) {
  current = game;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    // shortcut: with blocked storage the game lives only until a reload, warn the user if it matters
  }
}

function loadPastedGame(): PgnGame | null {
  if (current) return current;
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function PastedGamePage() {
  const { t } = useTranslation();
  const game = loadPastedGame();
  if (!game) return <Redirect to="/" replace />;
  return (
    <main className="page">
      <h1>{t('paste.pageTitle')}</h1>
      <Link href="/">{t('paste.back')}</Link>
      <section className="game-summary" aria-labelledby="game-summary-title">
        <h2 id="game-summary-title">{t('gamePage.title', { white: game.white, black: game.black })}</h2>
        {/* shortcut: always White at the bottom, pick the side when users ask for it */}
        <GameViewer pgn={game.pgn} />
      </section>
    </main>
  );
}
