import { test, expect } from './fixtures';
import { swipeDrawerClose, swipeRowOpen } from './helpers/swipe';

async function waitForPageReady(page: import('@playwright/test').Page) {
  await page.locator('.app-header__menu-btn').waitFor({ state: 'visible', timeout: 15000 });
}

async function ensureDrawerClosed(page: import('@playwright/test').Page) {
  await page.waitForTimeout(300);
  const drawer = page.locator('#nav-drawer');
  const isVisible = await drawer.isVisible({ timeout: 1000 }).catch(() => false);
  if (isVisible) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

test.describe('HD-01.9 | Critical mobile flows smoke', () => {
  test.beforeEach(async ({ authenticatedPage: { page } }) => {
    await page.goto('/');
    await waitForPageReady(page);
    await ensureDrawerClosed(page);
  });

  test.describe('Drawer', () => {
    test('opens drawer via menu button', async ({ authenticatedPage: { page } }) => {
      await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
      await expect(page.locator('#nav-drawer')).toBeVisible({ timeout: 8000 });
    });

    test('closes drawer via swipe', async ({ authenticatedPage: { page } }) => {
      await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
      const drawer = page.locator('#nav-drawer');
      await expect(drawer).toBeVisible({ timeout: 8000 });
      await swipeDrawerClose(page, drawer);
      await expect(drawer).not.toBeVisible();
    });

    test('closes drawer via Escape', async ({ authenticatedPage: { page } }) => {
      await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
      const drawer = page.locator('#nav-drawer');
      await expect(drawer).toBeVisible({ timeout: 8000 });
      await drawer.locator('button').first().focus();
      await page.keyboard.press('Escape');
      await expect(drawer).not.toBeVisible();
    });

    test('closes drawer via backdrop tap', async ({ authenticatedPage: { page } }) => {
      await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
      const drawer = page.locator('#nav-drawer');
      await expect(drawer).toBeVisible({ timeout: 8000 });

      const viewport = page.viewportSize();
      const clickX = Math.floor((viewport?.width ?? 360) * 0.85);
      const clickY = Math.floor((viewport?.height ?? 640) * 0.5);
      await page.mouse.click(clickX, clickY);
      await expect(drawer).not.toBeVisible();
    });
  });

  test.describe('BottomNav', () => {
    test('navigates to Movimientos', async ({ authenticatedPage: { page } }) => {
      await page.locator('.bottom-nav').getByRole('button', { name: 'Movs', exact: true }).click();
      await expect(page).toHaveURL(/\/transactions/);
      await waitForPageReady(page);
    });

    test('navigates to Grupos', async ({ authenticatedPage: { page } }) => {
      await page.locator('.bottom-nav').getByRole('button', { name: 'Grupos', exact: true }).click();
      await expect(page).toHaveURL(/\/groups/, { timeout: 10000 });
      await waitForPageReady(page);
    });

    test('navigates back to Inicio', async ({ authenticatedPage: { page } }) => {
      await page.locator('.bottom-nav').getByRole('button', { name: 'Movs', exact: true }).click();
      await expect(page).toHaveURL(/\/transactions/, { timeout: 10000 });
      await waitForPageReady(page);
      const inicioBtn = page.locator('.bottom-nav').getByRole('button', { name: 'Inicio', exact: true });
      await inicioBtn.evaluate(el => (el as HTMLElement).click());
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
    });
  });

  test.describe('FAB', () => {
    test('visible on home route', async ({ authenticatedPage: { page } }) => {
      await expect(page.locator('.fab__button')).toBeVisible();
    });

    test('hidden on profile route', async ({ authenticatedPage: { page } }) => {
      await page.goto('/profile');
      await waitForPageReady(page);
      await expect(page.locator('.fab__button')).not.toBeVisible();
    });

    test('opens speed dial and shows actions', async ({ authenticatedPage: { page } }) => {
      await expect(page.locator('.fab__button')).toBeVisible();
      await page.locator('.fab__button').click();
      await expect(page.locator('.fab-actions')).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('menuitem', { name: 'Crear nuevo movimiento personal' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Registrar gasto compartido en un grupo' })).toBeVisible();
    });

    test('closes speed dial on outside tap', async ({ authenticatedPage: { page } }) => {
      await page.locator('.fab__button').click();
      await expect(page.locator('.fab-actions')).toBeVisible();
      await page.locator('.app-header').click();
      await expect(page.locator('.fab-actions')).not.toBeVisible();
    });
  });

  test.describe('Swipe transacciones', () => {
    test('swipe reveals edit and delete', async ({ authenticatedPage: { page } }) => {
      await page.goto('/transactions');
      await waitForPageReady(page);
      const firstRow = page.locator('.swipeable-row').first();
      await expect(firstRow).toBeVisible();
      await swipeRowOpen(page, firstRow);
      await expect(page.getByRole('button', { name: 'Editar movimiento' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Eliminar movimiento' })).toBeVisible();
    });

    test('edit button opens edit modal', async ({ authenticatedPage: { page } }) => {
      await page.goto('/transactions');
      await waitForPageReady(page);
      const firstRow = page.locator('.swipeable-row').first();
      await swipeRowOpen(page, firstRow);
      const editBtn = page.getByRole('button', { name: 'Editar movimiento' });
      await editBtn.evaluate(el => (el as HTMLElement).click());
      await expect(page.getByText('Editar movimiento')).toBeVisible();
    });

    test('delete button opens confirmation', async ({ authenticatedPage: { page } }) => {
      await page.goto('/transactions');
      await waitForPageReady(page);
      const firstRow = page.locator('.swipeable-row').first();
      await swipeRowOpen(page, firstRow);
      const deleteBtn = page.getByRole('button', { name: 'Eliminar movimiento' });
      await deleteBtn.evaluate(el => (el as HTMLElement).click());
      await expect(page.getByText('Eliminar movimiento')).toBeVisible();
    });
  });

  test.describe('Toast feedback', () => {
    test('toast appears after creating transaction', async ({ authenticatedPage: { page } }) => {
      await page.locator('.fab__button').click();
      await page.getByRole('menuitem', { name: 'Crear nuevo movimiento personal' }).click();
      await expect(page.getByText('Nuevo movimiento')).toBeVisible();
      await page.getByLabel('Monto').fill('10.00');
      await page.keyboard.press('Enter');
      await expect(page.locator('.toast--success')).toBeVisible({ timeout: 10000 });
    });

    test('toast can be dismissed', async ({ authenticatedPage: { page } }) => {
      await page.locator('.fab__button').click();
      await page.getByRole('menuitem', { name: 'Crear nuevo movimiento personal' }).click();
      await page.getByLabel('Monto').fill('5.00');
      await page.keyboard.press('Enter');
      await expect(page.locator('.toast--success')).toBeVisible({ timeout: 10000 });
      const closeBtn = page.locator('.toast__close').first();
      await closeBtn.evaluate(el => (el as HTMLElement).click());
      await expect(page.locator('.toast--success')).not.toBeVisible({ timeout: 5000 });
    });

    test('toast appears after editing transaction', async ({ authenticatedPage: { page } }) => {
      await page.goto('/transactions');
      await waitForPageReady(page);
      const firstRow = page.locator('.swipeable-row').first();
      await swipeRowOpen(page, firstRow);
      const editBtn = page.getByRole('button', { name: 'Editar movimiento' });
      await editBtn.evaluate(el => (el as HTMLElement).click());
      await expect(page.getByText('Editar movimiento')).toBeVisible();
      await page.getByLabel('Monto').fill('99.99');
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(page.locator('.toast--success')).toBeVisible({ timeout: 10000 });
    });

    test('toast appears after deleting transaction', async ({ authenticatedPage: { page } }) => {
      await page.goto('/transactions');
      await waitForPageReady(page);
      const firstRow = page.locator('.swipeable-row').first();
      await swipeRowOpen(page, firstRow);
      const deleteBtn = page.getByRole('button', { name: 'Eliminar movimiento' });
      await deleteBtn.evaluate(el => (el as HTMLElement).click());
      await expect(page.getByText('Eliminar movimiento')).toBeVisible();
      await page.getByRole('button', { name: 'Eliminar' }).click();
      await expect(page.locator('.toast--success')).toBeVisible({ timeout: 10000 });
    });

    test('error toast appears on API failure', async ({ authenticatedPage: { page } }) => {
      await page.route('**/api/v1/transactions', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Error interno del servidor' } }),
        });
      });

      await page.locator('.fab__button').click();
      await page.getByRole('menuitem', { name: 'Crear nuevo movimiento personal' }).click();
      await expect(page.getByText('Nuevo movimiento')).toBeVisible();
      await page.getByLabel('Monto').fill('10.00');
      await page.keyboard.press('Enter');
      await expect(page.locator('.toast--error')).toBeVisible({ timeout: 10000 });

      await page.unroute('**/api/v1/transactions');
    });
  });
});
