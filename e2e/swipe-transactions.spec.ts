import { test, expect } from './fixtures';
import { swipeRowOpen } from './helpers/swipe';

async function waitForPageReady(page: import('@playwright/test').Page) {
  await page.locator('.app-header__menu-btn').waitFor({ state: 'visible', timeout: 15000 });
}

async function navigateToTransactions(page: import('@playwright/test').Page) {
  await page.goto('/transactions');
  await waitForPageReady(page);
}

test.describe('Swipeable transaction rows', () => {
  test('swipe reveals edit and delete actions on mobile', async ({ authenticatedPage: { page } }) => {
    await navigateToTransactions(page);

    const firstRow = page.locator('.swipeable-row').first();
    await expect(firstRow).toBeVisible();

    await swipeRowOpen(page, firstRow);

    await expect(page.getByRole('button', { name: 'Editar movimiento' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Eliminar movimiento' })).toBeVisible();
  });

  test('edit button opens edit modal', async ({ authenticatedPage: { page } }) => {
    await navigateToTransactions(page);

    const firstRow = page.locator('.swipeable-row').first();
    await swipeRowOpen(page, firstRow);

    const editBtn = page.getByRole('button', { name: 'Editar movimiento' });
    await editBtn.evaluate(el => (el as HTMLElement).click());
    await expect(page.getByText('Editar movimiento')).toBeVisible();
  });

  test('delete button opens confirmation modal', async ({ authenticatedPage: { page } }) => {
    await navigateToTransactions(page);

    const firstRow = page.locator('.swipeable-row').first();
    await swipeRowOpen(page, firstRow);

    const deleteBtn = page.getByRole('button', { name: 'Eliminar movimiento' });
    await deleteBtn.evaluate(el => (el as HTMLElement).click());
    await expect(page.getByText('Eliminar movimiento')).toBeVisible();
    await expect(
      page.getByText(/eliminar este movimiento/i)
    ).toBeVisible();
  });

  test('desktop shows buttons without swipe', async ({ page }) => {
    test.skip(true, 'Desktop test - run separately from mobile matrix');
    await page.setViewportSize({ width: 1280, height: 800 });
    await navigateToTransactions(page);

    const editButtons = page.locator('.list-actions .button:has-text("Editar")');
    await expect(editButtons.first()).toBeVisible();
  });
});
