import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const year = new Date().getFullYear();

test('critical HRIS navigation is accessible and responsive', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page).toHaveScreenshot('login.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 });

  const loginAccessibility = await new AxeBuilder({ page }).analyze();
  expect(loginAccessibility.violations).toEqual([]);

  await page.getByLabel('Employee ID', { exact: true }).fill(`${year}-HR-000004`);
  await page.getByLabel('Password', { exact: true }).fill('Demo only password 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
  await page.getByLabel('Search people', { exact: true }).fill('Taylor');
  await expect(page.getByRole('link', { name: 'Taylor Quinn', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('people.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 });

  for (const width of [375, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  const authenticatedAccessibility = await new AxeBuilder({ page }).analyze();
  expect(authenticatedAccessibility.violations, `${browserName} accessibility violations`).toEqual([]);
});
