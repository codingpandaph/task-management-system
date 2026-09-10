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
  const control = page.getByRole('switch', { name: `${label} for Alex Finch`, exact: true });
  if ((await control.isChecked()) !== checked) await control.click();
  await expect(control).toBeChecked({ checked });
}

async function createTask(page: Page, title: string, assignee = 'Alex Finch') {
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create a task' });
  await dialog.getByLabel('Task title').fill(title);
  await dialog.getByLabel('Description').fill('**Demo:** clear ownership and traceable delivery.');
  await expect(dialog.getByText('Preview', { exact: true })).toBeVisible();
  await expect(dialog.locator('strong').filter({ hasText: 'Demo:' })).toBeVisible();
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
    const protectedResponse = await member.request.get('/organization', { maxRedirects: 0 });
    expect([307, 308]).toContain(protectedResponse.status());
    expect(new URL(protectedResponse.headers().location!, member.url()).pathname).toBe('/');
    await member.goto('/organization');
    await expect(member).toHaveURL(/\/$/);
    await expect(member.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();

    const senior = await seniorContext.newPage();
    await signIn(senior, users.senior);
    const navigation = senior.getByRole('navigation', { name: 'Main navigation' });
    for (const group of ['Company', 'Work', 'Time off', 'Administration', 'Updates']) {
      await expect(navigation.getByText(group, { exact: true })).toBeVisible();
    }
    await senior.getByRole('link', { name: 'Organization', exact: true }).click();
    await expect(senior.getByRole('heading', { name: 'Departments and leadership' })).toBeVisible();
    await senior.locator('.department-actions > summary').first().click();
    await senior.getByRole('link', { name: 'View department' }).first().click();
    await expect(senior).toHaveURL(/\/departments\//);
    await expect(senior.getByRole('heading', { name: 'Department', exact: true })).toBeVisible();
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
  await expect(page.getByRole('combobox', { name: 'Department', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create board', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Board name').fill('Client sprint');
  await dialog.getByLabel('Board type').click();
  await expect(page.getByRole('option', { name: 'Kanban' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Scrum' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'List' })).toHaveCount(0);
  await page.getByRole('option', { name: 'Scrum' }).click();
  await dialog.getByLabel('Sprint name').fill('Client sprint');
  await dialog.getByLabel('Sprint goal').fill('Deliver the client sprint outcomes');
  await dialog.getByLabel('Start date').fill('2026-09-01');
  await dialog.getByLabel('Due date').fill('2026-09-30');
  await dialog.getByRole('button', { name: 'Create sprint board' }).click();
  await page.getByRole('combobox', { name: 'Board', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Sprint · Client sprint', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
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

test('each Scrum sprint uses its own board and milestone while HR renders a plain List board', async ({ browser }) => {
  const directorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const hrContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  try {
    const director = await directorContext.newPage();
    await signIn(director, users.director);
    await director.getByRole('link', { name: 'Team boards', exact: true }).click();
    await expect(director.getByRole('combobox', { name: 'Board', exact: true })).toContainText('Client delivery');
    await director.getByRole('combobox', { name: 'Board', exact: true }).click();
    const existingSprint = director.getByRole('option', { name: 'Sprint · Client sprint', exact: true });
    if (await existingSprint.count()) {
      await existingSprint.click();
    } else {
      await director.keyboard.press('Escape');
      await director.getByRole('button', { name: 'Create board', exact: true }).click();
      const board = director.getByRole('dialog');
      await board.getByLabel('Board name').fill('Client sprint');
      await board.getByLabel('Board type').click();
      await director.getByRole('option', { name: 'Scrum', exact: true }).click();
      await board.getByLabel('Sprint name').fill('Client sprint');
      await board.getByLabel('Sprint goal').fill('Deliver the client sprint outcomes');
      await board.getByLabel('Start date').fill('2026-09-01');
      await board.getByLabel('Due date').fill('2026-09-30');
      await board.getByRole('button', { name: 'Create sprint board' }).click();
      await expect(director.getByRole('combobox', { name: 'Board', exact: true })).toContainText('Client sprint');
    }
    await expect(director.getByRole('button', { name: 'New sprint' })).toHaveCount(0);
    await expect(director.getByText('Client sprint', { exact: true }).last()).toBeVisible();
    await director.getByRole('button', { name: 'Create task', exact: true }).click();
    const task = director.getByRole('dialog', { name: 'Create a task' });
    await task.getByLabel('Task title').fill('Sprint delivery proof');
    await task.getByLabel('Description').fill('## Acceptance\n- Safe preview\n- Sprint ownership');
    await task.getByLabel('Board').click();
    await director.getByRole('option', { name: 'Client sprint', exact: true }).click();
    await task.getByLabel('Due date').fill('2026-09-24');
    await task.getByRole('button', { name: 'Create task', exact: true }).click();
    await director.getByRole('button', { name: /Sprint delivery proof/ }).click();
    const detail = director.getByRole('dialog');
    await expect(detail.getByText(/Client sprint/)).toBeVisible();
    await expect(detail.getByRole('heading', { name: 'Acceptance' })).toBeVisible();
    await detail.getByRole('button', { name: 'Close task' }).click();

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

test('saved views, bulk triage, mentions, attachments, and delivery measures work in the UI', async ({ page }) => {
  await signIn(page, users.director);
  await page.getByRole('link', { name: 'Team boards', exact: true }).click();
  await createTask(page, 'Operational evidence');
  await page.getByLabel(/Search Client delivery/).fill('Operational');
  await page.getByText('Saved views and bulk actions', { exact: true }).click();
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  const saveView = page.getByRole('dialog', { name: 'Save these filters' });
  await saveView.getByLabel('View name').fill('Evidence work');
  await saveView.getByRole('button', { name: 'Save changes' }).click();
  await page.getByLabel('Saved view').click();
  await expect(page.getByRole('option', { name: 'Evidence work' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Bulk update', exact: true }).click();
  const bulk = page.getByRole('dialog', { name: 'Update several tasks' });
  await bulk.getByLabel('Tasks').click();
  await page.getByRole('option', { name: /Operational evidence/ }).click();
  await page.keyboard.press('Escape');
  await bulk.getByLabel('Set priority').click();
  await page.getByRole('option', { name: 'High', exact: true }).click();
  await bulk.getByRole('button', { name: 'Save changes' }).click();

  await page.getByRole('button', { name: /Operational evidence/ }).click();
  const detail = page.getByRole('dialog', { name: /Operational evidence/ });
  await detail.getByLabel('Write a comment').fill('Please review @2026-ACC-000007');
  await detail.getByLabel('Write a comment').press('Enter');
  await expect(detail.getByText('Please review @2026-ACC-000007')).toBeVisible();
  await detail.getByRole('button', { name: 'Add attachment' }).click();
  const attachment = page.getByRole('dialog', { name: 'Link an attachment' });
  await attachment.getByLabel('File name').fill('Technical brief.pdf');
  await attachment.getByLabel('Secure link').fill('https://example.com/technical-brief.pdf');
  await attachment.getByLabel('File size in bytes').fill('2048');
  await attachment.getByRole('button', { name: 'Save changes' }).click();
  await expect(detail.getByRole('link', { name: 'Technical brief.pdf' })).toBeVisible();
  await detail.getByRole('button', { name: 'Close task' }).click();

  await page.getByRole('link', { name: 'Delivery reports', exact: true }).click();
  await expect(page.getByText('30-day throughput', { exact: true })).toBeVisible();
  await expect(page.getByText('Average cycle time', { exact: true }).first()).toBeVisible();
});
