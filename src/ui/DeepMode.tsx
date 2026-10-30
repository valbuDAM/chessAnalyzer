import { useTranslation } from 'react-i18next';
import { FULL_WASM } from '../domain/engine/fullWasm.ts';
import { formatNumber } from '../i18n/format.ts';
import type { useDeepMode } from './useDeepMode.ts';

const totalMb = Math.round(FULL_WASM.bytes / 1e6);

type Props = {
  mode: ReturnType<typeof useDeepMode>;
  /** An analysis is running: the engine cannot be swapped under it. */
  busy: boolean;
};

/** The deep mode (ADR-029) inside "About the analysis": offer, progress, and the way back. */
export function DeepMode({ mode: { state, activate, cancel, remove }, busy }: Props) {
  const { t } = useTranslation();
  if (state.status === 'unavailable' || state.status === 'checking') return null;

  if (state.status === 'downloading')
    return (
      <div className="game-viewer-deep">
        <progress max={totalMb} value={state.mb} aria-label={t('game.deep.progressLabel')} />
        <span aria-hidden="true">
          {t('game.deep.downloading', { done: formatNumber(state.mb), total: formatNumber(totalMb) })}
        </span>
        <button type="button" onClick={cancel}>
          {t('game.deep.cancel')}
        </button>
      </div>
    );

  if (state.status === 'on')
    return (
      <div className="game-viewer-deep">
        <p>{t('game.deep.on')}</p>
        <button type="button" disabled={busy} onClick={remove}>
          {t('game.deep.remove')}
        </button>
      </div>
    );

  return (
    <div className="game-viewer-deep">
      <p>{t('game.deep.offer', { size: formatNumber(totalMb) })}</p>
      {state.error && <p role="alert">{t(`game.deep.error.${state.error}`)}</p>}
      <button type="button" disabled={busy} onClick={activate}>
        {t('game.deep.activate')}
      </button>
    </div>
  );
}
