import { expect, type Locator, type Page } from '@playwright/test';

export const demoPassword = 'Demo only password 2026!';
export const demoYear = new Date().getFullYear();

export async function demoSignIn(page: Page, employeeId: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Employee ID', { exact: true }).fill(employeeId);
  await page.getByLabel('Password', { exact: true }).fill(demoPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}

export async function demoChoose(page: Page, scope: Locator, label: string, option: string | RegExp) {
  await scope.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
}

export async function announce(page: Page, title: string, detail: string) {
  if (!process.env.PLAYWRIGHT_DEMO) return;
  await page.evaluate(
    ({ heading, copy }) => {
      document.querySelector('[data-demo-guide]')?.remove();
      const guide = document.createElement('aside');
      guide.dataset.demoGuide = 'true';
      guide.setAttribute('aria-label', 'Demo guide');
      guide.style.cssText =
        'position:fixed;z-index:2147483647;right:24px;bottom:24px;width:min(420px,calc(100vw - 48px));' +
        'padding:18px 20px;border-radius:14px;background:#10261f;color:#fff;box-shadow:0 18px 60px #0005;' +
        'font:16px/1.45 system-ui,sans-serif;border:1px solid #ffffff33;pointer-events:none';
      guide.innerHTML = `<strong style="display:block;font-size:19px;margin-bottom:5px">${heading}</strong><span>${copy}</span>`;
      document.body.append(guide);
    },
    { heading: title, copy: detail },
  );
  await page.waitForTimeout(Number(process.env.DEMO_STEP_MS ?? 1800));
}
