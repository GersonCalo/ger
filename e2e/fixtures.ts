import { test as base, expect } from '@playwright/test';

const AUTH_TOKEN_KEY = 'fi_auth_token_v1';
const API_BASE = process.env.E2E_API_URL || 'http://localhost:8080/api/v1';

export type TestFixtures = {
  authenticatedPage: {
    page: import('@playwright/test').Page;
    token: string;
    email: string;
  };
};

function uniqueEmail() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `e2e-${ts}-${rand}@test.local`;
}

const PASSWORD = 'TestPass123!';

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page, context }, use) => {
    const email = uniqueEmail();

    const registerRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, name: 'E2E User' }),
    });

    if (!registerRes.ok) {
      const body = await registerRes.text();
      throw new Error(`E2E register failed: ${registerRes.status} ${body}`);
    }

    const { token } = await registerRes.json();

    const createTxRes = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'expense',
        amount: 25.5,
        note: 'Compra E2E',
        occurredAt: new Date().toISOString(),
      }),
    });

    if (!createTxRes.ok) {
      const body = await createTxRes.text();
      throw new Error(`E2E seed transaction failed: ${createTxRes.status} ${body}`);
    }

    await context.addInitScript(({ key, t }) => {
      localStorage.setItem(key, t);
    }, { key: AUTH_TOKEN_KEY, t: token });

    await page.goto('/');

    await page.locator('.app-header__menu-btn').waitFor({ state: 'visible', timeout: 15000 });

    await use({ page, token, email });
  },
});

export { expect };
