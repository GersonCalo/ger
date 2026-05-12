import { test, expect } from './fixtures';
import { swipeDrawerClose } from './helpers/swipe';

async function waitForPageReady(page: import('@playwright/test').Page) {
  await page.locator('.app-header__menu-btn').waitFor({ state: 'visible', timeout: 15000 });
}

async function openDrawer(page: import('@playwright/test').Page) {
  await page.goto('/');
  await waitForPageReady(page);
  
  // Ensure drawer is closed first
  const drawer = page.locator('#nav-drawer');
  const isOpen = await drawer.isVisible({ timeout: 1000 }).catch(() => false);
  if (isOpen) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  
  // Now open the drawer with retry
  const menuBtn = page.getByRole('button', { name: 'Abrir menú de navegación' });
  await menuBtn.click();
  
  // Wait for drawer with a short timeout, retry click if needed
  const visible = await drawer.isVisible({ timeout: 3000 }).catch(() => false);
  if (!visible) {
    await menuBtn.click();
    await expect(drawer).toBeVisible({ timeout: 5000 });
  }
}

test.describe('Drawer swipe gesture', () => {
  test('opens drawer via menu button and closes with swipe on mobile', async ({ authenticatedPage: { page } }) => {
    await openDrawer(page);
    const drawer = page.locator('#nav-drawer');
    await swipeDrawerClose(page, drawer);
    await expect(drawer).not.toBeVisible();
  });

  test('closes drawer via Escape key', async ({ authenticatedPage: { page } }) => {
    await openDrawer(page);
    const drawer = page.locator('#nav-drawer');
    await drawer.locator('button').first().focus();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  test('closes drawer via backdrop tap', async ({ authenticatedPage: { page } }) => {
    await openDrawer(page);
    const drawer = page.locator('#nav-drawer');
    const viewport = page.viewportSize();
    const clickX = Math.floor((viewport?.width ?? 360) * 0.85);
    const clickY = Math.floor((viewport?.height ?? 640) * 0.5);
    await page.mouse.click(clickX, clickY);
    await expect(drawer).not.toBeVisible();
  });

  test('closes drawer via nav item click', async ({ authenticatedPage: { page } }) => {
    await openDrawer(page);
    const drawer = page.locator('#nav-drawer');
    
    // Click any nav item to close the drawer
    const navItem = drawer.locator('.drawer-nav__item').first();
    await navItem.evaluate(el => (el as HTMLElement).click());
    
    // Drawer should be closed
    await expect(drawer).not.toBeVisible({ timeout: 5000 });
  });

  test('does not close drawer on small swipe', async ({ authenticatedPage: { page } }) => {
    await openDrawer(page);
    const drawer = page.locator('#nav-drawer');
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

  test('menu button has correct aria-controls', async ({ authenticatedPage: { page } }) => {
    await page.goto('/');
    await waitForPageReady(page);
    const menuBtn = page.getByRole('button', { name: 'Abrir menú de navegación' });
    await expect(menuBtn).toHaveAttribute('aria-controls', 'nav-drawer');
  });
});
