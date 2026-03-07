<template>
  <div
    class="bracket-match"
    :class="{ 'bracket-match--pending': !isClickable }"
    :tabindex="isClickable ? 0 : -1"
    @click="isClickable && emit('click', match.id)"
  >
    <table class="bracket-table">
      <caption class="bracket-caption">
        <time :datetime="match.playedAt?.toISOString()">
          {{ formatDate(match.playedAt) }}
        </time>
      </caption>
      <thead class="sr-only">
        <tr>
          <th>Équipe/Joueur</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody class="bracket-content">
        <tr
          v-for="side in match.sides"
          :key="`side-${side.id}`"
          class="bracket-team"
          :class="{
            'bracket-team--winner': isWinner(match, side),
            'bracket-team--loose': isWinner(match, side) === false,
          }"
        >
          <td class="bracket-country">
            <abbr class="bracket-code" :title="getEntryName(side.entryId)">
              {{ getEntryCode(side.entryId) }}
            </abbr>
          </td>
          <td class="bracket-score">
            <span class="bracket-number">{{
              match.status === 'scheduled' ? '-' : side.score
            }}</span>
            <span
              v-if="bracketType === 'winners' && isFinal && isWinner(match, side)"
              class="bracket-medal bracket-medal--gold fa fa-trophy"
              aria-label="Médaille d'or"
            ></span>
            <span
              v-else-if="bracketType === 'winners' && isFinal && !isWinner(match, side)"
              class="bracket-medal bracket-medal--silver fa fa-trophy"
              aria-label="Médaille d'argent"
            ></span>
            <span
              v-else-if="bracketType === 'bronze' && isWinner(match, side)"
              class="bracket-medal bracket-medal--bronze fa fa-trophy"
              aria-label="Médaille de bronze"
            ></span>
          </td>
        </tr>
        <tr
          v-for="n in Math.max(0, 2 - (match.sides?.length || 0))"
          :key="`placeholder-${n}`"
          class="bracket-team"
        >
          <td class="bracket-country">
            <abbr class="bracket-code"><i class="fas fa-user-clock"></i></abbr>
          </td>
          <td class="bracket-score">
            <span class="bracket-number">-</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ClientMatchModel, MatchSideModel, ClientBracketSeed } from '@skill-arena/shared'

interface Props {
  match: ClientMatchModel
  roundName: string
  bracketType: 'winners' | 'losers' | 'bronze'
  isFinal?: boolean
  seeds: ClientBracketSeed[]
}

const props = defineProps<Props>()
const emit = defineEmits<{ click: [matchId: string] }>()

const isClickable = computed(() => (props.match.sides?.length ?? 0) >= 2)

function getEntryName(entryId: string): string {
  const seed = props.seeds.find((s) => s.entryId === entryId)
  if (!seed?.entry) return 'Inconnu'

  if (seed.entry.entryType === 'TEAM' && seed.entry.team) {
    return seed.entry.team.name
  }

  if (seed.entry.entryType === 'PLAYER' && seed.entry.players?.length > 0) {
    return seed.entry.players[0].player.shortName
  }

  return 'Inconnu'
}

function getEntryCode(entryId: string): string {
  return getEntryName(entryId).toUpperCase()
}

function isWinner(match: ClientMatchModel, side: MatchSideModel): boolean | null {
  if (match.status !== 'confirmed' && match.status !== 'finalized') {
    return null
  }
  if (match.winnerSide != null) {
    const letterOfSide = side.position === 0 ? 'A' : 'B'
    return match.winnerSide === letterOfSide
  }
  return null
}

