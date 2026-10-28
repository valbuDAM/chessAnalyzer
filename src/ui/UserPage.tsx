import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { getArchives, getMonthGames } from '../domain/chesscom.ts';
import {
  addMonth,
  buildQuery,
  COLORS,
  filterGames,
  type Month,
  monthStart,
  parseQuery,
  type Query,
  RESULTS,
  TIME_CLASSES,
} from '../domain/games.ts';
import { formatMonth } from '../i18n/format.ts';
import { ApiError } from './ApiError.tsx';
import { GameCard } from './GameCard.tsx';
import './Home.css';

type State =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; archives: string[]; start: number; months: Month[] };

type More = { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: unknown };

/** `…/games/2025/03` → `2025-03`, the value of the month filter. */
const monthValue = (url: string) => url.slice(-7).replace('/', '-');

export function UserPage({ user }: { user: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [more, setMore] = useState<More>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const added = useRef(false);
  // Filters, month and loaded months live in the query string, so the list survives a trip to a game and back.
  const [query, setQuery] = useState(() => parseQuery(window.location.search));

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt only re-runs the load on retry
  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    (async () => {
      const archives = (await getArchives(user)).reverse();
      const start = Math.max(
        0,
        archives.findIndex((url) => monthValue(url) === query.month),
      );
      let months: Month[] = [];
      for (const url of archives.slice(start, start + parseQuery(window.location.search).months))
        months = addMonth(months, url, await getMonthGames(url));
      return { archives, start, months };
    })().then(
      ({ archives, start, months }) => current && setState({ status: 'ready', archives, start, months }),
      (error) => current && setState({ status: 'error', error }),
    );
    return () => {
      current = false;
    };
  }, [user, attempt, query.month]);

  // Keyboard and screen reader users land on the month they just loaded, not on the moved button.
  useEffect(() => {
    if (state.status !== 'ready' || !added.current) return;
    added.current = false;
    document.getElementById(`month-${state.months.length - 1}`)?.focus();
  }, [state]);

  const change = (next: Query) => {
    window.history.replaceState(window.history.state, '', buildQuery(next) || window.location.pathname);
    setQuery(next);
  };

  const loadMore = async () => {
    if (state.status !== 'ready') return;
    const url = state.archives[state.start + state.months.length];
    if (!url) return;
    setMore({ status: 'loading' });
    try {
      const months = addMonth(state.months, url, await getMonthGames(url));
      added.current = true;
      setState({ ...state, months });
      setMore({ status: 'idle' });
      change({ ...query, months: months.length });
    } catch (error) {
      setMore({ status: 'error', error });
    }
  };

  const loaded = state.status === 'ready' ? state.months.flatMap((m) => m.games ?? []) : [];
  const shown = filterGames(loaded, user, query).length;
  const active = Boolean(query.timeClass || query.color || query.result || query.month);
  const noMatch = active && loaded.length > 0 && shown === 0;

  return (
    <main className="page">
      <h1>{user}</h1>
      <Link href="/">{t('user.back')}</Link>
      {state.status === 'loading' && <p role="status">{t('user.loading')}</p>}
      {state.status === 'error' && <ApiError error={state.error} onRetry={() => setAttempt((n) => n + 1)} />}
      {state.status === 'ready' && state.archives.length === 0 && <p role="status">{t('user.empty')}</p>}
      {state.status === 'ready' && state.archives.length > 0 && (
        <Filters
          archives={state.archives}
          query={query}
          active={active}
          shown={shown}
          total={loaded.length}
          // a different month restarts the list from that month; a filter keeps the months already loaded
          onChange={(next) => change({ ...next, months: next.month === query.month ? state.months.length : 1 })}
        />
      )}
      {noMatch && (
        <p role="status" className="page-lead">
          {t('filters.empty')}
        </p>
      )}
      {state.status === 'ready' &&
        !noMatch &&
        state.months.map((month, i) => {
          const games = month.games && filterGames(month.games, user, query);
          return (
            <section key={month.url} className="month" aria-labelledby={`month-${i}`}>
              <h2 id={`month-${i}`} tabIndex={-1}>
                {formatMonth(monthStart(month.url))}
              </h2>
              {games?.length ? (
                <ol className="month-games">
                  {games.map((game) => (
                    <li key={game.url}>
                      <GameCard
                        game={game}
                        user={user}
                        search={buildQuery({ ...query, months: state.months.length })}
                      />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="page-lead">
                  {t(
                    !month.games
                      ? 'user.monthUnavailable'
                      : month.games.length
                        ? 'filters.monthNone'
                        : 'user.monthEmpty',
                  )}
                </p>
              )}
            </section>
          );
        })}
      {state.status === 'ready' &&
        state.start + state.months.length < state.archives.length &&
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

const options = (keys: readonly string[], prefix: string, t: (k: string) => string) =>
  keys.map((k) => (
    <option key={k} value={k}>
      {t(`${prefix}.${k}`)}
    </option>
  ));

type Props = {
  archives: string[];
  query: Query;
  active: boolean;
  shown: number;
  total: number;
  onChange: (next: Query) => void;
};

function Filters({ archives, query, active, shown, total, onChange }: Props) {
  const { t } = useTranslation();
  const tr = t as (k: string) => string; // the option keys are built from the filter values
  const select = (name: 'timeClass' | 'color' | 'result' | 'month', children: ReactNode) => (
    <label className="filter">
      {t(`filters.${name}`)}
      <select value={query[name]} onChange={(e) => onChange({ ...query, [name]: e.target.value } as Query)}>
        <option value="">{t(name === 'month' ? 'filters.allMonths' : 'filters.all')}</option>
        {children}
      </select>
    </label>
  );
  return (
    <form className="filters" aria-label={t('filters.title')} onSubmit={(e) => e.preventDefault()}>
      {select('timeClass', options(TIME_CLASSES, 'card.timeClass', tr))}
      {select('color', options(COLORS, 'filters.colors', tr))}
      {select('result', options(RESULTS, 'card.result', tr))}
      {select(
        'month',
        archives.map((url) => (
          <option key={url} value={monthValue(url)}>
            {formatMonth(monthStart(url))}
          </option>
        )),
      )}
      <p role="status" className="filters-count">
        {t('filters.count', { shown, count: total })}
      </p>
      {active && (
        <button
          type="button"
          className="filters-clear"
          onClick={() => onChange({ ...query, timeClass: '', color: '', result: '', month: '' })}
        >
          {t('filters.clear')}
        </button>
      )}
    </form>
  );
}
