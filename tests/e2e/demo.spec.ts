import { expect, test } from '@playwright/test';
import { announce, demoChoose as choose, demoSignIn as signIn, demoYear as year } from './demo.helpers';
import { uiApprove, uiApproveCancellation, uiFileLeave, usernames } from './hr.helpers';

const demoDelay = Number(process.env.DEMO_SLOWMO_MS ?? 900);
test.use({
  actionTimeout: 15_000,
  launchOptions: { slowMo: process.env.PLAYWRIGHT_DEMO ? demoDelay : 0 },
  navigationTimeout: 30_000,
});

test('complete CPSync HRIS and task-management demonstration in one browser page', async ({ page }) => {
  test.setTimeout(process.env.PLAYWRIGHT_DEMO ? 900_000 : 300_000);
  const suffix = Date.now().toString().slice(-6);
  const leavePolicy = `Demo leave ${suffix}`;
  const christmasPolicy = `Demo Christmas ${suffix}`;
  const department = `Demo Operations ${suffix}`;

  await test.step('run starts from the limited deterministic seed', async () => {
    await signIn(page, `${year}-HR-000004`);
    await announce(
      page,
      'Fresh demonstration data',
      'One browser and one page will carry the entire tour across roles.',
    );
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

    await page.getByRole('button', { name: 'Create', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Create leave policy' });
    await dialog.getByLabel('Policy name', { exact: true }).fill(leavePolicy);
    await dialog.getByLabel('Vacation days', { exact: true }).fill('28');
    await dialog.getByLabel('Sick days', { exact: true }).fill('7');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(dialog).toBeHidden();
    if (process.env.PLAYWRIGHT_DEMO) await page.waitForTimeout(1_500);

    await page.getByRole('tab', { name: /Christmas/ }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
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
    await signIn(page, `${year}-ORG-000001`);
    await announce(
      page,
      'Senior Director leave',
      'This request auto-approves, then cancels without an approval chain.',
    );
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

    for (const destination of ['Approvals', 'Leave calendar']) {
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

  await test.step('every employee perspective completes its leave approval path', async () => {
    const matrix = [
      {
        label: 'Employee',
        requester: usernames.member,
        day: `${year}-12-07`,
        approvers: [usernames.director, usernames.hrApprover],
      },
      {
        label: 'Account Director',
        requester: usernames.director,
        day: `${year}-12-08`,
        approvers: [usernames.senior, usernames.hrApprover],
      },
      { label: 'HR employee', requester: usernames.hrMember, day: `${year}-12-09`, approvers: [usernames.hr] },
      { label: 'HR Director', requester: usernames.hr, day: `${year}-12-10`, approvers: [usernames.senior] },
    ];
    let memberRequest = '';
    for (const flow of matrix) {
      await signIn(page, flow.requester);
      await announce(
        page,
        `${flow.label} files leave`,
        `The system snapshots the correct ${flow.approvers.length}-step approval path.`,
      );
      await uiFileLeave(page, flow.day);
      await expect(page).toHaveURL(/\/leave\/[^/]+$/);
      const requestUrl = page.url();
      if (flow.requester === usernames.member) memberRequest = requestUrl;
      for (const approver of flow.approvers) {
        await signIn(page, approver);
        await announce(page, 'Approver decision', 'Only the current assigned approver can take this action.');
        await uiApprove(page, flow.day);
      }
      await signIn(page, flow.requester);
      await page.goto(requestUrl);
      await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
    }
    await signIn(page, usernames.member);
    await page.goto(memberRequest);
    await page.getByRole('button', { name: 'Request cancellation', exact: true }).click();
    const cancellation = page.getByRole('dialog', { name: 'Request leave cancellation' });
    await cancellation.getByLabel('Cancellation reason', { exact: true }).fill('Plans changed');
    await cancellation.getByRole('button', { name: 'Request cancellation', exact: true }).click();
    for (const approver of [usernames.director, usernames.hrApprover]) {
      await signIn(page, approver);
      await uiApproveCancellation(page, `${year}-12-07`);
    }
    await signIn(page, usernames.member);
    await page.goto(memberRequest);
    await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
  });

  await test.step('director assigns work and employee advances it on the same page', async () => {
    await signIn(page, usernames.director);
    await announce(
      page,
      'Account Director workspace',
      'The director delegates creation, assigns work, and keeps reporter ownership.',
    );
    await page.getByRole('link', { name: 'Department', exact: true }).click();
    for (const label of ['Create boards', 'Create tasks'] as const) {
      const toggle = page.getByRole('switch', { name: `${label} for Alex Finch`, exact: true });
      if (!(await toggle.isChecked())) await toggle.click();
    }
    await page.getByRole('link', { name: 'Team boards', exact: true }).click();
    await page.getByRole('button', { name: 'Create task', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Create a task' });
    await create.getByLabel('Task title').fill(`Single-browser handoff ${suffix}`);
    await create.getByLabel('Description').fill('Assigned by the director and completed through the employee view.');
    await create.getByLabel('Assignee').click();
    await page.getByRole('option', { name: 'Alex Finch', exact: true }).click();
    await create.getByRole('button', { name: 'Create task', exact: true }).click();

    await signIn(page, usernames.member);
    await announce(
      page,
      'Employee perspective',
      'Alex sees only assigned work and updates the shared task without impersonation.',
    );
    await page.getByRole('link', { name: 'My tasks', exact: true }).click();
    await page.getByLabel('Search my tasks').fill(`Single-browser handoff ${suffix}`);
    await page.getByRole('button', { name: new RegExp(`Single-browser handoff ${suffix}`) }).click();
    const detail = page.getByRole('dialog');
    await detail.getByLabel('Write a comment').fill('Work has started and is ready for review.');
    await detail.getByLabel('Write a comment').press('Enter');
    await detail.getByLabel('Move to').click();
    await page.getByRole('option', { name: 'In progress', exact: true }).click();
    await expect(detail.getByText('Work has started and is ready for review.')).toBeVisible();
    await detail.getByRole('button', { name: 'Close task' }).click();

    await signIn(page, usernames.director);
    await page.getByRole('link', { name: 'Team boards', exact: true }).click();
    await expect(page.getByLabel('Drop tasks in In progress')).toContainText(`Single-browser handoff ${suffix}`);
    await page.getByRole('link', { name: 'Delivery reports', exact: true }).click();
    await announce(
      page,
      'Leadership reporting',
      'The same work now contributes to team throughput, workload, and cycle-time reporting.',
    );
    await expect(page.getByText('30-day throughput', { exact: true })).toBeVisible();
  });
});
