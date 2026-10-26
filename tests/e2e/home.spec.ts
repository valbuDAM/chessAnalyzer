import { expect, test } from './fixtures';

test('home page renders and has no serious a11y violations', async ({ page, expectNoSeriousA11yViolations }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Zugzwang' })).toBeVisible();
  await expectNoSeriousA11yViolations();
});
