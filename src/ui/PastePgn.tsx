import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { PgnError, type PgnGame, type PgnProblem, parseGamePgn, readPgn } from '../domain/pgn.ts';
import { storePastedGame } from './PastedGamePage.tsx';

export function PastePgn() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const id = useId();
  const [text, setText] = useState('');
  const [games, setGames] = useState<PgnGame[] | null>(null);
  const [chosen, setChosen] = useState(0);
  const [problem, setProblem] = useState<PgnProblem | null>(null);

  function open(game: PgnGame) {
    parseGamePgn(game.pgn);
    storePastedGame(game);
    navigate('/pgn');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setProblem(null);
    try {
      const list = games ?? readPgn(text);
      const pick = list[games ? chosen : 0];
      if (pick && (games || list.length === 1)) return open(pick);
      // shortcut: the list is not paginated, split it up if pastes pass ~500 games
      setGames(list);
      setChosen(0);
    } catch (err) {
      if (!(err instanceof PgnError)) throw err;
      setProblem(err.problem);
    }
  }

  return (
    <form className="user-form paste-form" onSubmit={submit}>
      <label htmlFor={`${id}-pgn`}>{t('paste.label')}</label>
      <textarea
        id={`${id}-pgn`}
        value={text}
        rows={6}
        spellCheck={false}
        aria-invalid={problem !== null}
        aria-describedby={problem ? `${id}-error` : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setGames(null);
          setProblem(null);
        }}
      />
      {problem && (
        <p id={`${id}-error`} role="alert" className="paste-error">
          {problemText(t, problem)}
        </p>
      )}
      {games && games.length > 1 && (
        <fieldset className="paste-games">
          <legend>{t('paste.pick', { count: games.length })}</legend>
          {games.map((g, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the list is rebuilt as a whole, never reordered
            <label key={i}>
              <input type="radio" name={`${id}-game`} checked={chosen === i} onChange={() => setChosen(i)} />
              {t('paste.game', { white: g.white, black: g.black, result: g.result })}
              {g.date && <span> · {g.date}</span>}
            </label>
          ))}
        </fieldset>
      )}
      <button type="submit" disabled={text.trim() === ''}>
        {games && games.length > 1 ? t('paste.analyseThis') : t('paste.analyse')}
      </button>
    </form>
  );
}

function problemText(t: ReturnType<typeof useTranslation>['t'], p: PgnProblem) {
  if (p.kind === 'illegal') return t(p.black ? 'paste.error.illegalBlack' : 'paste.error.illegalWhite', p);
  return t(`paste.error.${p.kind}`);
}
