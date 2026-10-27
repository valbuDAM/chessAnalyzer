import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { findGame, type Game, outcome } from '../domain/chesscom.ts';
import { playerView } from '../domain/games.ts';
import { formatDate, formatNumber } from '../i18n/format.ts';
import { ApiError } from './ApiError.tsx';
import { GameViewer } from './GameViewer.tsx';
import './Home.css';

type State =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'notFound' }
  | { status: 'ready'; game: Game };

export function GamePage({ user, id }: { user: string; id: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt only re-runs the load on retry
  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    findGame(user, id).then(
      (game) => current && setState(game ? { status: 'ready', game } : { status: 'notFound' }),
      (error) => current && setState({ status: 'error', error }),
    );
    return () => {
      current = false;
    };
  }, [user, id, attempt]);

  return (
    <main className="page">
      <h1>{user}</h1>
      <Link href={`/u/${encodeURIComponent(user)}${window.location.search}`}>{t('gamePage.back')}</Link>
      {state.status === 'loading' && <p role="status">{t('gamePage.loading')}</p>}
      {state.status === 'error' && <ApiError error={state.error} onRetry={() => setAttempt((n) => n + 1)} />}
      {state.status === 'notFound' && <p role="alert">{t('gamePage.notFound')}</p>}
      {state.status === 'ready' && <GameSummary game={state.game} user={user} />}
    </main>
  );
}

function GameSummary({ game, user }: { game: Game; user: string }) {
  const { t } = useTranslation();
  return (
    <section className="game-summary" aria-labelledby="game-summary-title">
      <h2 id="game-summary-title">{t('gamePage.title', { white: game.white.username, black: game.black.username })}</h2>
      <p className="game-summary-meta">{formatDate(game.endTime * 1000)}</p>
      <ul className="game-summary-players">
        {(['white', 'black'] as const).map((side) => (
          <li key={side}>
            <span>{t(`user.${side}`)}</span>
            <strong>{game[side].username}</strong>
            <span>{formatNumber(game[side].rating)}</span>
          </li>
        ))}
      </ul>
      <p className="game-summary-result">
        {t('user.result')}: <strong>{outcome(game)}</strong>
      </p>
      <GameViewer pgn={game.pgn} orientation={playerView(game, user).color} />
    </section>
  );
}
