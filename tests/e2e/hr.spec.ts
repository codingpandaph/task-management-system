import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
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

test('HR creates a department and employee; new employee must change password', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Employee ID', { exact: true }).fill(usernames.hr);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  const suffix = Date.now().toString().slice(-7),
    department = `Demo team ${suffix}`;
  await page.getByRole('link', { name: 'Organization', exact: true }).click();
  const form = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Create department', exact: true }) });
  await form.getByLabel('Department code').fill(`E${suffix}`);
  await form.getByLabel('Department name').fill(department);
  await form.getByRole('button', { name: 'Create department', exact: true }).click();
  await expect(page.getByRole('heading', { name: department, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  const employeeForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Create employee', exact: true }) });
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
