import { test, expect } from '@playwright/test';

test.describe('Swipeable transaction rows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('swipe reveals edit and delete actions on mobile', async ({ page }) => {
    await page.goto('/transactions');

    const firstRow = page.locator('.swipeable-row').first();
    const box = await firstRow.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.75;
    const startY = box!.y + box!.height / 2;
    const endX = box!.x + box!.width * 0.25;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, startY, { steps: 10 });
    await page.mouse.up();

    await expect(page.getByText('Editar')).toBeVisible();
    await expect(page.getByText('Eliminar')).toBeVisible();
  });

  test('edit button opens edit modal', async ({ page }) => {
    await page.goto('/transactions');

    const firstRow = page.locator('.swipeable-row').first();
    const box = await firstRow.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.75;
    const startY = box!.y + box!.height / 2;
    const endX = box!.x + box!.width * 0.25;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, startY, { steps: 10 });
    await page.mouse.up();

    await page.getByRole('button', { name: 'Editar' }).first().click();
    await expect(page.getByText('Editar movimiento')).toBeVisible();
  });

  test('delete button opens confirmation modal', async ({ page }) => {
    await page.goto('/transactions');

    const firstRow = page.locator('.swipeable-row').first();
    const box = await firstRow.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.75;
    const startY = box!.y + box!.height / 2;
    const endX = box!.x + box!.width * 0.25;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, startY, { steps: 10 });
    await page.mouse.up();

    await page.getByRole('button', { name: 'Eliminar' }).first().click();
    await expect(page.getByText('Eliminar movimiento')).toBeVisible();
    await expect(page.getByText('¿Estás seguro de que quieres eliminar este movimiento?')).toBeVisible();
  });

  test('desktop shows buttons without swipe', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/transactions');

    const editButtons = page.locator('.list-actions .button:has-text("Editar")');
    await expect(editButtons.first()).toBeVisible();
  });
});
