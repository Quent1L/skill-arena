<template>
  <div class="bracket-container">
    <div class="bracket-sections">
      <!-- Section principale (winners) -->
      <div class="bracket-section">
        <h4 class="bracket-section-title">Tableau principal</h4>
        <div class="bracket-tournament tournament--rounded">
          <div
            v-for="round in winnersRounds"
            :key="`winners-${round.id}`"
            class="bracket-round"
            :class="`bracket-round--${getRoundClass(round)}`"
          >
            <h3 class="bracket-round-title">{{ round.roundName }}</h3>
            <ul class="bracket-list">
              <li
                v-for="matchData in getMatchesForRound(round.id)"
                :key="`match-${matchData.match.id}`"
                class="bracket-item"
              >
                <BracketMatchCard
                  :match="matchData.match"
                  :round-name="round.roundName"
                  bracket-type="winners"
                  :is-final="round.id === finalRoundId"
                  :seeds="bracketData.seeds"
                  @click="goToMatch"
                />
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Match pour la 3ème place (si applicable) -->
      <div v-if="bronzeRound" class="bracket-section">
        <h4 class="bracket-section-title">Match pour la 3ème place</h4>
        <div class="bracket-tournament tournament--rounded">
          <div class="bracket-round bracket-round--bronze">
            <ul class="bracket-list">
              <li
                v-for="matchData in getMatchesForRound(bronzeRound.id)"
                :key="`match-${matchData.match.id}`"
                class="bracket-item"
              >
                <BracketMatchCard
                  :match="matchData.match"
                  :round-name="bronzeRound.roundName"
                  bracket-type="bronze"
                  :seeds="bracketData.seeds"
                  @click="goToMatch"
                />
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Tableau des perdants (double élimination) -->
      <div v-if="losersRounds.length > 0" class="bracket-section">
        <h4 class="bracket-section-title">Tableau des perdants</h4>
        <div class="bracket-tournament tournament--rounded">
          <div
            v-for="round in losersRounds"
            :key="`losers-${round.id}`"
            class="bracket-round bracket-round--losers"
            :class="{
              'bracket-round--passthrough': isLoserPassthroughRound(round.id),
              'bracket-round--from-passthrough': isLoserFromPassthrough(round.id),
            }"
          >
            <h3 class="bracket-round-title">{{ round.roundName }}</h3>
            <ul class="bracket-list">
              <li
                v-for="matchData in getMatchesForRound(round.id)"
                :key="`match-${matchData.match.id}`"
                class="bracket-item"
              >
                <BracketMatchCard
                  :match="matchData.match"
                  :round-name="round.roundName"
                  bracket-type="losers"
                  :seeds="bracketData.seeds"
                  @click="goToMatch"
                />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type {
  ClientBracketData,
  ClientBracketRound,
  ClientBracketMatchWithMetadata,
} from '@skill-arena/shared'
import BracketMatchCard from '@/components/bracket/BracketMatchCard.vue'

interface Props {
  bracketData: ClientBracketData
}

const props = defineProps<Props>()
const router = useRouter()

const winnersRounds = computed(() =>
  props.bracketData.rounds
    .filter((r) => r.bracketType === 'winners')
    .sort((a, b) => a.roundNumber - b.roundNumber),
)

const finalRoundId = computed(() => winnersRounds.value.at(-1)?.id)

const losersRounds = computed(() =>
  props.bracketData.rounds
    .filter((r) => r.bracketType === 'losers')
    .sort((a, b) => a.roundNumber - b.roundNumber),
)

const bronzeRound = computed(() => props.bracketData.rounds.find((r) => r.bracketType === 'bronze'))

function getMatchesForRound(roundId: string): ClientBracketMatchWithMetadata[] {
  return props.bracketData.matches
    .filter((m) => m.round.id === roundId)
    .sort((a, b) => a.metadata.matchNumber - b.metadata.matchNumber)
}

function getRoundClass(round: ClientBracketRound): string {
  const name = round.roundName.toLowerCase()
  if (name === 'finale' || name === 'grande finale') return 'gold'
  if (name.startsWith('demi')) return 'semifinals'
  if (name.startsWith('quart')) return 'quarterfinals'
  return 'round'
}

