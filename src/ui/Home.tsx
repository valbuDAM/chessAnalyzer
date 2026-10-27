import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import './Home.css';

export function Home() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [user, setUser] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const name = user.trim();
    if (name) navigate(`/u/${encodeURIComponent(name)}`);
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
          <button type="submit">{t('home.submit')}</button>
        </div>
      </form>
    </main>
  );
}
