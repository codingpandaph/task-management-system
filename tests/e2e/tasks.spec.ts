import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ launchOptions: { slowMo: process.env.PLAYWRIGHT_DEMO ? Number(process.env.DEMO_SLOWMO_MS ?? 1200) : 0 } });
const password = 'Demo only password 2026!';
const users = {
  senior: '2026-ORG-000001',
  director: '2026-ACC-000002',
  hrDirector: '2026-HR-000004',
  member: '2026-ACC-000007',
};

async function signIn(page: Page, employeeId: string) {
  await page.goto('/login');
  await page.getByLabel('Employee ID', { exact: true }).fill(employeeId);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}

async function setMemberAccess(page: Page, label: 'Create boards' | 'Create tasks', checked: boolean) {
  const row = page.getByText('Alex Finch', { exact: true }).locator('..').locator('..');
  const control = row.getByRole('checkbox', { name: label });
  if ((await control.isChecked()) !== checked) await control.click();
  await expect(control).toBeChecked({ checked });
}

async function createTask(page: Page, title: string, assignee = 'Alex Finch') {
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create a task' });
  await dialog.getByLabel('Task title').fill(title);
  await dialog.getByLabel('Description').fill('**Demo:** clear ownership and traceable delivery.');
  if (assignee) {
    await dialog.getByLabel('Assignee').click();
    await page.getByRole('option', { name: assignee, exact: true }).click();
  }
  await expect(dialog.getByText('Reporter: Jordan Ellis')).toBeVisible();
  await dialog.getByRole('button', { name: 'Create task', exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible();
}

async function column(page: Page, name: string): Promise<Locator> {
  return page.locator('.kanban-column').filter({ has: page.getByRole('heading', { name, exact: true }) });
}

test('role-aware navigation and department visibility enforce scope', async ({ browser }) => {
  const memberContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const seniorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  try {
    const member = await memberContext.newPage();
    await signIn(member, users.member);
    await expect(member.getByRole('link', { name: 'Department', exact: true })).toBeVisible();
    await expect(member.getByRole('link', { name: 'Organization', exact: true })).toHaveCount(0);
    await member.goto('/organization');
    await expect(member).toHaveURL(/\/$/);
    await expect(member.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();

    const senior = await seniorContext.newPage();
    await signIn(senior, users.senior);
    await senior.getByRole('link', { name: 'Organization', exact: true }).click();
    await expect(senior.getByText('Employees', { exact: true })).toBeVisible();
    await expect(senior.getByText('Boards', { exact: true })).toBeVisible();
    await senior.getByRole('link', { name: 'View department' }).first().click();
    await expect(senior.getByRole('heading', { name: /Client Services|Human Resources|Marketing/ })).toBeVisible();
  } finally {
    await memberContext.close();
    await seniorContext.close();
  }
});

test('Account Director configures workflows, delegates access, and creates a typed board', async ({ page }) => {
  await signIn(page, users.director);
  await page.getByRole('link', { name: 'Department', exact: true }).click();
  await expect(page.getByText('Alex Finch', { exact: true })).toBeVisible();
  await page.getByLabel('Maximum in progress tasks per member').fill('2');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await setMemberAccess(page, 'Create boards', true);
  await setMemberAccess(page, 'Create tasks', true);

  await page.getByRole('link', { name: 'Team boards', exact: true }).click();
  await page.getByRole('button', { name: 'New board', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create board' });
  await dialog.getByLabel('Board name').fill('Client sprint');
  await dialog.getByLabel('Board type').click();
  await expect(page.getByRole('option', { name: 'Kanban' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Scrum' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'List' })).toHaveCount(0);
  await page.getByRole('option', { name: 'Scrum' }).click();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('tab', { name: 'Client sprint' })).toBeVisible();
});

test('reporter is automatic, assignees are department-scoped, and Kanban uses drag and drop', async ({ page }) => {
  await signIn(page, users.director);
  await page.getByRole('link', { name: 'Team boards', exact: true }).click();
  await createTask(page, 'WIP demonstration');
  await expect(page.getByRole('button', { name: /Move .* to/ })).toHaveCount(0);
  const todo = await column(page, 'To do');
  const progress = await column(page, 'In progress');
  const card = todo.getByRole('button', { name: /WIP demonstration/ });
  await card.dragTo(progress);
  await expect(progress.getByRole('button', { name: /WIP demonstration/ })).toBeVisible();
  await progress.getByRole('button', { name: /WIP demonstration/ }).click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByText(/Reporter\s*Jordan Ellis/)).toBeVisible();
  await expect(detail.getByText('Completion checklist')).toHaveCount(0);
  await detail.getByRole('button', { name: 'Archive task' }).click();
  await expect(page.getByRole('button', { name: /WIP demonstration/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Task archive', exact: true }).click();
  await expect(page.getByText('WIP demonstration', { exact: true })).toBeVisible();
});

test('Scrum validates and runs a sprint while HR renders a plain List board', async ({ browser }) => {
  const directorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const hrContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  try {
    const director = await directorContext.newPage();
    await signIn(director, users.director);
    await director.getByRole('link', { name: 'Team boards', exact: true }).click();
    await director.getByRole('tab', { name: 'Client sprint' }).click();
    await director.getByRole('button', { name: 'New sprint' }).click();
    const sprint = director.getByRole('dialog', { name: 'Create sprint' });
    await sprint.getByLabel('Sprint name').fill('Validation sprint');
    await sprint.getByLabel('Sprint goal').fill('Prepare the technical validation');
    await sprint.getByLabel('Start date').fill('2026-09-14');
    await sprint.getByLabel('End date').fill('2026-09-28');
    await sprint.getByRole('button', { name: 'Save changes' }).click();
    await expect(director.getByText('Validation sprint')).toBeVisible();
    await director.getByRole('button', { name: 'Activate' }).click();
    await expect(director.getByText('ACTIVE')).toBeVisible();

    const hr = await hrContext.newPage();
    await signIn(hr, users.hrDirector);
    await hr.getByRole('link', { name: 'Team boards', exact: true }).click();
    await expect(hr.getByRole('table', { name: 'People operations tasks' })).toBeVisible();
    await expect(hr.locator('.kanban-column')).toHaveCount(0);
  } finally {
    await directorContext.close();
    await hrContext.close();
  }
});

test('authenticated password settings and responsive breakpoints remain usable', async ({ page }) => {
  await signIn(page, users.director);
  await page.getByRole('link', { name: 'Password', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your password' })).toBeVisible();
  await expect(page.getByLabel('Confirm new password')).toBeVisible();
  for (const width of [375, 599, 600, 601, 899, 900, 901, 1199, 1200, 1201, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  }
  await page.context().clearCookies();
  await page.goto('/change-password');
  await expect(page).toHaveURL(/\/login$/);
});
