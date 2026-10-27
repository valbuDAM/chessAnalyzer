import { expect, test } from './fixtures';

test('styleguide has no serious a11y violations in dark and light themes', async ({
  page,
  expectNoSeriousA11yViolations,
}) => {
  await page.goto('/styleguide.html');
  await expect(page.locator('.board cg-board')).toBeVisible();
  await expectNoSeriousA11yViolations();

  await page.getByRole('button', { name: 'Modo claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expectNoSeriousA11yViolations();
});
