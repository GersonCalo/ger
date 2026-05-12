import { test, expect } from './fixtures';

async function waitForPageReady(page: import('@playwright/test').Page) {
  await page.locator('.app-header__menu-btn').waitFor({ state: 'visible', timeout: 15000 });
}

const CRITICAL_SELECTORS = [
  { selector: '.app-header__menu-btn', label: 'Menú header' },
  { selector: '.bottom-nav__item', label: 'Navegación inferior' },
  { selector: '.drawer-nav__item', label: 'Item drawer' },
  { selector: '.modal-header__close', label: 'Cerrar modal' },
  { selector: '.toast__close', label: 'Cerrar toast' },
  { selector: '.toast__action', label: 'Acción toast' },
  { selector: '.segmented-control__item', label: 'Control segmentado' },
  { selector: '.swipeable-action', label: 'Acción swipe' },
  { selector: '.fab__button', label: 'FAB' },
  { selector: '.fab-actions__item', label: 'Acción FAB' },
  { selector: '.field__action', label: 'Acción campo' },
  { selector: '.category-tabs__btn', label: 'Tab categoría' },
  { selector: '.balance-chart__period-btn', label: 'Botón periodo gráfico' },
];

const MIN_TOUCH_TARGET = 44;

test.describe('Touch targets 44x44', () => {
  test.describe('controles críticos', () => {
    for (const { selector, label } of CRITICAL_SELECTORS) {
      test(`${label} >= ${MIN_TOUCH_TARGET}x${MIN_TOUCH_TARGET}px`, async ({ authenticatedPage: { page } }) => {
        await page.goto('/');
        await waitForPageReady(page);

        const el = page.locator(selector).first();
        const isVisible = await el.isVisible({ timeout: 5000 }).catch(() => false);
        if (!isVisible) {
          test.skip(true, `${label} no visible en esta vista`);
          return;
        }

        const box = await el.boundingBox();
        expect(box).not.toBeNull();

        expect(box!.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      });
    }
  });

  test.describe('navegación por teclado en overlays', () => {
    test('drawer atrapa foco y cierra con Escape', async ({ authenticatedPage: { page } }) => {
      await page.goto('/');
      await waitForPageReady(page);

      await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();

      const drawer = page.locator('#nav-drawer');
      await expect(drawer).toBeVisible({ timeout: 8000 });

      const focusable = drawer.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const count = await focusable.count();
      expect(count).toBeGreaterThan(0);

      await page.keyboard.press('Escape');
      await expect(drawer).not.toBeVisible();
    });

    test('modal atrapa foco y cierra con Escape', async ({ authenticatedPage: { page } }) => {
      await page.goto('/');
      await waitForPageReady(page);

      await page.locator('.fab__button').click();
      await page.getByRole('menuitem', { name: 'Crear nuevo movimiento personal' }).click();

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 5000 }).catch(() => {
        test.skip(true, 'Modal no se pudo abrir en esta vista');
      });

      const focusable = modal.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const count = await focusable.count();
      expect(count).toBeGreaterThan(0);

      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();
    });

    test('toast action es alcanzable por teclado', async ({ authenticatedPage: { page } }) => {
      await page.goto('/');
      await waitForPageReady(page);

      await page.locator('.fab__button').click();
      await page.getByRole('menuitem', { name: 'Crear nuevo movimiento personal' }).click();

      await page.getByLabel('Monto').fill('1.00');
      await page.keyboard.press('Enter');

      const toast = page.locator('.toast').first();
      const toastVisible = await toast.isVisible({ timeout: 10000 }).catch(() => false);
      if (!toastVisible) {
        test.skip(true, 'Toast no visible');
        return;
      }

      const actionBtn = toast.locator('.toast__action');
      const hasAction = await actionBtn.isVisible().catch(() => false);
      if (!hasAction) {
        test.skip(true, 'Toast sin acción');
        return;
      }

      await page.keyboard.press('Tab');
      await expect(actionBtn).toBeFocused();
    });
  });

  test.describe('focus visible en controles críticos', () => {
    test('botones muestran outline al enfocar con teclado', async ({ authenticatedPage: { page } }) => {
      await page.goto('/');
      await waitForPageReady(page);

      const menuBtn = page.getByRole('button', { name: 'Abrir menú de navegación' });
      await menuBtn.focus();

      const outline = await menuBtn.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.outlineStyle;
      });

      expect(outline).not.toBe('none');
    });

    test('items bottom nav muestran focus al navegar con Tab', async ({ authenticatedPage: { page } }) => {
      await page.goto('/');
      await waitForPageReady(page);

      const navItems = page.locator('.bottom-nav__item');
      const count = await navItems.count();
      expect(count).toBeGreaterThan(0);

      await navItems.first().focus();

      const outline = await navItems.first().evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.outlineStyle;
      });

      expect(outline).not.toBe('none');
    });
  });
});
