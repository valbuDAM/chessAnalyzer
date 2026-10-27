import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../i18n/format.ts';
import { Board } from '../ui/Board.tsx';
import { EvalBar } from '../ui/EvalBar.tsx';
import { MOVE_LABELS, MoveBadge } from '../ui/MoveBadge.tsx';
import './styleguide.css';

const FEN = '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1';
const DEMO = [
  { eval: 0.3, white: 53, label: 'best' },
  { eval: 2.4, white: 79, label: 'brilliant' },
  { eval: -1.8, white: 27, label: 'blunder' },
] as const;

const COLORS = ['bg', 'surface', 'raised', 'text', 'text-muted', 'accent', 'felt', 'board-light', 'board-dark'];
const SURFACES = ['bg', 'surface', 'raised'];
const SPACES = [1, 2, 3, 4, 5, 6, 7, 8];
const RADII = ['sm', 'md', 'round'];
const MOTION = ['--duration-fast', '--duration-base', '--duration-slow', '--ease-out', '--ease-spring'];

export function Styleguide() {
  const { t } = useTranslation();
  const [light, setLight] = useState(false);
  const [step, setStep] = useState(0);
  const demo = DEMO[step % DEMO.length] ?? DEMO[0];

  useEffect(() => {
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
  }, [light]);

  return (
    <main className="sg">
      <header className="sg-hero">
        <div className="sg-hero__text">
          <h1 className="sg-wordmark">{t('app.title')}</h1>
          <p className="sg-lede">{t('styleguide.title')}</p>
          <p className="sg-intro">{t('styleguide.intro')}</p>
          <div className="sg-actions">
            <button type="button" className="sg-button" aria-pressed={light} onClick={() => setLight(!light)}>
              {t('styleguide.lightMode')}
            </button>
            <button type="button" className="sg-button" onClick={() => setStep(step + 1)}>
              {t('styleguide.playDemo')}
            </button>
          </div>
        </div>
        <figure className="sg-table">
          <div className="sg-table__play">
            <EvalBar whitePercent={demo.white} text={`${demo.eval > 0 ? '+' : ''}${formatNumber(demo.eval, 1)}`} />
            <div className="sg-table__board">
              <Board fen={FEN} label={t('styleguide.boardLabel')} />
              <span className="sg-table__badge" key={step}>
                <MoveBadge label={demo.label} />
              </span>
            </div>
          </div>
          <figcaption>{t('styleguide.boardCaption')}</figcaption>
        </figure>
      </header>

      <section className="sg-section" aria-labelledby="sg-palette">
        <h2 id="sg-palette">{t('styleguide.palette')}</h2>
        <ul className="sg-swatches">
          {COLORS.map((c) => (
            <li key={c}>
              <span className="sg-swatch" style={{ background: `var(--color-${c})` }} />
              <code>--color-{c}</code>
            </li>
          ))}
        </ul>
        <h3>{t('styleguide.pairs')}</h3>
        <div className="sg-pairs">
          {SURFACES.map((s) => (
            <div key={s} className="sg-pair" style={{ background: `var(--color-${s})` }}>
              <code>--color-{s}</code>
              <p>{t('styleguide.text')}</p>
              <p className="sg-muted">{t('styleguide.textMuted')}</p>
              <p className="sg-accent">{t('styleguide.accent')}</p>
            </div>
          ))}
          <div className="sg-pair sg-pair--felt">
            <code>--color-felt</code>
            <p>{t('styleguide.text')}</p>
            <p className="sg-muted">{t('styleguide.textMuted')}</p>
          </div>
        </div>
      </section>

      <section className="sg-section" aria-labelledby="sg-type">
        <h2 id="sg-type">{t('styleguide.typography')}</h2>
        <p className="sg-display-sample">{t('styleguide.headingSample')}</p>
        <p className="sg-muted">{t('styleguide.displayFont')}</p>
        <p className="sg-body-sample">{t('styleguide.bodySample')}</p>
        <p className="sg-muted">{t('styleguide.uiFont')}</p>
        <p className="sg-numbers">{t('styleguide.numbersSample')}</p>
      </section>

      <section className="sg-section sg-columns" aria-labelledby="sg-space">
        <div>
          <h2 id="sg-space">{t('styleguide.spacing')}</h2>
          <ul className="sg-spaces">
            {SPACES.map((n) => (
              <li key={n}>
                <code>--space-{n}</code>
                <span className="sg-space" style={{ inlineSize: `var(--space-${n})` }} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>{t('styleguide.radii')}</h2>
          <ul className="sg-radii">
            {RADII.map((r) => (
              <li key={r}>
                <span className="sg-radius" style={{ borderRadius: `var(--radius-${r})` }} />
                <code>--radius-{r}</code>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>{t('styleguide.motion')}</h2>
          <ul className="sg-motion">
            {MOTION.map((m) => (
              <li key={m}>
                <code>{m}</code>
              </li>
            ))}
          </ul>
          <p className="sg-muted">{t('styleguide.motionNote')}</p>
        </div>
      </section>

      <section className="sg-section" aria-labelledby="sg-labels">
        <h2 id="sg-labels">{t('styleguide.labels')}</h2>
        <ul className="sg-labels">
          {MOVE_LABELS.map((l) => (
            <li key={l}>
              <MoveBadge label={l} />
              <span>{t(`moveLabel.${l}`)}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
