import { expect, test } from '@playwright/test';
import { login, post, usernames } from './hr.helpers';

test('a task escalation notification opens the exact task for the Senior Director', async ({ browser }) => {
  const directorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  const seniorContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
  try {
    const directorRequest = directorContext.request;
    const csrf = await login(directorRequest, usernames.director);
    const workspaces = (await (await directorRequest.get('/api/task-workspaces')).json()) as { id: string }[];
    const board = (await (await directorRequest.get(`/api/task-workspaces/${workspaces[0].id}/board`)).json()) as {
      board: { columns: { tasks: { id: string; title: string }[] }[] };
    };
    const task = board.board.columns.flatMap((column) => column.tasks)[0];
    await post(directorRequest, `tasks/${task.id}/escalation`, csrf, { escalated: true });

    const senior = await seniorContext.newPage();
    await login(senior.request, usernames.senior);
    await senior.goto('/notifications');
    const taskNotice = senior.locator(`a[href="/workspaces?task=${task.id}"]`);
    await expect(taskNotice).toBeVisible();
    await taskNotice.click();
    await expect(senior).toHaveURL(new RegExp(`/workspaces\\?task=${task.id}$`));
    await expect(senior.getByRole('dialog').getByText(task.title, { exact: true })).toBeVisible();
  } finally {
    await directorContext.close();
    await seniorContext.close();
  }
});
