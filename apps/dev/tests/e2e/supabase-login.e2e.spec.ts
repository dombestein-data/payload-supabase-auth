import { expect, test } from '@playwright/test'
import { cleanupLinkedSupabaseTestUser } from '../helpers/cleanupLinkedUser'

const testEmail = process.env.SUPABASE_TEST_EMAIL ?? ''
const testPassword = process.env.SUPABASE_TEST_PASSWORD ?? ''

test.describe('Supabase admin login', () => {
  test.afterAll(async () => {
    await cleanupLinkedSupabaseTestUser()
  })

  test('creates a Payload admin session from Supabase credentials', async ({ page }) => {
    if (!testEmail || !testPassword) {
      throw new Error('Supabase browser-test credentials are not configured')
    }

    await page.goto('http://localhost:3000/admin/login')

    await expect(page.getByRole('heading', { name: 'Sign in with Supabase' })).toBeVisible()
    await expect(page.locator('#field-email')).toHaveCount(0)
    await expect(page.locator('#field-password')).toHaveCount(0)
    await page.locator('#supabase-email').fill(testEmail)
    await page.locator('#supabase-password').fill(testPassword)
    await page.getByRole('button', { name: 'Sign in with Supabase' }).click()

    await expect(page).toHaveURL('http://localhost:3000/admin')
    await expect(page.locator('span[title="Dashboard"]').first()).toBeVisible()

    const logout = await page.request.post('http://localhost:3000/api/users/logout')
    expect(logout.ok()).toBe(true)
  })
})
