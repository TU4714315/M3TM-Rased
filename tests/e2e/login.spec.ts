import { expect, test } from '@playwright/test';

test('renders an accessible invitation-only login screen', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/M3TM/);
  await expect(page.getByRole('heading', { name: /M3.*RASED/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'المتابعة عبر Google' })).toBeVisible();
  await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
  await expect(page.getByLabel('كلمة المرور')).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});
