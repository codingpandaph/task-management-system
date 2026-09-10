import { registerAccessFeedbackScenarios } from './ui-feedback-access.scenarios';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login, select, usernames } from './hr.helpers';

const widths = [375, 599, 600, 601, 768, 899, 900, 901, 1199, 1200, 1201, 1440, 1535, 1536, 1537];

registerAccessFeedbackScenarios();

test('department checkboxes, policy actions, and Scrum dates follow the current context', async ({ page }) => {
  await login(page.request, usernames.senior);
  await page.goto('/organization');
  await page.getByRole('button', { name: 'Create department', exact: true }).click();
  const department = page.getByRole('dialog');
  await expect(department.getByRole('checkbox', { name: 'Kanban', exact: true })).toBeChecked();
  await department.getByRole('checkbox', { name: 'Select all', exact: true }).check();
  for (const label of ['Kanban', 'Scrum', 'List'])
    await expect(department.getByRole('checkbox', { name: label, exact: true })).toBeChecked();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await expect(department.getByRole('checkbox', { name: 'Select all', exact: true })).toBeVisible();
    expect(await department.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await department.getByRole('checkbox', { name: 'Kanban', exact: true }).uncheck();
  await expect(department.getByLabel('Kanban: maximum in progress tasks per member')).toHaveCount(0);
  await department.getByRole('checkbox', { name: 'Select all', exact: true }).check();
  await department.getByRole('checkbox', { name: 'Select all', exact: true }).uncheck();
  await department.getByLabel('Department code').fill('UIFIX');
  await department.getByLabel('Department name').fill('UI feedback department');
  await department.getByRole('button', { name: 'Create department', exact: true }).click();
  await expect(department.getByRole('alert')).toContainText('Select at least one');
  await department.getByRole('checkbox', { name: 'List', exact: true }).check();
  await department.getByRole('button', { name: 'Create department', exact: true }).click();
  await expect(department).toBeHidden();
  await expect(page.getByRole('heading', { name: 'UI feedback department' })).toBeVisible();
  await page.goto('/policies');
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create leave policy' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('tab', { name: /Christmas/ }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create Christmas policy' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/workspaces');
  await expect(page.getByRole('button', { name: 'New milestone', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create board', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Board name').fill('UI Scrum');
  await select(page, 'Board type', 'Scrum');
  await expect(page.getByRole('dialog', { name: 'Create sprint board' })).toBeVisible();
  await page.getByRole('dialog').getByLabel('Sprint name').fill('UI Scrum');
  await page.getByRole('dialog').getByLabel('Sprint goal').fill('Ship the UI feedback work');
  const sprintDialog = page.getByRole('dialog', { name: 'Create sprint board' });
  const startDate = sprintDialog.locator('input[name="milestoneStartDate"]');
  const dueDate = sprintDialog.locator('input[name="milestoneDueDate"]');
  await expect(startDate).toHaveAttribute('type', 'date');
  await expect(dueDate).toHaveAttribute('type', 'date');
  await startDate.fill('2026-09-01');
  await dueDate.fill('2026-09-30');
  await page.getByRole('dialog').getByRole('button', { name: 'Create sprint board' }).click();
  await select(page, 'Board', 'Sprint · UI Scrum');
  await expect(page.getByRole('heading', { name: 'UI Scrum' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New milestone', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Board', exact: true })).toContainText(
    'UI Scrum',
  );
  await expect(page.getByRole('dialog').getByText('Milestone: UI Scrum')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Milestone', exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'View capacity' }).click();
  await page
    .getByRole('dialog', { name: 'Milestone capacity' })
    .getByRole('button', { name: 'Complete sprint' })
    .click();
  await expect(page.getByText('Completing the sprint closes its milestone')).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Complete this sprint?' })
    .getByRole('button', { name: 'Complete sprint' })
    .click();
  await expect(page.getByText('This sprint is complete. Its board is read-only.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create task', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Past sprints' }).click();
  await expect(page.getByRole('dialog', { name: 'Past sprints' }).getByText('UI Scrum')).toBeVisible();
});

test('My tasks and People sort real records with accessible column state', async ({ page }) => {
  await login(page.request, usernames.member);
  await page.goto('/tasks');
  const table = page.getByRole('table', { name: 'My tasks', exact: true });
  await expect(table).toBeVisible();
  await table.getByRole('button', { name: 'Task', exact: true }).click();
  await expect(table.getByRole('columnheader', { name: 'Task', exact: true })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  const ascending = await table.locator('tbody tr td:first-child').allTextContents();
  await table.getByRole('button', { name: 'Task', exact: true }).press('Enter');
  await expect(table.getByRole('columnheader', { name: 'Task', exact: true })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  expect(await table.locator('tbody tr td:first-child').allTextContents()).toEqual([...ascending].reverse());
  await login(page.request, usernames.senior);
  await page.goto('/employees');
  await expect(page.locator('tbody tr')).not.toHaveCount(0);
  const response = page.waitForResponse(
    (r) => r.url().includes('sortDirection=desc') && r.url().includes('/api/employees'),
  );
  await page.getByRole('button', { name: 'Name', exact: true }).click();
  await response;
  await expect(page.getByRole('columnheader', { name: 'Name', exact: true })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  const names = await page.locator('tbody tr td:first-child a').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
});

test('affected pages fit mobile, tablet, desktop and breakpoint boundaries', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await login(page.request, usernames.senior);
  for (const route of ['/organization', '/policies', '/employees', '/workspaces', '/calendar']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} at ${width}px`,
      ).toBe(true);
      if (width === 375 || width === 1440)
        await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-${width}.png`), fullPage: true });
    }
    if (route === '/organization' || route === '/workspaces')
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
  await login(page.request, usernames.member);
  for (const route of ['/tasks', '/department']) {
    await page.goto(route);
    await expect(page.getByRole('status')).toHaveCount(0);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} at ${width}px`,
      ).toBe(true);
      if (width === 375 || width === 1440)
        await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-${width}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});