function formatDate(date?: Date): string {
  if (!date) return 'À définir'
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.bracket-match {
  display: flex;
  width: 100%;
  background-color: var(--p-surface-800);
  padding: 1em;
  border: 1px solid transparent;
  border-radius: 0.1em;
  outline: none;
  cursor: pointer;
  transition:
    padding 0.2s ease-in-out,
    border 0.2s linear,
    box-shadow 0.15s ease;
}

.bracket-match--pending {
  cursor: default;
  opacity: 0.6;
}

.bracket-match:not(.bracket-match--pending):hover {
  box-shadow: 0 4px 16px rgba(33, 150, 243, 0.2);
  border-color: rgba(33, 150, 243, 0.4);
}

.bracket-match:active {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.bracket-match:focus {
  border-color: #2196f3;
}

@media (max-width: 24em) {
  .bracket-match {
    padding: 0.75em 0.5em;
  }
}

.bracket-table {
  width: 100%;
  border-collapse: collapse;
}

.bracket-caption {
  font-size: 0.8rem;
  color: var(--p-text-color);
  font-weight: 300;
  padding-bottom: 0.75em;
}

.bracket-team {
  display: flex;
  flex-direction: row-reverse;
  justify-content: space-between;
}

@media (min-width: 24em) {
  .bracket-team {
    flex-direction: column-reverse;
  }
}

@media (min-width: 38em) {
  .bracket-team {
    flex-direction: column-reverse;
  }
}

.bracket-country {
  font-size: 0.95rem;
  display: flex;
  margin-top: 0.5em;
  align-items: center;
}

@media (max-width: 24em) {
  .bracket-country {
    margin-top: 0;
  }
}

@media (min-width: 38em) and (max-width: 52em) {
  .bracket-country {
    display: flex;
    flex-direction: column;
  }
  .bracket-country .bracket-code {
    margin-top: 0.2em;
  }
}

.bracket-code {
  padding: 0 0.5em;
  color: var(--p-text-color);
  font-weight: 600;
  text-transform: uppercase;
  border: 0;
  text-decoration: none;
  cursor: help;
  transition: padding 0.2s ease-in-out;
}

@media (max-width: 24em) {
  .bracket-code {
    padding: 0 0.25em;
  }
}

@media (min-width: 38em) and (max-width: 52em) {
  .bracket-code {
    padding: 0;
  }
}

.bracket-score {
  display: flex;
  align-items: center;
}

.bracket-team:first-child .bracket-score {
  flex-direction: row-reverse;
  padding-left: 0.75em;
}

.bracket-team:last-child .bracket-score {
  padding-right: 0.75em;
}

.bracket-number {
  display: inline-block;
  padding: 0.2em 0.4em 0.2em;
  border-bottom: 0.075em solid transparent;
  font-size: 1rem;
  color: white;
}

.bracket-team--winner .bracket-number {
  background-color: var(--p-lime-700);
  border-color: var(--p-lime-700);
}

.bracket-team--loose .bracket-number {
  background-color: var(--p-red-600);
  border-color: var(--p-red-600);
}

.bracket-content {
  display: flex;
}

.bracket-content::after {
  content: ':';
  width: 1em;
  text-align: center;
  padding: 0.2em 0.1em;
}

@media (min-width: 38em) {
  .bracket-content::after {
    order: 1;
  }
}

.bracket-content .bracket-team:first-child {
  width: 50%;
  order: 0;
  text-align: right;
}

@media (min-width: 38em) and (max-width: 52em) {
  .bracket-content .bracket-team:first-child {
    align-items: flex-end;
  }
}

.bracket-content .bracket-team:first-child .bracket-country {
  order: 2;
  justify-content: flex-end;
}

@media (min-width: 24em) {
  .bracket-content .bracket-team:first-child .bracket-country {
    order: 0;
  }
}

@media (min-width: 38em) and (max-width: 52em) {
  .bracket-content .bracket-team:first-child .bracket-country {
    flex-direction: column-reverse;
    align-items: flex-end;
  }
}

.bracket-content .bracket-team:first-child .bracket-score {
  order: 0;
}

@media (min-width: 24em) {
  .bracket-content .bracket-team:first-child .bracket-score {
    order: 2;
  }
}

.bracket-content .bracket-team:last-child {
  width: 50%;
  order: 2;
  text-align: left;
}

@media (min-width: 38em) and (max-width: 52em) {
  .bracket-content .bracket-team:last-child {
    align-items: flex-start;
  }
}

@media (min-width: 38em) {
  .bracket-content .bracket-team:last-child .bracket-country {
    justify-content: flex-start;
  }
}

@media (min-width: 38em) and (max-width: 52em) {
  .bracket-content .bracket-team:last-child .bracket-country {
    align-items: flex-start;
  }
}

.bracket-content .bracket-team:last-child .bracket-code {
  order: 1;
}

.bracket-medal {
  margin: 0 0.5rem 0 0.5rem;
}

.bracket-medal--gold {
  color: #ffd700;
}

.bracket-medal--silver {
  color: #c0c0c0;
}

.bracket-medal--bronze {
  color: #cd7f32;
}
</style>
