import { test, expect, type Page } from '@playwright/test'
import { USERS, CHAMPIONSHIP_ID, CHAMP_MATCH_ID } from './fixtures'

async function addParticipant(page: Page, displayName: string) {
  const search = page.getByPlaceholder('Rechercher un joueur...')
  await search.fill(displayName.split(' ').pop()!)
  // AutoComplete suggestions teleported into an overlay
  await page.getByRole('option', { name: displayName }).click()
}

test('le détail du match finalisé seedé affiche joueurs et score', async ({ page }) => {
  await page.goto(`/matches/${CHAMP_MATCH_ID}`)
  await expect(page.getByText(USERS.player1.displayName).first()).toBeVisible()
  await expect(page.getByText(USERS.player2.displayName).first()).toBeVisible()
  await expect(page.getByText('3').first()).toBeVisible()
})

test('le stepper bloque tant que les participants sont incomplets', async ({ page }) => {
  await page.goto(`/tournaments/${CHAMPIONSHIP_ID}/create-match`)

  await page.getByRole('button', { name: 'Maintenant' }).click()
  await page.getByRole('button', { name: 'Suivant' }).click()

  // Only the logged-in player is auto-selected: Next disabled
  await expect(page.getByText('Participants sélectionnés')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Suivant' })).toBeDisabled()
})

test('crée un match complet via le stepper', async ({ page }) => {
  await page.goto(`/tournaments/${CHAMPIONSHIP_ID}/create-match`)

  // Step 1: date — "Now"
  await page.getByRole('button', { name: 'Maintenant' }).click()
  await page.getByRole('button', { name: 'Suivant' }).click()

  // Step 2: participants — the logged-in player (player1) is auto-selected
  await addParticipant(page, USERS.player3.displayName)
  const next = page.getByRole('button', { name: 'Suivant' })
  await expect(next).toBeEnabled()
  await next.click()

  // Step 3: result — winner + scores
  await page
    .getByRole('button', { name: new RegExp(USERS.player3.displayName) })
    .first()
    .click()
  const scores = page.getByRole('spinbutton')
  await scores.nth(0).fill('3')
  await scores.nth(1).fill('1')

  await page.getByRole('button', { name: 'Créer le match' }).click()

  // After creation: back on the tournament's standings tab (championship)
  await expect(page).toHaveURL(new RegExp(`/tournaments/${CHAMPIONSHIP_ID}/standings`), {
    timeout: 15_000,
  })
})
