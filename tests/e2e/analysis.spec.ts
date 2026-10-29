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

test('the move list scrolls itself, not the page, to keep the current move in view', async ({ page }) => {
  const pgn = `[White "ana"]\n[Black "luis"]\n\n${
    '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 ' +
    '11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 15. a4 c5 16. d5 c4 17. Bg5 h6 18. Bd2 Qc7 *'
  }`;
  await page.route('https://api.chess.com/pub/player/ana/games/2024/**', (r) =>
    r.fulfill({ json: { games: [{ ...game, pgn }] } }),
  );
  await page.goto('/');
  await page.getByLabel('Usuario de chess.com').fill('ana');
  await page.getByRole('button', { name: 'Ver partidas' }).click();
  await page.getByRole('link', { name: /luis/ }).click();

  const list = page.getByRole('list', { name: 'Jugadas' });
  const next = page.getByRole('button', { name: 'Siguiente' });
  for (let i = 0; i < 36; i++) await next.click();

  const [box, last] = await Promise.all([list.boundingBox(), list.getByRole('button').last().boundingBox()]);
  expect(last?.y).toBeGreaterThanOrEqual(box?.y ?? Infinity);
  expect((last?.y ?? Infinity) + (last?.height ?? 0)).toBeLessThanOrEqual((box?.y ?? 0) + (box?.height ?? 0) + 1);
});

test('user → list → game → analysis with the real engine', async ({ page, expectNoSeriousA11yViolations }) => {
  await page.goto('/');
  await page.getByLabel('Usuario de chess.com').fill('ana');
  await page.getByRole('button', { name: 'Ver partidas' }).click();
  await page.getByRole('link', { name: /luis/ }).click();
  await expect(page.getByRole('heading', { name: 'ana contra luis' })).toBeVisible();

  await page.getByRole('button', { name: 'Analizar' }).click();

  const moves = page.getByRole('list', { name: 'Jugadas' }).getByRole('button');
  await expect(page.getByRole('button', { name: 'Analizar' })).toHaveCount(0, { timeout: 60_000 });
  // After 2.g4 black plays Qh4#: mate in 1 for black, seen from white; the final position is a finished game.
  await expect(moves.nth(2)).toContainText('-#1');
  await expect(moves.nth(3)).toContainText('0-1');

  await expect(page.getByRole('meter', { name: 'Ventaja de las blancas' })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(moves.nth(0)).toHaveAttribute('aria-current', 'step');
  await moves.nth(2).click(); // 2.g4
  await expect(page.getByRole('status')).toContainText('Jugada 3 de 4');
  await expect(moves.nth(2)).toHaveAttribute('aria-current', 'step');
  await expectNoSeriousA11yViolations();
});
