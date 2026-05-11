import { test, expect } from '@playwright/test';

test.describe('Drawer swipe gesture', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens drawer via menu button and closes with swipe on mobile', async ({ page }) => {
    await page.goto('/dashboard');

    const menuBtn = page.getByRole('button', { name: 'Abrir menú de navegación' });
    await menuBtn.click();

    const drawer = page.locator('#nav-drawer');
    await expect(drawer).toBeVisible();

    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();

    const startY = box!.y + box!.height / 2;
    const startX = box!.x + box!.width * 0.5;
    const endX = box!.x - box!.width * 0.5;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, startY, { steps: 10 });
    await page.mouse.up();

    await expect(drawer).not.toBeVisible();
  });

  test('closes drawer via Escape key', async ({ page }) => {
    await page.goto('/dashboard');

    const menuBtn = page.getByRole('button', { name: 'Abrir menú de navegación' });
    await menuBtn.click();

    const drawer = page.locator('#nav-drawer');
    await expect(drawer).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(drawer).not.toBeVisible();
  });

  test('closes drawer via backdrop tap', async ({ page }) => {
    await page.goto('/dashboard');

    const menuBtn = page.getByRole('button', { name: 'Abrir menú de navegación' });
    await menuBtn.click();

    const drawer = page.locator('#nav-drawer');
    await expect(drawer).toBeVisible();

    await page.locator('.drawer-overlay').click({ position: { x: 400, y: 300 } });

    await expect(drawer).not.toBeVisible();
  });

  test('closes drawer via nav item click', async ({ page }) => {
    await page.goto('/dashboard');

    const menuBtn = page.getByRole('button', { name: 'Abrir menú de navegación' });
    await menuBtn.click();

    const drawer = page.locator('#nav-drawer');
    await expect(drawer).toBeVisible();

    await page.getByText('Transacciones').click();

    await expect(drawer).not.toBeVisible();
    await expect(page).toHaveURL(/\/transactions/);
  });

  test('does not close drawer on small swipe', async ({ page }) => {
    await page.goto('/dashboard');

    const menuBtn = page.getByRole('button', { name: 'Abrir menú de navegación' });
    await menuBtn.click();

    const drawer = page.locator('#nav-drawer');
    await expect(drawer).toBeVisible();

    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();

    const startY = box!.y + box!.height / 2;
    const startX = box!.x + box!.width * 0.5;
    const endX = box!.x + box!.width * 0.3;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, startY, { steps: 5 });
    await page.mouse.up();

    await expect(drawer).toBeVisible();
  });

  test('menu button has correct aria-controls', async ({ page }) => {
    await page.goto('/dashboard');
    const menuBtn = page.getByRole('button', { name: 'Abrir menú de navegación' });
    await expect(menuBtn).toHaveAttribute('aria-controls', 'nav-drawer');
  });
});
