import { expect, test } from '@playwright/test';
import { uiSignIn, usernames } from './hr.helpers';

test('board search follows the active board and tickets move by keyboard or drag', async ({ page }) => {
  await uiSignIn(page, usernames.director);
  await page.getByRole('link', { name: 'Team boards', exact: true }).click();
  await expect(page.getByLabel('Search Client delivery')).toBeVisible();

  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Create a task' });
  await create.getByLabel('Task title').fill('Verify movable board card');
  await create.getByRole('button', { name: 'Create task', exact: true }).click();

  await page.getByLabel('Search Client delivery').fill('movable board');
  const card = page.locator('article.task-card').filter({ hasText: 'Verify movable board card' });
  await expect(card).toBeVisible();
  const key = (await card.locator('.MuiTypography-caption').first().textContent()) ?? '';

  await card.getByRole('button', { name: new RegExp(`Open ${key}`) }).click();
  const detail = page.getByRole('dialog');
  await detail.getByLabel('Move to').click();
  await page.getByRole('option', { name: 'In progress', exact: true }).click();
  await detail.getByRole('button', { name: 'Close task' }).click();
  const movedCard = page.locator('article.task-card').filter({ hasText: 'Verify movable board card' });
  await expect(
    page
      .getByLabel('Drop tasks in In progress')
      .locator('article.task-card')
      .filter({ hasText: 'Verify movable board card' }),
  ).toBeVisible();

  await movedCard.dragTo(page.getByLabel('Drop tasks in Review'), { targetPosition: { x: 100, y: 70 } });
  await expect(page.getByLabel('Drop tasks in Review').locator('article.task-card')).toContainText(
    'Verify movable board card',
  );
  await expect(page.getByText(`${key} moved to Review.`)).toBeAttached();
});
