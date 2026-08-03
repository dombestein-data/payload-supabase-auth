import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface LoginOptions {
  page: Page
  serverURL?: string
  user?: { email: string; password: string }
}

/**
 * Logs the user into the admin panel via the login page.
 */
export async function login({
  page,
  serverURL = 'http://localhost:3000',
  user = {
    email: process.env.SUPABASE_TEST_EMAIL ?? '',
    password: process.env.SUPABASE_TEST_PASSWORD ?? '',
  },
}: LoginOptions): Promise<void> {
  if (!user.email || !user.password) {
    throw new Error('Supabase browser-test credentials are not configured')
  }

  await page.goto(`${serverURL}/admin/login`)

  await expect(page.locator('#field-email')).toHaveCount(0)
  await expect(page.locator('#field-password')).toHaveCount(0)
  await page.fill('#supabase-email', user.email)
  await page.fill('#supabase-password', user.password)
  await page.getByRole('button', { name: 'Sign in with Supabase' }).click()

  await page.waitForURL(`${serverURL}/admin`)

  const dashboardArtifact = page.locator('span[title="Dashboard"]')
  await expect(dashboardArtifact).toBeVisible()
}
