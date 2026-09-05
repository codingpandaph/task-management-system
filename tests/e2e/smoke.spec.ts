import { expect, test } from '@playwright/test';

test('frontend loads without runtime errors and fits responsive viewports', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Task Management System');

  // Mobile/tablet/desktop plus boundaries of the page's Tailwind sm (640px) breakpoint.
  for (const width of [375, 639, 640, 641, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { level: 1, name: 'Task Management System' })).toBeInViewport();
    await expect(page.getByText('The frontend is running.')).toBeInViewport();
    await expect(page.getByRole('main')).toHaveCSS('padding-left', width < 640 ? '16px' : '32px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  expect(errors).toEqual([]);
});

test('backend health endpoint responds successfully', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:3101/health');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toEqual({ status: 'ok' });
});
