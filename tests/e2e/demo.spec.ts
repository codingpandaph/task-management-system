import { expect, test, type Locator, type Page } from '@playwright/test';

const demoDelay = Number(process.env.DEMO_SLOWMO_MS ?? 900);
test.use({ launchOptions: { slowMo: process.env.PLAYWRIGHT_DEMO ? demoDelay : 0 } });

const year = new Date().getFullYear();
const demoPassword = 'Demo only password 2026!';

async function signIn(page: Page, employeeId: string) {
  await page.goto('/login');
  await page.getByLabel('Employee ID', { exact: true }).fill(employeeId);
  await page.getByLabel('Password', { exact: true }).fill(demoPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}

async function choose(page: Page, scope: Locator, label: string, option: string | RegExp) {
  await scope.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
}

test('complete CPSync HRIS demonstration', async ({ page }) => {
  test.setTimeout(process.env.PLAYWRIGHT_DEMO ? 240_000 : 90_000);
  const suffix = Date.now().toString().slice(-6);
  const leavePolicy = `Demo leave ${suffix}`;
  const christmasPolicy = `Demo Christmas ${suffix}`;
  const department = `Demo Operations ${suffix}`;

  await test.step('run starts from the limited deterministic seed', async () => {
    await signIn(page, `${year}-HR-000004`);
    const employees = (await (await page.request.get('/api/employees?pageSize=100')).json()) as { total: number };
    const policies = (await (await page.request.get('/api/policies')).json()) as {
      leave: unknown[];
      christmas: unknown[];
    };
    expect(employees.total).toBe(7);
    expect(policies.leave).toHaveLength(1);
    expect(policies.christmas).toHaveLength(1);
    if (process.env.PLAYWRIGHT_DEMO) await page.waitForTimeout(1_500);
  });

  await test.step('HR creates regular and Christmas policies', async () => {
    await page.getByRole('link', { name: 'Policies', exact: true }).click();

    await page.getByRole('button', { name: 'Create leave policy', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Create leave policy' });
    await dialog.getByLabel('Policy name', { exact: true }).fill(leavePolicy);
    await dialog.getByLabel('Vacation days', { exact: true }).fill('28');
    await dialog.getByLabel('Sick days', { exact: true }).fill('7');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(dialog).toBeHidden();
    if (process.env.PLAYWRIGHT_DEMO) await page.waitForTimeout(1_500);

    await page.getByRole('button', { name: 'Create Christmas policy', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Create Christmas policy' });
    await dialog.getByLabel('Policy name', { exact: true }).fill(christmasPolicy);
    await dialog.getByLabel('Days', { exact: true }).fill('6');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step('HR creates a department and employee', async () => {
    await page.getByRole('link', { name: 'Organization', exact: true }).click();
    await page.getByRole('button', { name: 'Create department', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Create a department' });
    await dialog.getByLabel('Department code', { exact: true }).fill(`D${suffix}`);
    await dialog.getByLabel('Department name', { exact: true }).fill(department);
    await dialog.getByRole('button', { name: 'Create department', exact: true }).click();
    await expect(page.getByRole('heading', { name: department, exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'People', exact: true }).click();
    await page.getByRole('button', { name: 'Add employee', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Add a new employee' });
    await dialog.getByLabel('First name', { exact: true }).fill('Demo');
    await dialog.getByLabel('Last name', { exact: true }).fill(`Employee ${suffix}`);
    await dialog.getByLabel('Birth date', { exact: true }).fill('1994-05-12');
    await choose(page, dialog, 'Department', department);
    await choose(page, dialog, 'Employment type', 'Permanent');
    await dialog.getByLabel('Employment start', { exact: true }).fill(`${year}-01-01`);
    await dialog.getByRole('combobox', { name: 'Leave policy', exact: true }).click();
    await page.getByRole('option').filter({ hasText: leavePolicy }).click();
    await dialog.getByRole('combobox', { name: 'Christmas policy', exact: true }).click();
    await page.getByRole('option').filter({ hasText: christmasPolicy }).click();
    await dialog.getByRole('button', { name: 'Create employee', exact: true }).click();
    const credentialDialog = page.getByRole('dialog', { name: 'One-time temporary password' });
    await expect(credentialDialog).toBeVisible();
    await credentialDialog.getByRole('button', { name: 'Close and clear password', exact: true }).click();
    if (process.env.PLAYWRIGHT_DEMO) await page.waitForTimeout(1_500);
  });

  await test.step('Senior Director files and cancels auto-approved leave', async () => {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByLabel('Employee ID', { exact: true }).fill(`${year}-ORG-000001`);
    await page.getByLabel('Password', { exact: true }).fill(demoPassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('link', { name: 'My leave', exact: true }).click();

    const existing = (await (await page.request.get('/api/leave/requests?pageSize=100')).json()) as {
      items: { startDate: string; endDate: string; status: string }[];
    };
    let leaveDay = `${year}-10-01`;
    for (let day = 1; day <= 30; day += 1) {
      const candidate = `${year}-10-${String(day).padStart(2, '0')}`;
      const weekday = new Date(`${candidate}T12:00:00Z`).getUTCDay();
      const occupied = existing.items.some(
        (request) =>
          ['PENDING', 'APPROVED'].includes(request.status) &&
          request.startDate.slice(0, 10) <= candidate &&
          request.endDate.slice(0, 10) >= candidate,
      );
      if (weekday > 0 && weekday < 6 && !occupied) {
        leaveDay = candidate;
        break;
      }
    }

    await page.getByRole('button', { name: 'File leave', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'File a leave request' });
    await choose(page, dialog, 'Leave type', 'Vacation');
    await dialog.getByLabel('Start date', { exact: true }).fill(leaveDay);
    await dialog.getByLabel('End date', { exact: true }).fill(leaveDay);
    await dialog.getByLabel('Reason (optional; no medical diagnosis)', { exact: true }).fill('Year-end break');
    await dialog.getByRole('button', { name: 'Submit for approval', exact: true }).click();
    await expect(dialog).toBeHidden();

    const requestLink = page.locator('a').filter({ hasText: leaveDay }).first();
    await expect(requestLink).toBeVisible();
    await requestLink.click();
    await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Request cancellation', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Request leave cancellation' });
    await dialog.getByLabel('Cancellation reason', { exact: true }).fill('Plans changed');
    await dialog.getByRole('button', { name: 'Request cancellation', exact: true }).click();
    await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
    if (process.env.PLAYWRIGHT_DEMO) await page.waitForTimeout(1_500);
  });

  await test.step('HR reviews the operational HRIS workspace', async () => {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await signIn(page, `${year}-HR-000004`);

    await page.getByRole('link', { name: 'People', exact: true }).click();
    await page.getByLabel('Search people', { exact: true }).fill(`Demo Employee ${suffix}`);
    await page.getByRole('link', { name: `Demo Employee ${suffix}`, exact: true }).click();
    await page.getByRole('tab', { name: 'Employment', exact: true }).click();
    await expect(page.getByRole('table', { name: 'Employment history' })).toBeVisible();
    await page.getByRole('tab', { name: 'Leave policies', exact: true }).click();
    await page.getByRole('tab', { name: 'Access & security', exact: true }).click();
    if (process.env.PLAYWRIGHT_DEMO) await page.waitForTimeout(1_500);

    await page.getByRole('link', { name: 'Policies', exact: true }).click();
    await page.getByLabel('Search leave policies', { exact: true }).fill(leavePolicy);
    await expect(page.getByText(leavePolicy, { exact: false })).toBeVisible();
    await page.getByRole('tab', { name: /Christmas/ }).click();
    await page.getByLabel('Search Christmas policies', { exact: true }).fill(christmasPolicy);
    await expect(page.getByText(christmasPolicy, { exact: false })).toBeVisible();

    for (const destination of ['Approvals', 'Who’s out']) {
      await page.getByRole('link', { name: destination, exact: true }).click();
      await expect(page.locator('h1')).toBeVisible();
      if (process.env.PLAYWRIGHT_DEMO) await page.waitForTimeout(1_200);
    }

    await page.getByRole('link', { name: 'Leave administration', exact: true }).click();
    await page.getByRole('button', { name: 'Add administrative leave', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Administrative leave entry' });
    await choose(page, dialog, 'Employee', 'Morgan Reed');
    await choose(page, dialog, 'Leave type', 'Vacation');
    await dialog.getByLabel('Start date', { exact: true }).fill(`${year}-10-20`);
    await dialog.getByLabel('End date', { exact: true }).fill(`${year}-10-20`);
    await dialog.getByLabel('Administrative reason', { exact: true }).fill('HR demo entry');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByRole('button', { name: 'Correct', exact: true }).first().click();
    dialog = page.getByRole('dialog', { name: 'Correct administrative leave' });
    await dialog.getByLabel('Start date', { exact: true }).fill(`${year}-10-21`);
    await dialog.getByLabel('End date', { exact: true }).fill(`${year}-10-21`);
    await dialog.getByLabel('Correction reason', { exact: true }).fill('Corrected during the HR demo');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();

    await page.getByRole('link', { name: 'Notifications', exact: true }).click();
    await page.getByRole('tab', { name: /Unread/ }).click();
    const markRead = page.getByRole('button', { name: 'Mark read', exact: true }).first();
    if (await markRead.isVisible()) await markRead.click();

    await page.getByRole('link', { name: 'Audit log', exact: true }).click();
    await page.getByLabel('Search audit history', { exact: true }).fill('LEAVE_CORRECTED');
    await expect(page.getByText('Corrected', { exact: true })).toBeVisible();
    if (process.env.PLAYWRIGHT_DEMO) await page.waitForTimeout(3_000);
  });
});
