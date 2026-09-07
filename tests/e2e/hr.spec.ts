import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
const year = new Date().getFullYear();
const password = 'Demo only password 2026!';
const usernames = {
  hr: `${year}-HR-000004`,
  hrApprover: `${year}-HR-000005`,
  hrMember: `${year}-HR-000006`,
  member: `${year}-ACC-000007`,
  director: `${year}-ACC-000002`,
  senior: `${year}-DIR-000001`,
};
async function login(request: APIRequestContext, employeeId: string) {
  const r = await request.post('/api/auth/login', {
    headers: { origin: 'http://127.0.0.1:3100', 'x-tms-client': 'web' },
    data: { employeeId, password },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return ((await r.json()) as { csrf: string }).csrf;
}
async function post<T>(request: APIRequestContext, path: string, csrf: string, data: unknown): Promise<T> {
  const r = await request.post(`/api/${path}`, {
    headers: { origin: 'http://127.0.0.1:3100', 'x-tms-client': 'web', 'x-csrf-token': csrf },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json() as Promise<T>;
}
async function select(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).last().click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function uiSignIn(page: Page, employeeId: string) {
  await page.goto('/login');
  await page.getByLabel('Employee ID', { exact: true }).fill(employeeId);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}
async function uiFileLeave(page: Page, day: string) {
  await page.goto('/leave');
  await page.getByRole('button', { name: 'File leave', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'File a leave request' });
  await select(page, 'Leave type', 'Vacation');
  await dialog.getByLabel('Start date', { exact: true }).fill(day);
  await dialog.getByLabel('End date', { exact: true }).fill(day);
  await dialog.getByLabel('Reason (optional; no medical diagnosis)', { exact: true }).fill('Browser approval matrix');
  await select(page, 'Action', 'Submit for approval');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('link').filter({ hasText: day }).first().click();
}
async function uiApprove(page: Page, day: string) {
  await page.goto('/approvals');
  const date = page.getByText(new RegExp(`^${day} → ${day}`)).first();
  await expect(date).toBeVisible();
  await date.locator('..').getByRole('link').click();
  await page.getByRole('button', { name: 'Review request', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record your decision' });
  await select(page, 'Decision', 'Approve');
  await dialog.getByRole('button', { name: 'Record decision', exact: true }).click();
}

test('HR creates a department and employee; new employee must change password', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Employee ID', { exact: true }).fill(usernames.hr);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  const suffix = Date.now().toString().slice(-7),
    department = `Demo team ${suffix}`;
  await page.getByRole('link', { name: 'Organization', exact: true }).click();
  await page.getByRole('button', { name: 'Create department', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Create a department' }).locator('form');
  await form.getByLabel('Department code').fill(`E${suffix}`);
  await form.getByLabel('Department name').fill(department);
  await form.getByRole('button', { name: 'Create department', exact: true }).click();
  await expect(page.getByRole('heading', { name: department, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Add employee', exact: true }).click();
  const employeeForm = page.getByRole('dialog', { name: 'Add a new employee' }).locator('form');
  await employeeForm.getByLabel('First name', { exact: true }).fill('Fictional');
  await employeeForm.getByLabel('Last name', { exact: true }).fill(suffix);
  await employeeForm.getByLabel('Birth date', { exact: true }).fill('1992-03-04');
  await select(page, 'Department', department);
  await select(page, 'Employment type', 'FULL TIME');
  await employeeForm.getByLabel('Employment start', { exact: true }).fill(`${year}-01-01`);
  await page.getByRole('combobox', { name: 'Leave policy', exact: true }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('combobox', { name: 'Christmas policy', exact: true }).click();
  await page.getByRole('option').first().click();
  await employeeForm.getByRole('button', { name: 'Create employee', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const credentials = (await dialog.locator('pre').innerText()).split('\n');
  expect(credentials[0]).toMatch(/^\d{4}-E\d+-\d{6}$/);
  await dialog.getByRole('button', { name: 'Close and clear password' }).click();
  await expect(page.getByText(credentials[1], { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Employee ID', { exact: true }).fill(credentials[0]);
  await page.getByLabel('Password', { exact: true }).fill(credentials[1]);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your password' })).toBeVisible();
  expect((await page.request.get('/api/employees')).status()).toBe(403);
  await page.getByLabel('Temporary password').fill(credentials[1]);
  await page.getByLabel('New password', { exact: true }).fill('New employee secure password 2026!');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
});

test('all five leave approval chains and approved cancellation complete', async ({ playwright }) => {
  const people = new Map<string, { request: APIRequestContext; csrf: string }>();
  try {
    for (const [name, id] of Object.entries(usernames)) {
      const request = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3100' });
      people.set(name, { request, csrf: await login(request, id) });
    }
    const matrix: [string, string[]][] = [
      ['member', ['director', 'hrApprover']],
      ['director', ['senior', 'hrApprover']],
      ['senior', []],
      ['hrMember', ['hr']],
      ['hr', ['senior']],
    ];
    for (const [index, [name, chain]] of matrix.entries()) {
      const owner = people.get(name)!;
      const day = `${year}-12-${String(14 + index).padStart(2, '0')}`;
      const draft = await post<{ id: string }>(owner.request, 'leave/requests', owner.csrf, {
        type: 'VACATION',
        startDate: day,
        endDate: day,
      });
      await post(owner.request, `leave/requests/${draft.id}/submit`, owner.csrf, { operationId: crypto.randomUUID() });
      for (const approverName of chain) {
        const approver = people.get(approverName)!;
        await post(approver.request, `leave/requests/${draft.id}/decision`, approver.csrf, { decision: 'APPROVED' });
      }
      const detail = await owner.request.get(`/api/leave/requests/${draft.id}`);
      expect((await detail.json()).status).toBe('APPROVED');
      const cancelled = await post<{ id: string }>(owner.request, `leave/requests/${draft.id}/cancel`, owner.csrf, {
        operationId: crypto.randomUUID(),
        reason: 'Demonstration complete',
      });
      for (const approverName of chain) {
        const approver = people.get(approverName)!;
        await post(approver.request, `leave/cancellations/${cancelled.id}/decision`, approver.csrf, {
          decision: 'APPROVED',
        });
      }
      expect((await (await owner.request.get(`/api/leave/requests/${draft.id}`)).json()).status).toBe('CANCELLED');
    }
  } finally {
    for (const p of people.values()) await p.request.dispose();
  }
});

test('all five roles file leave and complete their approval chains through the UI', async ({ browser }) => {
  test.setTimeout(120_000);
  const contexts: BrowserContext[] = [];
  const pages = new Map<string, Page>();
  try {
    for (const [role, employeeId] of Object.entries(usernames)) {
      const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
      contexts.push(context);
      const page = await context.newPage();
      await uiSignIn(page, employeeId);
      pages.set(role, page);
    }
    const matrix: { requester: string; day: string; approvers: string[] }[] = [
      { requester: 'member', day: `${year}-12-07`, approvers: ['director', 'hrApprover'] },
      { requester: 'director', day: `${year}-12-08`, approvers: ['senior', 'hrApprover'] },
      { requester: 'hrMember', day: `${year}-12-09`, approvers: ['hr'] },
      { requester: 'hr', day: `${year}-12-10`, approvers: ['senior'] },
      { requester: 'senior', day: `${year}-12-11`, approvers: [] },
    ];
    for (const flow of matrix) {
      const requester = pages.get(flow.requester)!;
      await uiFileLeave(requester, flow.day);
      for (const approver of flow.approvers) await uiApprove(pages.get(approver)!, flow.day);
      await requester.reload();
      await expect(requester.getByText('Approved', { exact: true }).first()).toBeVisible();
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('ordinary employee cannot enter HR screens; calendar stays responsive', async ({ page }) => {
  await login(page.request, usernames.hrMember);
  await page.goto('/employees');
  await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create employee', exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/employees')).status()).toBe(403);
  await page.goto('/calendar');
  for (const width of [375, 599, 600, 601, 899, 900, 901, 1199, 1200, 1201, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Who’s out', exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('leave action dialog fits mobile, tablet, desktop, and breakpoint boundaries', async ({ page }) => {
  await login(page.request, usernames.hrMember);
  await page.goto('/leave');
  for (const width of [375, 599, 600, 601, 899, 900, 901, 1199, 1200, 1201, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'File leave', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'File a leave request' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.getBoundingClientRect().width <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
});

test('HRIS navigation, search, filters, tabs, icons, and primary actions stay immediately available', async ({
  page,
}) => {
  await login(page.request, usernames.hr);
  await page.goto('/employees');

  const actionBar = page.locator('.action-bar');
  await expect(actionBar.getByRole('button', { name: 'Add employee', exact: true })).toBeVisible();
  expect((await actionBar.boundingBox())!.y).toBeLessThan(280);
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
  await expect(page.getByText('Full time', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Access & security', exact: true }).click();
  await expect(page.getByText('Add people', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Access controls', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Policies', exact: true }).click();
  await expect(page.getByRole('tab', { name: /Regular leave/ })).toBeVisible();
  await page.getByRole('tab', { name: /Christmas/ }).click();
  await page.getByLabel('Search policies', { exact: true }).fill('Christmas');
  await expect(page.getByText(/Christmas/).first()).toBeVisible();
  await page.getByRole('button', { name: 'New version', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: /Create a new version/ })).toBeVisible();
  await page
    .getByRole('dialog', { name: /Create a new version/ })
    .getByRole('button', { name: 'Cancel' })
    .click();
  expect((await page.locator('.action-bar').boundingBox())!.y).toBeLessThan(280);

  await page.getByRole('link', { name: 'Approvals', exact: true }).click();
  await expect(page.getByLabel('Search approvals', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Cancellations/ }).click();

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
  await select(page, 'Action', 'Save draft');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
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
  const markRead = page.getByRole('button', { name: 'Mark read', exact: true }).first();
  if (await markRead.isVisible()) {
    await markRead.click();
    await page.getByRole('tab', { name: /Unread/ }).click();
  }

  await page.getByRole('link', { name: 'Audit log', exact: true }).click();
  await page.getByLabel('Search audit history', { exact: true }).fill('LEAVE_CORRECTED');
  await expect(page.getByText('Leave corrected', { exact: true })).toBeVisible();
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
    await post(hr, `employees/${riley.id}/permissions`, hrCsrf, { code: 'EMPLOYEE_READ', reason: 'E2E grant' });
    expect((await hr.get(`/api/employees/${riley.id}/permissions`)).ok()).toBe(true);
    await post(hr, `employees/${riley.id}/permissions/revoke`, hrCsrf, { code: 'EMPLOYEE_READ', reason: 'E2E revoke' });

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
