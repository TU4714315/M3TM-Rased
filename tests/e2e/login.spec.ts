import { expect, test } from '@playwright/test';

test('renders an accessible invitation-only login screen', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/M3TM/);
  await expect(page.getByRole('heading', { name: /M3TM\.RASEED/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الدخول إلى المنصة' })).toBeVisible();
  await expect(page.getByRole('button', { name: /الدخول بحساب Google/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /الدخول كزائر للقراءة فقط/ })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});
