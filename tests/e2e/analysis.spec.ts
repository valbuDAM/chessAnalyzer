import { expect, test } from './fixtures';

const game = {
  url: 'https://www.chess.com/game/live/200000001',
  pgn: '[Event "Live Chess"]\n[White "ana"]\n[Black "luis"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1',
  time_control: '180',
  time_class: 'blitz',
  rules: 'chess',
  rated: true,
  end_time: 1709300000,
  white: { username: 'ana', rating: 1500, result: 'checkmated' },
  black: { username: 'luis', rating: 1510, result: 'win' },
};

test.beforeEach(async ({ page }) => {
  await page.route('https://api.chess.com/pub/player/ana', (r) => r.fulfill({ json: { username: 'ana' } }));
  await page.route('https://api.chess.com/pub/player/ana/games/archives', (r) =>
    r.fulfill({ json: { archives: ['https://api.chess.com/pub/player/ana/games/2024/03'] } }),
  );
  await page.route('https://api.chess.com/pub/player/ana/games/2024/**', (r) => r.fulfill({ json: { games: [game] } }));
});

test('user → last game → analysis with the real engine', async ({ page, expectNoSeriousA11yViolations }) => {
  await page.goto('/');
  await page.getByLabel('Usuario de chess.com').fill('ana');
  await page.getByRole('button', { name: 'Ver última partida' }).click();
  await expect(page.getByText('luis')).toBeVisible();

  await page.getByRole('button', { name: 'Analizar' }).click();

  const rows = page.getByRole('list', { name: 'Evaluación de cada jugada' }).getByRole('listitem');
  await expect(rows).toHaveCount(4, { timeout: 60_000 });
  // After 2.g4 black plays Qh4#: mate in 1 for black, seen from white; the final position is a finished game.
  await expect(rows.nth(2)).toContainText('-#1');
  await expect(rows.nth(3)).toContainText('0-1');
  await expect(page.getByRole('button', { name: 'Analizar' })).toHaveCount(0);

  await expect(page.getByRole('meter', { name: 'Ventaja de las blancas' })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(rows.nth(0)).toHaveAttribute('aria-current', 'step');
  await expectNoSeriousA11yViolations();
});
