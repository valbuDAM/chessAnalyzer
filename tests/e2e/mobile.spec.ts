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

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

test('the viewer fits 375px, with touch-sized controls and a foldable move list', async ({
  page,
  expectNoSeriousA11yViolations,
}) => {
  await page.route('https://api.chess.com/pub/player/ana', (r) => r.fulfill({ json: { username: 'ana' } }));
  await page.route('https://api.chess.com/pub/player/ana/games/archives', (r) =>
    r.fulfill({ json: { archives: ['https://api.chess.com/pub/player/ana/games/2024/03'] } }),
  );
  await page.route('https://api.chess.com/pub/player/ana/games/2024/**', (r) => r.fulfill({ json: { games: [game] } }));
  await page.goto('/');
  await page.getByLabel('Usuario de chess.com').fill('ana');
  await page.getByRole('button', { name: 'Ver partidas' }).click();
  await page.getByRole('link', { name: /luis/ }).click();
  await expect(page.getByRole('heading', { name: 'ana contra luis' })).toBeVisible();

  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noOverflow()).toBe(true);

  const list = page.getByRole('list', { name: 'Jugadas' });
  await expect(list).toBeHidden();
  const board = await page.getByLabel('Tablero de la partida').boundingBox();
  expect(board?.width).toBeGreaterThan(320);

  for (const button of await page.locator('.game-viewer-controls button').all()) {
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }

  await page.getByText('Jugadas', { exact: true }).click();
  await expect(list).toBeVisible();
  for (const button of await list.getByRole('button').all()) {
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('status')).toContainText('Jugada 1 de 4');
  expect(await noOverflow()).toBe(true);
  await expectNoSeriousA11yViolations();
});
