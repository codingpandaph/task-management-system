import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const year = new Date().getFullYear();
export const password = 'Demo only password 2026!';
export const usernames = {
  hr: `${year}-HR-000004`,
  hrApprover: `${year}-HR-000005`,
  hrMember: `${year}-HR-000006`,
  member: `${year}-ACC-000007`,
  director: `${year}-ACC-000002`,
  senior: `${year}-ORG-000001`,
};

export async function login(request: APIRequestContext, employeeId: string) {
  const response = await request.post('/api/auth/login', {
    headers: { origin: 'http://127.0.0.1:3100', 'x-tms-client': 'web' },
    data: { employeeId, password },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { csrf: string }).csrf;
}

export async function post<T>(request: APIRequestContext, path: string, csrf: string, data: unknown): Promise<T> {
  const response = await request.post(`/api/${path}`, {
    headers: { origin: 'http://127.0.0.1:3100', 'x-tms-client': 'web', 'x-csrf-token': csrf },
    data,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

export async function select(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).last().click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

export async function uiSignIn(page: Page, employeeId: string) {
  await page.goto('/login');
  await page.getByLabel('Employee ID', { exact: true }).fill(employeeId);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}

export async function uiFileLeave(page: Page, day: string) {
  await page.goto('/leave');
  await page.getByRole('button', { name: 'File leave', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'File a leave request' });
  await select(page, 'Leave type', 'Vacation');
  await dialog.getByLabel('Start date', { exact: true }).fill(day);
  await dialog.getByLabel('End date', { exact: true }).fill(day);
  await dialog.getByLabel('Reason (optional; no medical diagnosis)', { exact: true }).fill('Browser approval matrix');
  await dialog.getByRole('button', { name: 'Submit for approval', exact: true }).click();
  await page.getByRole('link').filter({ hasText: day }).first().click();
}

export async function uiApprove(page: Page, day: string) {
  await page.goto('/approvals');
  const date = page.getByText(new RegExp(`^${day} → ${day}`)).first();
  await expect(date).toBeVisible();
  await date.locator('..').getByRole('link').click();
  await page.getByRole('button', { name: 'Review request', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record your decision' });
  await expect(dialog.getByRole('button', { name: 'Reject', exact: true })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Decision', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Approve', exact: true }).click();
}

export async function uiApproveCancellation(page: Page, day: string) {
  await page.goto('/approvals');
  await page.getByRole('tab', { name: /Cancellations/ }).click();
  const row = page
    .getByText(new RegExp(`^${day} → ${day}$`))
    .first()
    .locator('..');
  await row.getByRole('link').click();
  await page.getByRole('button', { name: 'Review cancellation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Review cancellation request' });
  await expect(dialog.getByLabel('Reason (required for rejection)', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Reject cancellation', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Approve cancellation', exact: true }).click();
}
