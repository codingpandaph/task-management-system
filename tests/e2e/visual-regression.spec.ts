import { expect, test } from '@playwright/test';
import { login, usernames } from './hr.helpers';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  test(`Organization visual baseline · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page.request, usernames.senior);
    await page.goto('/organization');
    await expect(page.getByRole('heading', { name: 'Departments and leadership' })).toBeVisible();
    await expect(page).toHaveScreenshot(`organization-${viewport.name}.png`, {
      animations: 'disabled',
      fullPage: true,
    });
  });

  test(`Team boards visual baseline · ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page.request, usernames.director);
    await page.goto('/workspaces');
    await expect(page.getByRole('combobox', { name: 'Board', exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`team-boards-${viewport.name}.png`, {
      animations: 'disabled',
      fullPage: true,
    });
  });
}
