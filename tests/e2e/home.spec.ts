import archives from '../fixtures/chesscom/archives.json' with { type: 'json' };
import month from '../fixtures/chesscom/month.json' with { type: 'json' };
import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.route('https://api.chess.com/pub/player/hikaru/games/archives', (r) => r.fulfill({ json: archives }));
  await page.route('https://api.chess.com/pub/player/hikaru/games/2024/**', (r) => r.fulfill({ json: month }));
});

test('home page renders and has no serious a11y violations', async ({ page, expectNoSeriousA11yViolations }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Zugzwang' })).toBeVisible();
  await expectNoSeriousA11yViolations();
});

test('submitting a user shows their last game', async ({ page, expectNoSeriousA11yViolations }) => {
  await page.goto('/');
  await page.getByLabel('Usuario de chess.com').fill('hikaru');
  await page.getByRole('button', { name: 'Ver última partida' }).click();
  await expect(page).toHaveURL('/u/hikaru');
  await expect(page.getByText('MagnusCarlsen')).toBeVisible();
  await expectNoSeriousA11yViolations();
});

test('opening /u/:user directly shows the same (SPA fallback)', async ({ page }) => {
  await page.goto('/u/hikaru');
  await expect(page.getByText('MagnusCarlsen')).toBeVisible();
});
