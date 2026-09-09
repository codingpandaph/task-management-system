import { expect, test, type APIRequestContext } from '@playwright/test';
import type { CurrentEmployee, TaskContract } from '@tms/contracts';
import { login, post, usernames, year } from './hr.helpers';
const baseURL = 'http://127.0.0.1:3100';
type Workspace = {
  id: string;
  departmentId: string;
  boards: { id: string; name: string; kind: string; status: string }[];
};
export function registerAccessFeedbackScenarios() {
  test('overview and calendar enforce organization, department, and personal scope', async ({
    playwright,
    browser,
  }) => {
    test.setTimeout(120_000);
    const sessions = new Map<string, { request: APIRequestContext; csrf: string; me: CurrentEmployee }>();
    try {
      for (const [role, username] of Object.entries(usernames)) {
        const request = await playwright.request.newContext({ baseURL });
        const csrf = await login(request, username);
        const me = await (await request.get('/api/auth/me')).json();
        sessions.set(role, { request, csrf, me });
      }
      for (const [role, chain] of [
        ['member', ['director', 'hrApprover']],
        ['director', ['senior', 'hrApprover']],
        ['hrMember', ['hr']],
      ] as const) {
        const owner = sessions.get(role)!;
        const draft = await post<{ id: string }>(owner.request, 'leave/requests', owner.csrf, {
          type: 'VACATION',
          startDate: `${year}-11-23`,
          endDate: `${year}-11-23`,
        });
        await post(owner.request, `leave/requests/${draft.id}/submit`, owner.csrf, {
          operationId: crypto.randomUUID(),
        });
        for (const approverRole of chain) {
          const approver = sessions.get(approverRole)!;
          await post(approver.request, `leave/requests/${draft.id}/decision`, approver.csrf, { decision: 'APPROVED' });
        }
      }
      for (const role of ['member', 'director', 'hr', 'senior']) {
        const session = sessions.get(role)!;
        const url = `/api/reporting/calendar?start=${year}-11-01&end=${year}-11-30`;
        const events = await (await session.request.get(url)).json();
        expect(events.length).toBeGreaterThan(0);
        if (role === 'member')
          expect(events.every((event: { employee: { id: string } }) => event.employee.id === session.me.id)).toBe(true);
        if (role === 'director') {
          expect(events.length).toBeGreaterThanOrEqual(2);
          expect(
            events.every(
              (event: { employee: { department: { id: string } } }) =>
                event.employee.department.id === session.me.department?.id,
            ),
          ).toBe(true);
        }
        if (role === 'hr' || role === 'senior') expect(events.length).toBeGreaterThanOrEqual(3);
        const tampered = await (
          await session.request.get(`${url}&departmentId=${sessions.get('hr')!.me.department!.id}`)
        ).json();
        if (role === 'member' || role === 'director') expect(tampered).toEqual(events);
        const dashboard = await session.request.get('/api/reporting/dashboard');
        expect(dashboard.status()).toBe(role === 'member' ? 403 : 200);
        if (role === 'director') {
          const data = await dashboard.json();
          expect(
            data.departments.every(
              (department: { departmentId: string }) => department.departmentId === session.me.department?.id,
            ),
          ).toBe(true);
          expect(data.active).toBeLessThan(
            (await (await sessions.get('senior')!.request.get('/api/reporting/dashboard')).json()).active,
          );
        }
        const context = await browser.newContext({ baseURL, storageState: await session.request.storageState() });
        const page = await context.newPage();
        await page.goto('/');
        await expect(page.getByRole('heading', { name: /leave calendar$/ })).toBeVisible();
        await expect(page.locator('main .MuiAlert-root')).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'People', exact: true })).toHaveCount(
          role === 'hr' || role === 'senior' ? 1 : 0,
        );
        if (role === 'member' || role === 'director') {
          expect((await session.request.get('/api/employees')).status()).toBe(403);
          await page.goto('/employees');
          await expect(page).toHaveURL(`${baseURL}/`);
        }
        await context.close();
      }
    } finally {
      for (const session of sessions.values()) await session.request.dispose();
    }
  });

  test('department board access is automatic while creation permissions remain separate', async ({ browser }) => {
    const director = await browser.newContext({ baseURL });
    const member = await browser.newContext({ baseURL });
    const outsider = await browser.newContext({ baseURL });
    try {
      const directorCsrf = await login(director.request, usernames.director);
      const memberCsrf = await login(member.request, usernames.member);
      await login(outsider.request, usernames.hrMember);
      const me = await (await member.request.get('/api/auth/me')).json();
      const workspace: Workspace = (await (await director.request.get('/api/task-workspaces')).json())[0];
      await post(director.request, `task-workspaces/${workspace.id}/memberships`, directorCsrf, {
        employeeId: me.id,
        canCreateTasks: false,
        canCreateBoards: false,
      });
      const board = await post<{ id: string }>(
        director.request,
        `task-workspaces/${workspace.id}/boards`,
        directorCsrf,
        {
          name: 'Department access regression',
          kind: 'KANBAN',
        },
      );
      const task = await post<TaskContract>(director.request, 'tasks', directorCsrf, {
        workspaceId: workspace.id,
        boardId: board.id,
        title: 'Shared department ticket',
        priority: 'LOW',
        estimatedHours: 1,
      });
      expect((await outsider.request.get(`/api/tasks/${task.id}`)).status()).toBe(404);
      const boards: Workspace[] = await (await member.request.get('/api/task-workspaces')).json();
      expect(boards[0].boards.some((item) => item.id === board.id)).toBe(true);
      expect(
        (await outsider.request.get(`/api/task-workspaces/${workspace.id}/board?boardId=${board.id}`)).status(),
      ).toBe(404);
      const headers = { origin: baseURL, 'x-tms-client': 'web', 'x-csrf-token': memberCsrf };
      expect(
        (
          await member.request.post('/api/tasks', {
            headers,
            data: {
              workspaceId: workspace.id,
              boardId: board.id,
              title: 'Blocked',
              priority: 'LOW',
              estimatedHours: 1,
            },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await member.request.post(`/api/task-workspaces/${workspace.id}/boards`, {
            headers,
            data: { name: 'Blocked', kind: 'KANBAN' },
          })
        ).status(),
      ).toBe(403);
      const page = await member.newPage();
      await page.goto('/workspaces');
      await page.getByRole('combobox', { name: 'Board', exact: true }).click();
      await page.getByRole('option', { name: 'Department access regression' }).click();
      await expect(page.getByRole('button', { name: 'Create task', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Create board', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /collaborator|Give board access/ })).toHaveCount(0);
      const ticket = page.getByRole('button', { name: /Shared department ticket/ });
      await page
        .locator('article.task-card')
        .filter({ hasText: 'Shared department ticket' })
        .dragTo(page.getByRole('region', { name: 'Drop tasks in In progress' }), { targetPosition: { x: 100, y: 70 } });
      await expect(
        page
          .getByRole('region', { name: 'Drop tasks in In progress' })
          .getByRole('button', { name: /Shared department ticket/ }),
      ).toBeVisible();
      await ticket.click();
      await page.getByLabel('Write a comment').fill('Department member comment');
      await page.getByLabel('Write a comment').press('Enter');
      await expect(page.getByText('Department member comment', { exact: true })).toBeVisible();
      await post(director.request, `task-workspaces/${workspace.id}/memberships`, directorCsrf, {
        employeeId: me.id,
        canCreateTasks: true,
        canCreateBoards: false,
      });
      await page.reload();
      await page.getByRole('combobox', { name: 'Board', exact: true }).click();
      await page.getByRole('option', { name: 'Department access regression' }).click();
      await expect(page.getByRole('button', { name: 'Create task', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create board', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Create task', exact: true }).click();
      await page.getByRole('dialog').getByLabel('Task title').fill('Permitted task');
      await page.getByRole('dialog').getByRole('button', { name: 'Create task', exact: true }).click();
      await expect(page.getByRole('button', { name: /Permitted task/ })).toBeVisible();
    } finally {
      await director.close();
      await member.close();
      await outsider.close();
    }
  });
}