function isLoserPassthroughRound(roundId: string): boolean {
  const idx = losersRounds.value.findIndex((r) => r.id === roundId)
  const nextRound = losersRounds.value[idx + 1]
  if (idx < 0 || !nextRound) return false
  return getMatchesForRound(roundId).length === getMatchesForRound(nextRound.id).length
}

function isLoserFromPassthrough(roundId: string): boolean {
  const idx = losersRounds.value.findIndex((r) => r.id === roundId)
  if (idx <= 0) return false
  const prevRound = losersRounds.value[idx - 1]
  return prevRound ? isLoserPassthroughRound(prevRound.id) : false
}

function goToMatch(matchId: string): void {
  router.push(`/matches/${matchId}`)
}
</script>

<style scoped>
/* Keep all existing styles from the original component */
.bracket-container {
  width: 90%;
  min-width: 18em;
  margin: 20px auto;
  font-family: 'Work Sans', 'Helvetica Neue', Arial, sans-serif;
  font-size: 15px;
}

@media (min-width: 38em) {
  .bracket-container {
    font-size: 14px;
  }
}
@media (min-width: 52em) {
  .bracket-container {
    font-size: 15px;
  }
}
@media (min-width: 72em) {
  .bracket-container {
    font-size: 16px;
  }
}

.bracket-sections {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.bracket-section-title {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin-bottom: 0.75rem;
  padding-left: 0.5rem;
  border-left: 3px solid var(--p-primary-color);
}

.bracket-tournament {
  display: flex;
  flex-direction: column;
}

@media (min-width: 38em) {
  .bracket-tournament {
    flex-direction: row;
  }
}

.bracket-round {
  display: block;
  margin-left: -3px;
  flex: 1;
}

.bracket-round-title {
  color: var(--p-text-color);
  font-size: 0.95rem;
  font-weight: 400;
  text-align: center;
  font-style: italic;
  margin-bottom: 0.5em;
}

.bracket-list {
  display: flex;
  flex-direction: column;
  flex-flow: row wrap;
  justify-content: center;
  height: 100%;
  min-height: 100%;
  border-bottom: 1px dashed #e5e5e5;
  padding-bottom: 2em;
  margin-bottom: 2em;
  transition:
    padding 0.2s ease-in-out,
    margin 0.2s ease-in-out;
  list-style: none;
  padding-left: 0;
}

@media (max-width: 24em) {
  .bracket-list {
    padding-bottom: 1em;
    margin-bottom: 1em;
  }
}

@media (min-width: 38em) {
  .bracket-list {
    margin-bottom: 0;
    padding-bottom: 0;
    border-right: 1px dashed #e5e5e5;
    border-bottom: 0;
  }
}

.bracket-round:last-child .bracket-list {
  border: 0;
}

.bracket-item {
  display: flex;
  flex: 0 1 auto;
  justify-content: center;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
  padding: 2% 0;
  width: 48%;
  transition: padding 0.2s linear;
}

.bracket-item:nth-child(odd) {
  margin-right: 2%;
}

.bracket-item:nth-child(even) {
  margin-left: 2%;
}

.bracket-item::after {
  transition: width 0.2s linear;
}

@media (max-width: 24em) {
  .bracket-item {
    width: 100%;
  }
  .bracket-item:nth-child(odd),
  .bracket-item:nth-child(even) {
    margin-left: 0;
    margin-right: 0;
  }
}

@media (min-width: 38em) {
  .bracket-item {
    padding: 0.5em 1em;
    width: 100%;
  }
  .bracket-item:nth-child(odd),
  .bracket-item:nth-child(even) {
    margin: 0;
  }
  .bracket-item::after {
    position: absolute;
    right: 0;
    content: '';
    display: block;
    width: 1em;
    height: 45%;
    border-right: 2px solid #9e9e9e;
  }
  .bracket-item:nth-child(odd)::after {
    top: 50%;
    border-top: 2px solid #9e9e9e;
    transform: translateY(-1px);
  }
  .tournament--rounded .bracket-item:nth-child(odd)::after {
    border-top-right-radius: 0.6em;
  }
  .bracket-item:nth-child(even)::after {
    bottom: 50%;
    border-bottom: 2px solid #9e9e9e;
    transform: translateY(1px);
  }
  .tournament--rounded .bracket-item:nth-child(even)::after {
    border-bottom-right-radius: 0.6em;
  }
  .bracket-round:first-child .bracket-item {
    padding-left: 0;
  }
  .bracket-round:last-child .bracket-item {
    padding-right: 0;
  }
  .bracket-round:last-child .bracket-item::after {
    display: none;
  }
  .bracket-round:nth-last-child(2) .bracket-item::after {
    border-radius: 0;
    border-right: 0;
  }
}

@media (min-width: 72em) {
  .bracket-item {
    padding: 0.5em 1.5em;
  }
  .bracket-item::after {
    width: 1.5em;
  }
}

/* Bracket match connector pseudo-elements (context-dependent, must be here with :deep) */
:deep(.bracket-match)::before,
:deep(.bracket-match)::after {
  transition: all 0.2s linear;
}

@media (min-width: 38em) {
  :deep(.bracket-match)::before,
  :deep(.bracket-match)::after {
    position: absolute;
    left: 0;
    z-index: 1;
    content: '';
    display: block;
    width: 1em;
    height: 10%;
    border-left: 2px solid #9e9e9e;
  }
  :deep(.bracket-match)::before {
    bottom: 50%;
    border-bottom: 2px solid #9e9e9e;
    transform: translate(0, 1px);
  }
  .tournament--rounded :deep(.bracket-match)::before {
    border-bottom-left-radius: 0.6em;
  }
  :deep(.bracket-match)::after {
    top: 50%;
    border-top: 2px solid #9e9e9e;
    transform: translate(0, -1px);
  }
  .tournament--rounded :deep(.bracket-match)::after {
    border-top-left-radius: 0.6em;
  }
}

@media (min-width: 72em) {
  :deep(.bracket-match)::before,
  :deep(.bracket-match)::after {
    width: 1.5em;
  }
  :deep(.bracket-match)::before {
    transform: translate(0, 1px);
  }
  :deep(.bracket-match)::after {
    transform: translate(0, -1px);
  }
}

.bracket-round:last-child :deep(.bracket-match)::before,
.bracket-round:last-child :deep(.bracket-match)::after {
  border-left: 0;
}

.bracket-round:last-child :deep(.bracket-match)::before {
  border-bottom-left-radius: 0;
}

.bracket-round:last-child :deep(.bracket-match)::after {
  display: none;
}

.bracket-round:first-child :deep(.bracket-match)::before,
.bracket-round:first-child :deep(.bracket-match)::after {
  display: none;
}

/* Losers passthrough rounds: straight horizontal connectors (1:1 mapping) */
@media (min-width: 38em) {
  /* Right side of passthrough round: flat line centered instead of angled bracket */
  .bracket-round--passthrough .bracket-item::after {
    height: 0;
    border-right: none;
    border-top: 2px solid #9e9e9e;
    top: 50%;
    bottom: auto;
  }
  .bracket-round--passthrough .bracket-item:nth-child(even)::after {
    border-bottom: none;
    border-top: 2px solid #9e9e9e;
    top: 50%;
    bottom: auto;
  }
  /* Remove rounded corners for passthrough connectors */
  .tournament--rounded .bracket-round--passthrough .bracket-item:nth-child(odd)::after,
  .tournament--rounded .bracket-round--passthrough .bracket-item:nth-child(even)::after {
    border-radius: 0;
  }

  /* Left side of round receiving from passthrough: single centered connector */
  .bracket-round--from-passthrough :deep(.bracket-match)::before {
    display: none;
  }
  .bracket-round--from-passthrough :deep(.bracket-match)::after {
    height: 0;
    border-left: none;
    top: 50%;
    transform: translate(0, -1px);
  }
  .tournament--rounded .bracket-round--from-passthrough :deep(.bracket-match)::after {
    border-top-left-radius: 0;
  }
}

</style>
