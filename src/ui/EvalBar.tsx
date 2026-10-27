import { useTranslation } from 'react-i18next';
import './EvalBar.css';

/** `whitePercent` in 0..100 (white's share of the bar); `text` is the formatted evaluation. */
export function EvalBar({ whitePercent, text }: { whitePercent: number; text: string }) {
  const { t } = useTranslation();
  const whiteAhead = whitePercent >= 50;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a native <meter> cannot hold the custom fill and evaluation text.
    <div
      className="eval-bar"
      role="meter"
      aria-label={t('evalBar.label')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={whitePercent}
      aria-valuetext={text}
    >
      <div className="eval-bar__white" style={{ blockSize: `${whitePercent}%` }} />
      <span className="eval-bar__text" data-side={whiteAhead ? 'white' : 'black'} aria-hidden="true">
        {text}
      </span>
    </div>
  );
}
