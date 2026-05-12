import { test, expect } from '@playwright/test';

test('smoke - page loads', async ({ page }) => {
  await page.goto('http://web:3000/');
  await expect(page).toHaveTitle(/Finanzas/);
});
