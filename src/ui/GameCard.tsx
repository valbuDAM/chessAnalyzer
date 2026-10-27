import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import type { Game } from '../domain/chesscom.ts';
import { gameId, moveCount, playerView } from '../domain/games.ts';
import { formatDate, formatNumber } from '../i18n/format.ts';
import './GameCard.css';

/**
 * One game seen from `user`: the whole card is the link, so its text is the accessible name.
 * `search` carries the list state (`?months=3`) so the game page can link back to the same list.
 */
export function GameCard({ game, user, search = '' }: { game: Game; user: string; search?: string }) {
  const { t } = useTranslation();
  const { color, opponent, result } = playerView(game, user);
  return (
    <Link className="game-card" data-result={result} href={`/u/${encodeURIComponent(user)}/${gameId(game)}${search}`}>
      <span className="game-card-score">
        <span aria-hidden="true">{t(`card.score.${result}`)}</span>{' '}
        <span className="game-card-result">{t(`card.result.${result}`)}</span>
      </span>{' '}
      {/* the spaces between parts keep the link's accessible name readable; grid layout ignores them */}
      <span className="game-card-opponent">
        <strong>{opponent.username}</strong> <span>{formatNumber(opponent.rating)}</span>
      </span>{' '}
      <span className="game-card-meta">
        <span className="game-card-chip" data-color={color} aria-hidden="true" />
        {t(`card.timeClass.${game.timeClass}`, { defaultValue: game.timeClass })}, {t(`card.color.${color}`)},{' '}
        {t('card.moves', { count: moveCount(game.pgn) })}
      </span>{' '}
      <time className="game-card-date" dateTime={new Date(game.endTime * 1000).toISOString()}>
        {formatDate(game.endTime * 1000)}
      </time>
    </Link>
  );
}
