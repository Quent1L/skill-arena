import { test, expect, type Page } from '@playwright/test'
import { USERS, CHAMPIONSHIP_ID, CHAMP_MATCH_ID } from './fixtures'

async function addParticipant(page: Page, displayName: string) {
  const search = page.getByPlaceholder('Rechercher un joueur...')
  await search.fill(displayName.split(' ').pop()!)
  // Suggestions AutoComplete téléportées dans un overlay
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

  // Seul le joueur connecté est auto-sélectionné: Suivant désactivé
  await expect(page.getByText('Participants sélectionnés')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Suivant' })).toBeDisabled()
})

test('crée un match complet via le stepper', async ({ page }) => {
  await page.goto(`/tournaments/${CHAMPIONSHIP_ID}/create-match`)

  // Étape 1: date — "Maintenant"
  await page.getByRole('button', { name: 'Maintenant' }).click()
  await page.getByRole('button', { name: 'Suivant' }).click()

  // Étape 2: participants — le joueur connecté (player1) est auto-sélectionné
  await addParticipant(page, USERS.player3.displayName)
  const next = page.getByRole('button', { name: 'Suivant' })
  await expect(next).toBeEnabled()
  await next.click()

  // Étape 3: résultat — vainqueur + scores
  await page
    .getByRole('button', { name: new RegExp(USERS.player3.displayName) })
    .first()
    .click()
  const scores = page.getByRole('spinbutton')
  await scores.nth(0).fill('3')
  await scores.nth(1).fill('1')

  await page.getByRole('button', { name: 'Créer le match' }).click()

  // Après création: retour sur l'onglet classement du tournoi (championship)
  await expect(page).toHaveURL(new RegExp(`/tournaments/${CHAMPIONSHIP_ID}/standings`), {
    timeout: 15_000,
  })
})
