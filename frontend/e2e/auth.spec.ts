import { test, expect } from '@playwright/test'
import { API_URL, USERS, ADMIN_STATE } from './fixtures'

test.describe('anonyme', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('redirige une route protégée vers /login avec redirect', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login via le formulaire email/mot de passe', async ({ page }) => {
    await page.goto('/login?native=true')
    await page.locator('#email').fill(USERS.player1.email)
    await page.locator('#password input').fill(USERS.player1.password)
    await page.locator('form button[type="submit"]').click()

    // Lands on the tournament list, authenticated shell
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'Menu utilisateur' })).toBeVisible()
  })

  test('login invalide reste sur /login', async ({ page }) => {
    await page.goto('/login?native=true')
    await page.locator('#email').fill(USERS.player1.email)
    await page.locator('#password input').fill('mauvais-mot-de-passe')
    await page.locator('form button[type="submit"]').click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('logout renvoie vers /login et invalide la session', async ({ page }) => {
    // Dedicated session: signOut revokes the token, we don't touch the shared storageState
    const res = await page.request.post(`${API_URL}/api/auth/sign-in/email`, {
      data: { email: USERS.player2.email, password: USERS.player2.password },
    })
    expect(res.ok()).toBe(true)

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Menu utilisateur' })).toBeVisible()
    await page.getByRole('button', { name: 'Menu utilisateur' }).click()
    const signOut = page.waitForResponse((r) => r.url().includes('/sign-out'))
    await page.getByText('Se déconnecter').click()
    await signOut

    // The session is properly invalidated: a protected route redirects
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})

test('un joueur est refusé sur /admin', async ({ page }) => {
  await page.goto('/admin')
  // requireAdmin renvoie vers l'accueil
  await expect(page).toHaveURL('/')
  await expect(page.getByText('Administration')).toHaveCount(0)
})

test.describe('admin', () => {
  test.use({ storageState: ADMIN_STATE })

  test('un super admin accède au dashboard /admin', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.getByText('Administration').first()).toBeVisible()
    await expect(page.getByText('Saisons Ranked')).toBeVisible()
  })
})
