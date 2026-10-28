import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { getPlayer, normalizeUser } from '../domain/chesscom.ts';
import { ApiError } from './ApiError.tsx';
import { PastePgn } from './PastePgn.tsx';
import './Home.css';

export function Home() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [user, setUser] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>(null);

  function check() {
    const name = normalizeUser(user);
    if (!name) return;
    setChecking(true);
    setError(null);
    getPlayer(name).then(
      () => navigate(`/u/${encodeURIComponent(name)}`),
      (e) => {
        setError(e);
        setChecking(false);
      },
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    check();
  }

  return (
    <main className="page">
      <h1>{t('app.title')}</h1>
      <p className="page-lead">{t('home.lead')}</p>
      <form className="user-form" onSubmit={submit}>
        <label htmlFor="user">{t('home.userLabel')}</label>
        <div className="user-form-row">
          <input
            id="user"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            required
          />
          <button type="submit" disabled={checking}>
            {t('home.submit')}
          </button>
        </div>
      </form>
      {error !== null && <ApiError error={error} onRetry={check} />}
      <PastePgn />
    </main>
  );
}
