import { expect, test } from '@playwright/test';
import { login, usernames } from './hr.helpers';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  test(`Organization visual baseline · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page.request, usernames.managing);
    await page.goto('/organization');
    await expect(page.getByRole('heading', { name: 'Departments and leadership' })).toBeVisible();
    await page.getByLabel('Search departments').fill('Human Resources');
    await expect(page).toHaveScreenshot(`organization-${viewport.name}.png`, {
      animations: 'disabled',
      fullPage: true,
      mask: [page.getByText(/active people across/)],
      maxDiffPixels: 100,
    });
  });

  test(`Team boards visual baseline · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page.request, usernames.marketingDirector);
    await page.goto('/workspaces');
    await expect(page.getByRole('combobox', { name: 'Board', exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`team-boards-${viewport.name}.png`, {
      animations: 'disabled',
      fullPage: true,
    });
  });
}
