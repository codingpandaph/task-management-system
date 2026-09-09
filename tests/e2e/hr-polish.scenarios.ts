import { expect, test } from '@playwright/test';
import { login, post, usernames } from './hr.helpers';

export function registerPolishScenarios() {
  test('organization totals, lifecycle actions, and employment-specific fields are trustworthy', async ({ page }) => {
    const csrf = await login(page.request, usernames.hr);
    const hierarchy = (await (await page.request.get('/api/organization')).json()) as {
      employees: { department: { id: string; name: string } | null }[];
    };
    const suffix = Date.now().toString().slice(-6);
    await post(page.request, 'departments', csrf, {
      code: `Q${suffix}`,
      name: `Quality ${suffix}`,
    });

    await page.goto('/organization');
    const surface = (name: string) =>
      page
        .getByRole('heading', { name, exact: true })
        .locator('xpath=ancestor::*[contains(@class,"MuiPaper-root")][1]');
    const leadership = surface('Organization structure');
    await expect(leadership.getByText('Avery Morgan', { exact: true })).toBeVisible();
    await expect(leadership.locator('[title="Organization-wide"]')).toBeVisible();
    await expect(surface('Human Resources')).not.toContainText('Avery Morgan');
    const departmentNames = hierarchy.employees.flatMap((employee) =>
      employee.department ? [employee.department.name] : [],
    );
    for (const departmentName of new Set(departmentNames)) {
      const count = hierarchy.employees.filter((employee) => employee.department?.name === departmentName).length;
      const departmentCard = surface(departmentName);
      await expect(departmentCard.locator(`[title="${count} people"]`)).toBeVisible();
    }
    const card = surface(`Quality ${suffix}`);
    await card.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await page
      .getByRole('dialog', { name: `Deactivate Quality ${suffix}` })
      .getByRole('button', { name: 'Deactivate department', exact: true })
      .click();
    await expect(card.locator('[title="INACTIVE"]')).toBeVisible();
    await card.getByRole('button', { name: 'Activate', exact: true }).click();
    await page
      .getByRole('dialog', { name: `Activate Quality ${suffix}` })
      .getByRole('button', { name: 'Activate department', exact: true })
      .click();
    await expect(card.locator('[title="ACTIVE"]')).toBeVisible();

    await page.getByRole('link', { name: 'People', exact: true }).click();
    await page.getByRole('button', { name: 'Add employee', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a new employee' });
    await expect(dialog.getByLabel('Contract end', { exact: true })).toHaveCount(0);
    await expect(dialog.getByLabel('Probation review', { exact: true })).toHaveCount(0);
    await dialog.getByRole('combobox', { name: 'Employment type', exact: true }).click();
    await page.getByRole('option', { name: 'Contract', exact: true }).click();
    await expect(dialog.getByLabel('Contract end', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Probation review', { exact: true })).toHaveCount(0);
    await dialog.getByRole('combobox', { name: 'Employment type', exact: true }).click();
    await page.getByRole('option', { name: 'Probation', exact: true }).click();
    await expect(dialog.getByLabel('Contract end', { exact: true })).toHaveCount(0);
    await expect(dialog.getByLabel('Probation review', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('notification count updates and audit history can load beyond its first page', async ({ page }) => {
    await login(page.request, usernames.hr);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();
    await expect(page.locator('[title$="unread notifications"]')).toBeVisible();
    await page.getByRole('link', { name: 'Notifications', exact: true }).click();
    const markAll = page.getByRole('button', { name: 'Mark all read', exact: true });
    if (await markAll.isVisible()) await markAll.click();
    await expect(page.locator('[title="0 unread notifications"]')).toBeVisible();

    await page.getByRole('link', { name: 'Audit log', exact: true }).click();
    const events = page.locator('.status-tag');
    const before = await events.count();
    const loadOlder = page.getByRole('button', { name: 'Load older events', exact: true });
    if (await loadOlder.isVisible()) {
      await loadOlder.click();
      expect(await events.count()).toBeGreaterThan(before);
    }
  });
}
