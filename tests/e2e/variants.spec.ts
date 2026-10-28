import { expect, test } from './fixtures';

const side = { rating: 1500, result: 'win' };
const base = {
  pgn: '[Event "Live Chess"]\n[White "ana"]\n[Black "luis"]\n[Result "1-0"]\n\n1. e4 e5 1-0',
  time_control: '180',
  time_class: 'blitz',
  rated: true,
  end_time: 1709300000,
  white: { username: 'ana', ...side },
  black: { username: 'luis', ...side, result: 'resigned' },
};
const games = [
  { ...base, url: 'https://www.chess.com/game/live/300000001', rules: 'chess' },
  { ...base, url: 'https://www.chess.com/game/live/300000002', rules: 'chess960' },
];

test('a Chess960 game is marked in the list and explained when opened', async ({
  page,
  expectNoSeriousA11yViolations,
}) => {
  await page.route('https://api.chess.com/pub/player/ana', (r) => r.fulfill({ json: { username: 'ana' } }));
  await page.route('https://api.chess.com/pub/player/ana/games/archives', (r) =>
    r.fulfill({ json: { archives: ['https://api.chess.com/pub/player/ana/games/2024/03'] } }),
  );
  await page.route('https://api.chess.com/pub/player/ana/games/2024/**', (r) => r.fulfill({ json: { games } }));

  await page.goto('/');
  await page.getByLabel('Usuario de chess.com').fill('ana');
  await page.getByRole('button', { name: 'Ver partidas' }).click();

  const links = page.getByRole('link', { name: /luis/ });
  await expect(links).toHaveCount(2);
  await expect(links.filter({ hasText: 'No compatible' })).toHaveCount(1);

  await links.filter({ hasText: 'No compatible' }).click();
  await expect(page.getByRole('alert')).toContainText('Chess960');
  await expect(page.getByRole('button', { name: 'Analizar' })).toHaveCount(0);
  await expectNoSeriousA11yViolations();
});
