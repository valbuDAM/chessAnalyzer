import { useTranslation } from 'react-i18next';
import { ChessComError, type ErrorKind } from '../domain/chesscom.ts';

// A retry cannot fix an unknown user or a body the app does not understand.
const RETRYABLE: ErrorKind[] = ['rateLimit', 'offline', 'timeout', 'http'];

export function ApiError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const kind = error instanceof ChessComError ? error.kind : 'http';
  return (
    <div role="alert">
      <p>{t(`error.${kind}`)}</p>
      {RETRYABLE.includes(kind) && (
        <button type="button" onClick={onRetry}>
          {t('error.retry')}
        </button>
      )}
    </div>
  );
}
