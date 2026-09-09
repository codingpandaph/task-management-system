import { expect, test } from '@playwright/test';
import { login, post, select, usernames, year } from './hr.helpers';

test.use({ launchOptions: { slowMo: process.env.PLAYWRIGHT_DEMO ? Number(process.env.DEMO_SLOWMO_MS ?? 1200) : 0 } });

export function registerManagementScenarios() {
  test('HRIS navigation, search, filters, tabs, icons, and primary actions stay immediately available', async ({
    page,
  }) => {
    await login(page.request, usernames.hr);
    await page.goto('/employees');

    const addEmployee = page.getByRole('button', { name: 'Add employee', exact: true });
    await expect(addEmployee).toBeVisible();
    expect((await addEmployee.boundingBox())!.y).toBeLessThan(320);
    expect(await page.locator('.nav-link svg').count()).toBeGreaterThan(5);

    await page.getByLabel('Search people', { exact: true }).fill('Taylor Quinn');
    await expect(page.getByRole('link', { name: 'Taylor Quinn', exact: true })).toBeVisible();
    await select(page, 'Department', 'Human Resources');
    await select(page, 'Position', 'Account Director');
    await select(page, 'Status', 'active');
    await expect(page.getByRole('link', { name: 'Taylor Quinn', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Taylor Quinn', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
    const activeTag = page.locator('.status-tag', { hasText: 'Active' }).first();
    const directorTag = page.locator('.status-tag', { hasText: 'Director' }).first();
    await expect(activeTag).toBeVisible();
    await expect(directorTag).toBeVisible();
    expect(await activeTag.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
      await directorTag.evaluate((element) => getComputedStyle(element).backgroundColor),
    );
    await page.getByRole('tab', { name: 'Employment', exact: true }).click();
    await expect(page.getByRole('table', { name: 'Employment history' })).toBeVisible();
    await expect(page.getByText('Permanent', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Access & security', exact: true }).click();
    await expect(page.getByText('Onboard', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage permissions', exact: true })).toHaveCount(0);

    await page.getByRole('link', { name: 'Policies', exact: true }).click();
    await expect(page.getByRole('tab', { name: /Regular leave/ })).toBeVisible();
    await page.getByRole('tab', { name: /Christmas/ }).click();
    await page.getByLabel('Search Christmas policies', { exact: true }).fill('Christmas');
    await expect(page.getByText(/Christmas/).first()).toBeVisible();
    await page.getByRole('button', { name: 'New version', exact: true }).first().click();
    await expect(page.getByRole('dialog', { name: /Create a new version/ })).toBeVisible();
    await page
      .getByRole('dialog', { name: /Create a new version/ })
      .getByRole('button', { name: 'Cancel' })
      .click();
    await expect(page.locator('.action-bar')).toHaveCount(0);

    await page.getByRole('link', { name: 'Approvals', exact: true }).click();
    await expect(page.getByLabel('Search leave approvals', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /Cancellations/ }).click();
    await expect(page.getByLabel('Search cancellations', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Who’s out', exact: true }).click();
    await expect(page.getByLabel('Calendar department', { exact: true })).toBeVisible();
  });

  test('draft editing, HR correction, notifications, and audit review work through the UI', async ({ page }) => {
    await login(page.request, usernames.hr);
    await page.goto('/leave');
    await page.getByRole('button', { name: 'File leave', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'File a leave request' });
    await select(page, 'Leave type', 'Vacation');
    await dialog.getByLabel('Start date', { exact: true }).fill(`${year}-11-05`);
    await dialog.getByLabel('End date', { exact: true }).fill(`${year}-11-05`);
    await dialog.getByLabel('Reason (optional; no medical diagnosis)', { exact: true }).fill('Initial draft');
    await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page
      .getByRole('link')
      .filter({ hasText: `${year}-11-05` })
      .first()
      .click();
    await page.getByRole('button', { name: 'Edit draft', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Edit leave draft' });
    await dialog.getByLabel('Reason (optional; no medical diagnosis)', { exact: true }).fill('Updated draft');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('Updated draft', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Leave administration', exact: true }).click();
    await page.getByRole('button', { name: 'Add administrative leave', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Administrative leave entry' });
    await select(page, 'Employee', 'Morgan Reed');
    await select(page, 'Leave type', 'Vacation');
    await dialog.getByLabel('Start date', { exact: true }).fill(`${year}-09-22`);
    await dialog.getByLabel('End date', { exact: true }).fill(`${year}-09-22`);
    await dialog.getByLabel('Administrative reason', { exact: true }).fill('Recorded by HR for UI verification');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('Changes saved successfully', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Correct', exact: true }).first().click();
    dialog = page.getByRole('dialog', { name: 'Correct administrative leave' });
    await dialog.getByLabel('Start date', { exact: true }).fill(`${year}-09-23`);
    await dialog.getByLabel('End date', { exact: true }).fill(`${year}-09-23`);
    await dialog.getByLabel('Correction reason', { exact: true }).fill('Corrected date after employee confirmation');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText(`${year}-09-23 → ${year}-09-23`, { exact: false })).toBeVisible();

    await page.getByRole('link', { name: 'Notifications', exact: true }).click();
    await expect(page.getByRole('tab', { name: /Unread/ })).toBeVisible();
    const markAllRead = page.getByRole('button', { name: 'Mark all read', exact: true });
    if (await markAllRead.isVisible()) {
      await markAllRead.click();
      await page.getByRole('tab', { name: /Unread/ }).click();
      await expect(page.getByText('No unread notifications')).toBeVisible();
    }

    await page.getByRole('link', { name: 'Audit log', exact: true }).click();
    await page.getByLabel('Search audit history', { exact: true }).fill('LEAVE_CORRECTED');
    await expect(page.getByText('Corrected', { exact: true })).toBeVisible();
  });

  test('HR adjustment is idempotent and suspension immediately denies authentication', async ({ playwright }) => {
    const hr = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3100' });
    const employee = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3100' });
    try {
      const csrf = await login(hr, usernames.hr);
      const departments = (await (await hr.get('/api/departments')).json()) as { id: string; code: string }[];
      const policies = (await (await hr.get('/api/policies')).json()) as {
        leave: { leavePolicyVersion_policy: { id: string }[] }[];
        christmas: { christmasPolicyVersion_policy: { id: string }[] }[];
      };
      const created = await post<{ id: string; employeeId: string; temporaryPassword: string }>(hr, 'employees', csrf, {
        firstName: 'Security',
        lastName: `Fixture${Date.now()}`,
        birthDate: '1990-06-15',
        departmentId: departments.find((d) => d.code === 'ACC')!.id,
        employmentType: 'FULL_TIME',
        startDate: `${year}-01-01`,
        leavePolicyVersionId: policies.leave[0].leavePolicyVersion_policy[0].id,
        christmasPolicyVersionId: policies.christmas[0].christmasPolicyVersion_policy[0].id,
      });
      const operationId = crypto.randomUUID();
      const adjustment = {
        employeeId: created.id,
        year,
        type: 'VACATION',
        days: 1,
        reason: 'Playwright administrative adjustment',
        operationId,
      };
      await post(hr, 'hr/leave/adjustments', csrf, adjustment);
      await post(hr, 'hr/leave/adjustments', csrf, adjustment);

      const loginResponse = await employee.post('/api/auth/login', {
        headers: { origin: 'http://127.0.0.1:3100', 'x-tms-client': 'web' },
        data: { employeeId: created.employeeId, password: created.temporaryPassword },
      });
      expect(loginResponse.ok()).toBe(true);
      await post(hr, `employees/${created.id}/suspend`, csrf, {
        reason: 'Playwright access revocation check',
        suspendedUntil: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect((await employee.get('/api/auth/me')).status()).toBe(401);
    } finally {
      await hr.dispose();
      await employee.dispose();
    }
  });

  test('remaining management, policy, lifecycle, reporting, and session flows complete', async ({ playwright }) => {
    const hr = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3100' });
    const senior = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3100' });
    try {
      const hrCsrf = await login(hr, usernames.hr),
        seniorCsrf = await login(senior, usernames.senior);
      const suffix = Date.now().toString().slice(-6);
      const department = await post<{ id: string; version: number }>(hr, 'departments', hrCsrf, {
        code: `Z${suffix}`,
        name: `Lifecycle ${suffix}`,
      });
      const editDepartment = await hr.patch(`/api/departments/${department.id}`, {
        headers: { origin: 'http://127.0.0.1:3100', 'x-tms-client': 'web', 'x-csrf-token': hrCsrf },
        data: {
          name: `Lifecycle team ${suffix}`,
          description: 'Playwright management flow',
          version: department.version,
        },
      });
      expect(editDepartment.ok(), await editDepartment.text()).toBe(true);
      await post(hr, `departments/${department.id}/deactivate`, hrCsrf, {});
      await post(hr, `departments/${department.id}/activate`, hrCsrf, {});

      const policies = (await (await hr.get('/api/policies')).json()) as {
        leave: { leavePolicyVersion_policy: { id: string }[] }[];
        christmas: { christmasPolicyVersion_policy: { id: string }[] }[];
      };
      const employee = await post<{ id: string }>(hr, 'employees', hrCsrf, {
        firstName: 'Flow',
        lastName: `Tester${suffix}`,
        birthDate: '1991-04-10',
        departmentId: department.id,
        employmentType: 'FULL_TIME',
        startDate: `${year}-01-01`,
        leavePolicyVersionId: policies.leave[0].leavePolicyVersion_policy[0].id,
        christmasPolicyVersionId: policies.christmas[0].christmasPolicyVersion_policy[0].id,
      });
      const detail = (await (await hr.get(`/api/employees/${employee.id}`)).json()) as { version: number };
      const editEmployee = await hr.patch(`/api/employees/${employee.id}`, {
        headers: { origin: 'http://127.0.0.1:3100', 'x-tms-client': 'web', 'x-csrf-token': hrCsrf },
        data: { firstName: 'Flow', lastName: `Verified${suffix}`, version: detail.version },
      });
      expect(editEmployee.ok(), await editEmployee.text()).toBe(true);
      await post(hr, `employees/${employee.id}/employment-records`, hrCsrf, {
        type: 'CONTRACTUAL',
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        reason: 'E2E renewal',
      });
      expect((await hr.get(`/api/employees/${employee.id}/employment-records`)).ok()).toBe(true);

      const leaveVersion = await post<{ id: string; policyId: string }>(hr, 'leave-policies', hrCsrf, {
        name: `Flow leave ${suffix}`,
        vacationDays: 24,
        sickDays: 6,
      });
      const leaveV2 = await post<{ id: string }>(hr, `leave-policies/${leaveVersion.policyId}/versions`, hrCsrf, {
        name: `Flow leave ${suffix}`,
        vacationDays: 26,
        sickDays: 7,
      });
      await post(hr, `employees/${employee.id}/leave-policy`, hrCsrf, { policyVersionId: leaveV2.id, year: year + 1 });
      await post(hr, `leave-policies/${leaveVersion.policyId}/status`, hrCsrf, { status: 'INACTIVE' });
      await post(hr, `leave-policies/${leaveVersion.policyId}/status`, hrCsrf, { status: 'ACTIVE' });
      const christmas = await post<{ id: string; policyId: string }>(hr, 'christmas-policies', hrCsrf, {
        name: `Flow Christmas ${suffix}`,
        days: 5,
      });
      const christmasV2 = await post<{ id: string }>(hr, `christmas-policies/${christmas.policyId}/versions`, hrCsrf, {
        name: `Flow Christmas ${suffix}`,
        days: 6,
      });
      await post(hr, `employees/${employee.id}/christmas-policy`, hrCsrf, {
        policyVersionId: christmasV2.id,
        year: year + 1,
      });
      await post(hr, `christmas-policies/${christmas.policyId}/status`, hrCsrf, { status: 'INACTIVE' });
      await post(hr, `christmas-policies/${christmas.policyId}/status`, hrCsrf, { status: 'ACTIVE' });

      const people = (await (await hr.get('/api/employees?pageSize=100')).json()) as {
        items: { id: string; displayName: string; department: { code: string } }[];
      };
      const riley = people.items.find((person) => person.displayName === 'Riley Shaw')!;
      await post(senior, `employees/${riley.id}/permissions`, seniorCsrf, {
        code: 'EMPLOYEE_READ',
        reason: 'E2E grant',
      });
      expect((await senior.get(`/api/employees/${riley.id}/permissions`)).ok()).toBe(true);
      await post(senior, `employees/${riley.id}/permissions/revoke`, seniorCsrf, {
        code: 'EMPLOYEE_READ',
        reason: 'E2E revoke',
      });

      const acc = ((await (await hr.get('/api/departments')).json()) as { id: string; code: string }[]).find(
        (d) => d.code === 'ACC',
      )!;
      await post(hr, `employees/${employee.id}/transfer`, hrCsrf, { departmentId: acc.id, reason: 'E2E transfer' });
      await post(hr, `employees/${employee.id}/reset-password`, hrCsrf, { reason: 'E2E reset' });
      await post(hr, `employees/${employee.id}/suspend`, hrCsrf, {
        reason: 'E2E suspension',
        suspendedUntil: new Date(Date.now() + 86_400_000).toISOString(),
      });
      await post(hr, `employees/${employee.id}/deactivate`, hrCsrf, { reason: 'E2E deactivation' });
      await post(hr, `employees/${employee.id}/reactivate`, hrCsrf, { reason: 'E2E reactivation' });
      await post(hr, `employees/${employee.id}/terminate`, hrCsrf, { reason: 'E2E termination' });

      for (const endpoint of [
        'reporting/dashboard',
        `reporting/calendar?start=${year}-01-01&end=${year}-03-31`,
        'audit',
      ]) {
        const response = await hr.get(`/api/${endpoint}`);
        expect(response.ok(), `${endpoint}: ${await response.text()}`).toBe(true);
      }
      const refreshed = await senior.post('/api/auth/refresh', {
        headers: { origin: 'http://127.0.0.1:3100', 'x-tms-client': 'web', 'x-csrf-token': seniorCsrf },
        data: {},
      });
      expect(refreshed.ok(), await refreshed.text()).toBe(true);
      const refreshedCsrf = ((await refreshed.json()) as { csrf: string }).csrf;
      await post(senior, 'auth/logout', refreshedCsrf, {});
      expect((await senior.get('/api/auth/me')).status()).toBe(401);
    } finally {
      await hr.dispose();
      await senior.dispose();
    }
  });
}
