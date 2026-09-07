import { expect, test, type Page } from '@playwright/test';

const password = 'Demo only password 2026!';
const users = {
  senior: '2026-DIR-000001',
  director: '2026-ACC-000002',
  member: '2026-ACC-000007',
};

async function signIn(page: Page, employeeId: string) {
  await page.goto('/login');
  await page.getByLabel('Employee ID', { exact: true }).fill(employeeId);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}

test('member creates, discusses, completes DoD, and advances a signed-off task', async ({ browser }) => {
  const memberContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const directorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  try {
    const member = await memberContext.newPage();
    const director = await directorContext.newPage();
    await signIn(member, users.member);
    await member.getByRole('link', { name: 'Team boards', exact: true }).click();
    await expect(member.getByRole('heading', { name: 'Team boards', exact: true })).toBeVisible();
    await member.getByRole('button', { name: 'Create task', exact: true }).click();
    const create = member.getByRole('dialog', { name: 'Create a task' });
    await create.getByLabel('Task title').fill('Publish customer handover');
    await create.getByLabel('Description').fill('Prepare the handover notes and confirm ownership.');
    await create.getByLabel('Estimate in hours').fill('12');
    await create.getByLabel('Assignee').click();
    await member.getByRole('option', { name: 'Alex Finch' }).click();
    await create.getByLabel('Definition of Done (one item per line)').fill('Notes reviewed');
    await create.getByRole('button', { name: 'Create task', exact: true }).click();

    await member.getByRole('button', { name: /Open ACC-#\d+ Publish customer handover/ }).click();
    const detail = member.getByRole('dialog');
    await detail.getByLabel('Write a comment').fill('Ready for director review');
    await detail.getByLabel('Write a comment').press('Enter');
    await expect(detail.getByText('Ready for director review')).toBeVisible();
    await detail.getByRole('button', { name: 'Edit task', exact: true }).click();
    const edit = member.getByRole('dialog', { name: 'Edit task details' });
    await edit.getByLabel('Estimate in hours').fill('10');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(detail.getByText('10 hours')).toBeVisible();
    await detail.getByLabel('Notes reviewed').click();
    await expect(detail.getByLabel('Notes reviewed')).toBeChecked();
    await detail.getByLabel('Move to').click();
    await member.getByRole('option', { name: 'Done · sign-off' }).click();
    await expect(detail.getByText('Management sign-off is required')).toBeVisible();
    await detail.getByRole('button', { name: 'Close task' }).click();

    await signIn(director, users.director);
    await director.getByRole('link', { name: 'Team boards', exact: true }).click();
    await director.getByRole('button', { name: /Open ACC-#\d+ Publish customer handover/ }).click();
    await director.getByRole('button', { name: 'Sign off task', exact: true }).click();
    await expect(director.getByText('Signed off', { exact: true })).toBeVisible();
    await director.getByRole('button', { name: 'Close task' }).click();

    await member.reload();
    await member.getByRole('button', { name: /Open ACC-#\d+ Publish customer handover/ }).click();
    await member.getByLabel('Move to').click();
    await member.getByRole('option', { name: 'Done · sign-off' }).click();
    await expect(member.getByText('Done', { exact: true }).first()).toBeVisible();
    await member.getByRole('button', { name: 'Delete task', exact: true }).click();
    await expect(member.getByRole('button', { name: /Publish customer handover/ })).toHaveCount(0);

    await director.getByRole('link', { name: 'Task archive', exact: true }).click();
    await expect(director.getByText('Publish customer handover', { exact: true })).toBeVisible();
    await director.getByRole('button', { name: 'Restore task', exact: true }).click();
    await expect(director.getByText('Archive is empty')).toBeVisible();
  } finally {
    await memberContext.close();
    await directorContext.close();
  }
});

test('individual, team, and Senior Director reporting surfaces are scoped and responsive', async ({ page }) => {
  await signIn(page, users.senior);
  await page.getByRole('link', { name: 'My tasks', exact: true }).click();
  await expect(page.getByText('Every task assigned to you, across department workspaces.')).toBeVisible();
  await page.getByRole('link', { name: 'Team boards', exact: true }).click();
  await expect(page.getByLabel(/board$/)).toBeVisible();
  await page.getByRole('link', { name: 'Delivery reports', exact: true }).click();
  await expect(page.getByText('Client Services workspace')).toBeVisible();
  await expect(page.getByText('Marketing workspace')).toBeVisible();
  for (const width of [375, 599, 600, 601, 899, 900, 901, 1199, 1200, 1201, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
    await expect(page.getByRole('heading', { name: 'Delivery reports' })).toBeVisible();
  }
});

test('Account Director creates a board, milestone, collaborator allocation, and reviews capacity', async ({ page }) => {
  const year = new Date().getFullYear();
  await signIn(page, users.director);
  await page.getByRole('link', { name: 'Team boards', exact: true }).click();

  await page.getByRole('button', { name: 'New board', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Create Kanban board' })
    .getByLabel('Board name')
    .fill('Implementation tracker');
  await page.getByRole('dialog', { name: 'Create Kanban board' }).getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('tab', { name: 'Implementation tracker' })).toBeVisible();

  await page.getByRole('button', { name: 'New milestone', exact: true }).click();
  const milestone = page.getByRole('dialog', { name: 'Create milestone' });
  await milestone.getByLabel('Milestone name').fill('Technical validation');
  await milestone.getByLabel('Goal').fill('Validate the prototype with two colleagues');
  await milestone.getByLabel('Start date').fill(`${year}-10-01`);
  await milestone.getByLabel('Due date and time').fill(`${year}-10-16T17:00`);
  await milestone.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: /Technical validation/ })).toBeVisible();

  await page.getByRole('button', { name: 'Add collaborator', exact: true }).click();
  const collaborator = page.getByRole('dialog', { name: 'Add workspace collaborator' });
  await collaborator.getByLabel('Active employee').click();
  await page.getByRole('option', { name: 'Riley Shaw' }).click();
  await collaborator.getByLabel('Milestone scope').click();
  await page.getByRole('option', { name: 'Technical validation' }).click();
  await collaborator.getByRole('button', { name: 'Save changes' }).click();

  await page.getByRole('button', { name: /Technical validation/ }).click();
  await expect(page.getByRole('dialog', { name: 'Milestone capacity' }).getByText(/collaborators/)).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Milestone capacity' })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
});
