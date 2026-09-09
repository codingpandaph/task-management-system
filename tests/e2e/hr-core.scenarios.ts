import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { PERMISSIONS } from '@tms/contracts';
import {
  login,
  password,
  post,
  select,
  uiApprove,
  uiApproveCancellation,
  uiFileLeave,
  uiSignIn,
  usernames,
  year,
} from './hr.helpers';

test.use({ launchOptions: { slowMo: process.env.PLAYWRIGHT_DEMO ? Number(process.env.DEMO_SLOWMO_MS ?? 1200) : 0 } });

export function registerCoreScenarios() {
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
    await select(page, 'Employment type', 'Permanent');
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
    await page.getByLabel('Confirm new password', { exact: true }).fill('Different secure password 2026!');
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(page.getByText('The new passwords do not match. Try again.')).toBeVisible();
    await page.getByLabel('Confirm new password', { exact: true }).fill('New employee secure password 2026!');
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
        await post(owner.request, `leave/requests/${draft.id}/submit`, owner.csrf, {
          operationId: crypto.randomUUID(),
        });
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
    test.setTimeout(process.env.PLAYWRIGHT_DEMO ? 300_000 : 180_000);
    const contexts: BrowserContext[] = [];
    const pages = new Map<string, Page>();
    const requestUrls = new Map<string, string>();
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
        await expect(requester).toHaveURL(/\/leave\/[^/]+$/);
        const requestUrl = requester.url();
        requestUrls.set(flow.requester, requestUrl);
        for (const approver of flow.approvers) await uiApprove(pages.get(approver)!, flow.day);
        await requester.goto(requestUrl);
        await expect(requester.getByText('Approved', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      }
      const member = pages.get('member')!;
      await member.goto(requestUrls.get('member')!);
      await member.getByRole('button', { name: 'Request cancellation', exact: true }).click();
      const cancellationDialog = member.getByRole('dialog', { name: 'Request leave cancellation' });
      await cancellationDialog.getByLabel('Cancellation reason', { exact: true }).fill('Plans changed');
      await cancellationDialog.getByRole('button', { name: 'Request cancellation', exact: true }).click();
      await uiApproveCancellation(pages.get('director')!, `${year}-12-07`);
      await uiApproveCancellation(pages.get('hrApprover')!, `${year}-12-07`);
      await member.goto(requestUrls.get('member')!);
      await expect(member.getByText('Cancelled', { exact: true }).first()).toBeVisible();
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });

  test('ordinary employee cannot enter HR screens; calendar stays responsive', async ({ page }) => {
    await login(page.request, usernames.member);
    await page.goto('/employees');
    await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create employee', exact: true })).toHaveCount(0);
    expect((await page.request.get('/api/employees')).status()).toBe(403);
    await page.goto('/hr');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await page.goto('/calendar');
    for (const width of [375, 599, 600, 601, 899, 900, 901, 1199, 1200, 1201, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('heading', { name: 'Who’s out', exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });

  test('five-role navigation mirrors backend RBAC capabilities', async ({ browser }) => {
    const cases = [
      {
        user: usernames.member,
        role: 'MEMBER',
        visible: ['My tasks'],
        hidden: ['Approvals', 'Delivery reports', 'Leave administration'],
      },
      {
        user: usernames.director,
        role: 'ACCOUNT_DIRECTOR',
        visible: ['Approvals', 'Delivery reports'],
        hidden: ['Leave administration', 'Audit log'],
      },
      {
        user: usernames.hrMember,
        role: 'HR_MEMBER',
        visible: ['People'],
        hidden: ['Approvals', 'Leave administration', 'Audit log'],
      },
      {
        user: usernames.hrApprover,
        role: 'HR_MEMBER',
        visible: ['People', 'Approvals'],
        hidden: ['Leave administration', 'Audit log'],
      },
      { user: usernames.hr, role: 'HR_DIRECTOR', visible: ['People', 'Leave administration', 'Audit log'], hidden: [] },
      {
        user: usernames.senior,
        role: 'SENIOR_DIRECTOR',
        visible: ['Delivery reports', 'Leave administration', 'Audit log'],
        hidden: [],
      },
    ] as const;
    for (const current of cases) {
      const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
      const page = await context.newPage();
      await uiSignIn(page, current.user);
      const me = (await (await page.request.get('/api/auth/me')).json()) as { role: string; permissions: string[] };
      expect(me.role).toBe(current.role);
      if (current.role === 'SENIOR_DIRECTOR') expect(new Set(me.permissions)).toEqual(new Set(PERMISSIONS));
      for (const label of current.visible)
        await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
      for (const label of current.hidden)
        await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(0);
      if (['HR_MEMBER', 'HR_DIRECTOR', 'SENIOR_DIRECTOR'].includes(current.role)) {
        await page.getByRole('link', { name: 'People', exact: true }).click();
        const addEmployee = page.getByRole('button', { name: 'Add employee', exact: true });
        if (current.role === 'HR_MEMBER') await expect(addEmployee).toHaveCount(0);
        else await expect(addEmployee).toBeVisible();
      }
      await context.close();
    }
  });

  test('leave action dialog fits mobile, tablet, desktop, and breakpoint boundaries', async ({ page }) => {
    await login(page.request, usernames.hrMember);
    await page.goto('/leave');
    const leaveAction = page.getByRole('button', { name: 'File leave', exact: true });
    await expect(leaveAction).toHaveCSS('color', 'rgb(255, 255, 255)');
    await leaveAction.hover();
    await expect(leaveAction).toHaveCSS('color', 'rgb(255, 255, 255)');
    for (const width of [375, 599, 600, 601, 899, 900, 901, 1199, 1200, 1201, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: 'File leave', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'File a leave request' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Preview days', exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Save draft', exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Submit for approval', exact: true })).toHaveCSS(
        'color',
        'rgb(255, 255, 255)',
      );
      await expect(dialog.getByRole('combobox', { name: 'Action', exact: true })).toHaveCount(0);
      expect(await dialog.evaluate((element) => element.getBoundingClientRect().width <= innerWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 375) {
        await select(page, 'Leave type', 'Vacation');
        await dialog.getByLabel('Start date', { exact: true }).fill(`${year}-11-19`);
        await dialog.getByLabel('End date', { exact: true }).fill(`${year}-11-19`);
        await dialog.getByRole('button', { name: 'Preview days', exact: true }).click();
        await expect(dialog.getByText(/working day/)).toBeVisible();
        await expect(dialog).toBeVisible();
      }
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    const leaveAccessibility = await new AxeBuilder({ page }).analyze();
    expect(leaveAccessibility.violations).toEqual([]);
  });
}
