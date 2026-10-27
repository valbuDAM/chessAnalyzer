import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { type Game, getLastGame, outcome } from '../domain/chesscom.ts';
import { formatDate, formatNumber } from '../i18n/format.ts';
import './Home.css';

type State = { status: 'loading' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; game: Game };

export function UserPage({ user }: { user: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    getLastGame(user).then(
      (game) => current && setState(game ? { status: 'ready', game } : { status: 'empty' }),
      () => current && setState({ status: 'error' }),
    );
    return () => {
      current = false;
    };
  }, [user]);

  return (
    <main className="page">
      <h1>{user}</h1>
      <Link href="/">{t('user.back')}</Link>
      {state.status === 'loading' && <p role="status">{t('user.loading')}</p>}
      {state.status === 'error' && <p role="alert">{t('user.error')}</p>}
      {state.status === 'empty' && <p role="status">{t('user.empty')}</p>}
      {state.status === 'ready' && <LastGame game={state.game} />}
    </main>
  );
}

function LastGame({ game }: { game: Game }) {
  const { t } = useTranslation();
  return (
    <section className="last-game" aria-labelledby="last-game-title">
      <h2 id="last-game-title">{t('user.lastGame')}</h2>
      <p className="last-game-meta">{formatDate(game.endTime * 1000)}</p>
      <ul className="last-game-players">
        {(['white', 'black'] as const).map((side) => (
          <li key={side}>
            <span>{t(`user.${side}`)}</span>
            <strong>{game[side].username}</strong>
            <span>{formatNumber(game[side].rating)}</span>
          </li>
        ))}
      </ul>
      <p className="last-game-result">
        {t('user.result')}: <strong>{outcome(game)}</strong>
      </p>
    </section>
  );
}
