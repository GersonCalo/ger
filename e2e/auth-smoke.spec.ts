import { test, expect } from './fixtures';

test('smoke - auth fixture works', async ({ authenticatedPage: { page, token } }) => {
  expect(token).toBeTruthy();
  await expect(page.locator('.app-header__title')).toBeVisible();
});
