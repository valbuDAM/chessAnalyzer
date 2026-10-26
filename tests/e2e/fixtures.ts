import AxeBuilder from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';

type Fixtures = { expectNoSeriousA11yViolations: () => Promise<void> };

export const test = base.extend<Fixtures>({
  expectNoSeriousA11yViolations: async ({ page }, use) => {
    await use(async () => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    });
  },
});

export { expect };
