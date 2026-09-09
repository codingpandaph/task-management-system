import { expect, test } from '@playwright/test';
test('login renders at mobile, tablet, desktop and breakpoint boundaries', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  for (const width of [375, 599, 600, 601, 899, 900, 901, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel('Employee ID', { exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('health is public and protected API rejects unauthenticated requests', async ({ request }) => {
  const health = await request.get('http://127.0.0.1:3101/health');
  expect(await health.json()).toEqual({ status: 'ok' });
  expect(health.headers()['x-request-id']).toBeTruthy();
  expect(health.headers()['x-trace-id']).toMatch(/^[a-f0-9]{32}$/);
  const ready = await request.get('http://127.0.0.1:3101/health/ready');
  expect(await ready.json()).toEqual({ status: 'ready', database: 'reachable' });
  expect((await request.get('/api/employees')).status()).toBe(401);
});
