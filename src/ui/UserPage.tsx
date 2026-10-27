import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { getArchives, getMonthGames } from '../domain/chesscom.ts';
import { addMonth, type Month, monthStart } from '../domain/games.ts';
import { formatMonth } from '../i18n/format.ts';
import { ApiError } from './ApiError.tsx';
import { GameCard } from './GameCard.tsx';
import './Home.css';

type State =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; archives: string[]; months: Month[] };

type More = { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: unknown };

/** How many months the list had, so coming back from a game restores it (`?months=3`). */
const monthsInUrl = () => Math.max(1, Number(new URLSearchParams(window.location.search).get('months')) || 1);

export function UserPage({ user }: { user: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [more, setMore] = useState<More>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const added = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt only re-runs the load on retry
  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    (async () => {
      const archives = (await getArchives(user)).reverse();
      let months: Month[] = [];
      for (const url of archives.slice(0, monthsInUrl())) months = addMonth(months, url, await getMonthGames(url));
      return { archives, months };
    })().then(
      ({ archives, months }) => current && setState({ status: 'ready', archives, months }),
      (error) => current && setState({ status: 'error', error }),
    );
    return () => {
      current = false;
    };
  }, [user, attempt]);

  // Keyboard and screen reader users land on the month they just loaded, not on the moved button.
  useEffect(() => {
    if (state.status !== 'ready' || !added.current) return;
    added.current = false;
    document.getElementById(`month-${state.months.length - 1}`)?.focus();
  }, [state]);

  const loadMore = async () => {
    if (state.status !== 'ready') return;
    const url = state.archives[state.months.length];
    if (!url) return;
    setMore({ status: 'loading' });
    try {
      const months = addMonth(state.months, url, await getMonthGames(url));
      added.current = true;
      setState({ ...state, months });
      setMore({ status: 'idle' });
      window.history.replaceState(window.history.state, '', `?months=${months.length}`);
    } catch (error) {
      setMore({ status: 'error', error });
    }
  };

  return (
    <main className="page">
      <h1>{user}</h1>
      <Link href="/">{t('user.back')}</Link>
      {state.status === 'loading' && <p role="status">{t('user.loading')}</p>}
      {state.status === 'error' && <ApiError error={state.error} onRetry={() => setAttempt((n) => n + 1)} />}
      {state.status === 'ready' && state.archives.length === 0 && <p role="status">{t('user.empty')}</p>}
      {state.status === 'ready' &&
        state.months.map((month, i) => (
          <section key={month.url} className="month" aria-labelledby={`month-${i}`}>
            <h2 id={`month-${i}`} tabIndex={-1}>
              {formatMonth(monthStart(month.url))}
            </h2>
            {month.games?.length ? (
              <ol className="month-games">
                {month.games.map((game) => (
                  <li key={game.url}>
                    <GameCard
                      game={game}
                      user={user}
                      search={state.months.length > 1 ? `?months=${state.months.length}` : ''}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="page-lead">{t(month.games ? 'user.monthEmpty' : 'user.monthUnavailable')}</p>
            )}
          </section>
        ))}
      {state.status === 'ready' &&
        state.months.length < state.archives.length &&
        (more.status === 'error' ? (
          <ApiError error={more.error} onRetry={loadMore} />
        ) : (
          <button type="button" className="load-more" disabled={more.status === 'loading'} onClick={loadMore}>
            {t(more.status === 'loading' ? 'user.loadingMore' : 'user.loadMore')}
          </button>
        ))}
    </main>
  );
}
