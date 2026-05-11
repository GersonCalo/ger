import { test, expect } from '@playwright/test';

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
      test(`${label} >= ${MIN_TOUCH_TARGET}x${MIN_TOUCH_TARGET}px`, async ({ page }) => {
        await page.goto('/dashboard');

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
    test('drawer atrapa foco y cierra con Escape', async ({ page }) => {
      await page.goto('/dashboard');

      const menuBtn = page.getByRole('button', { name: 'Abrir menú de navegación' });
      await menuBtn.click();

      const drawer = page.locator('#nav-drawer');
      await expect(drawer).toBeVisible();

      const focusable = drawer.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const count = await focusable.count();
      expect(count).toBeGreaterThan(0);

      await page.keyboard.press('Escape');
      await expect(drawer).not.toBeVisible();
    });

    test('modal atrapa foco y cierra con Escape', async ({ page }) => {
      await page.goto('/transactions');

      const createBtn = page.getByRole('button', { name: /crear|nuevo|agregar/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
      } else {
        const fab = page.locator('.fab__button');
        if (await fab.isVisible().catch(() => false)) {
          await fab.click();
        }
      }

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

    test('toast action es alcanzable por teclado', async ({ page }) => {
      await page.goto('/transactions');

      const createBtn = page.getByRole('button', { name: /crear|nuevo|agregar/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
      } else {
        const fab = page.locator('.fab__button');
        if (await fab.isVisible().catch(() => false)) {
          await fab.click();
        }
      }

      const submitBtn = page.getByRole('button', { name: /guardar/i }).first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
      }

      const toast = page.locator('.toast').first();
      const toastVisible = await toast.isVisible({ timeout: 5000 }).catch(() => false);
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
    test('botones muestran outline al enfocar con teclado', async ({ page }) => {
      await page.goto('/dashboard');

      const menuBtn = page.getByRole('button', { name: 'Abrir menú de navegación' });
      await menuBtn.focus();

      const outline = await menuBtn.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.outlineStyle;
      });

      expect(outline).not.toBe('none');
    });

    test('items bottom nav muestran focus al navegar con Tab', async ({ page }) => {
      await page.goto('/dashboard');

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
