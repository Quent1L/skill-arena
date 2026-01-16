<template>
  <div class="bracket-container">
    <div class="bracket-tournament tournament--rounded">
      <!-- Dynamically render winners bracket rounds -->
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
            <div class="bracket-match" tabindex="0">
              <table class="bracket-table">
                <caption class="bracket-caption">
                  <time :datetime="matchData.match.playedAt?.toISOString()">
                    {{ formatDate(matchData.match.playedAt) }}
                  </time>
                </caption>
                <thead class="sr-only">
                  <tr>
                    <th>Team/Player</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody class="bracket-content">
                  <tr
                    v-for="(side, index) in matchData.match.sides"
                    :key="`side-${side.id}`"
                    class="bracket-team"
                    :class="{ 'bracket-team--winner': isWinner(matchData.match, side) }"
                  >
                    <td class="bracket-country">
                      <abbr
                        class="bracket-code"
                        :title="getEntryName(side.entryId)"
                      >
                        {{ getEntryCode(side.entryId) }}
                      </abbr>
                    </td>
                    <td class="bracket-score">
                      <span class="bracket-number">{{ side.score || '-' }}</span>
                      <span
                        v-if="isWinner(matchData.match, side) && round.roundName === 'Final'"
                        class="bracket-medal bracket-medal--gold fa fa-trophy"
                        aria-label="Gold medal"
                      ></span>
                      <span
                        v-else-if="!isWinner(matchData.match, side) && round.roundName === 'Final'"
                        class="bracket-medal bracket-medal--silver fa fa-trophy"
                        aria-label="Silver medal"
                      ></span>
                    </td>
                  </tr>
                  <!-- Show placeholder rows if match has no sides yet -->
                  <tr
                    v-for="n in Math.max(0, 2 - (matchData.match.sides?.length || 0))"
                    :key="`placeholder-${n}`"
                    class="bracket-team"
                  >
                    <td class="bracket-country">
                      <abbr class="bracket-code">TBD</abbr>
                    </td>
                    <td class="bracket-score">
                      <span class="bracket-number">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </li>
        </ul>
      </div>

      <!-- Bronze Medal Match (if exists) -->
      <div
        v-if="bronzeRound"
        class="bracket-round bracket-round--bronze"
      >
        <h3 class="bracket-round-title">{{ bronzeRound.roundName }}</h3>
        <ul class="bracket-list">
          <li
            v-for="matchData in getMatchesForRound(bronzeRound.id)"
            :key="`match-${matchData.match.id}`"
            class="bracket-item"
          >
            <div class="bracket-match" tabindex="0">
              <table class="bracket-table">
                <caption class="bracket-caption">
                  <time :datetime="matchData.match.playedAt?.toISOString()">
                    {{ formatDate(matchData.match.playedAt) }}
                  </time>
                </caption>
                <thead class="sr-only">
                  <tr>
                    <th>Team/Player</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody class="bracket-content">
                  <tr
                    v-for="side in matchData.match.sides"
                    :key="`side-${side.id}`"
                    class="bracket-team"
                    :class="{ 'bracket-team--winner': isWinner(matchData.match, side) }"
                  >
                    <td class="bracket-country">
                      <abbr
                        class="bracket-code"
                        :title="getEntryName(side.entryId)"
                      >
                        {{ getEntryCode(side.entryId) }}
                      </abbr>
                    </td>
                    <td class="bracket-score">
                      <span class="bracket-number">{{ side.score || '-' }}</span>
                      <span
                        v-if="isWinner(matchData.match, side)"
                        class="bracket-medal bracket-medal--bronze fa fa-trophy"
                        aria-label="Bronze medal"
                      ></span>
                    </td>
                  </tr>
                  <tr
                    v-for="n in Math.max(0, 2 - (matchData.match.sides?.length || 0))"
                    :key="`placeholder-${n}`"
                    class="bracket-team"
                  >
                    <td class="bracket-country">
                      <abbr class="bracket-code">TBD</abbr>
                    </td>
                    <td class="bracket-score">
                      <span class="bracket-number">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </li>
        </ul>
      </div>

      <!-- Losers Bracket (for double elimination) -->
      <div
        v-for="round in losersRounds"
        :key="`losers-${round.id}`"
        class="bracket-round bracket-round--losers"
      >
        <h3 class="bracket-round-title">{{ round.roundName }}</h3>
        <ul class="bracket-list">
          <li
            v-for="matchData in getMatchesForRound(round.id)"
            :key="`match-${matchData.match.id}`"
            class="bracket-item"
          >
            <div class="bracket-match" tabindex="0">
              <table class="bracket-table">
                <caption class="bracket-caption">
                  <time :datetime="matchData.match.playedAt?.toISOString()">
                    {{ formatDate(matchData.match.playedAt) }}
                  </time>
                </caption>
                <thead class="sr-only">
                  <tr>
                    <th>Team/Player</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody class="bracket-content">
                  <tr
                    v-for="side in matchData.match.sides"
                    :key="`side-${side.id}`"
                    class="bracket-team"
                    :class="{ 'bracket-team--winner': isWinner(matchData.match, side) }"
                  >
                    <td class="bracket-country">
                      <abbr
                        class="bracket-code"
                        :title="getEntryName(side.entryId)"
                      >
                        {{ getEntryCode(side.entryId) }}
                      </abbr>
                    </td>
                    <td class="bracket-score">
                      <span class="bracket-number">{{ side.score || '-' }}</span>
                    </td>
                  </tr>
                  <tr
                    v-for="n in Math.max(0, 2 - (matchData.match.sides?.length || 0))"
                    :key="`placeholder-${n}`"
                    class="bracket-team"
                  >
                    <td class="bracket-country">
                      <abbr class="bracket-code">TBD</abbr>
                    </td>
                    <td class="bracket-score">
                      <span class="bracket-number">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ClientBracketData, ClientBracketRound, ClientBracketMatchWithMetadata } from '@skill-arena/shared'
import type { ClientMatch, ClientMatchSide } from '@skill-arena/shared'

interface Props {
  bracketData: ClientBracketData
}

const props = defineProps<Props>()

// Organize rounds by bracket type
const winnersRounds = computed(() =>
  props.bracketData.rounds
    .filter(r => r.bracketType === 'winners')
    .sort((a, b) => a.roundNumber - b.roundNumber)
)

const losersRounds = computed(() =>
  props.bracketData.rounds
    .filter(r => r.bracketType === 'losers')
    .sort((a, b) => a.roundNumber - b.roundNumber)
)

const bronzeRound = computed(() =>
  props.bracketData.rounds.find(r => r.bracketType === 'bronze')
)

// Get matches for a specific round
function getMatchesForRound(roundId: string): ClientBracketMatchWithMetadata[] {
  return props.bracketData.matches
    .filter(m => m.round.id === roundId)
    .sort((a, b) => a.metadata.matchNumber - b.metadata.matchNumber)
}

// Get entry name from seed data
function getEntryName(entryId: string): string {
  const seed = props.bracketData.seeds.find(s => s.entryId === entryId)
  return seed?.entry?.name || 'Unknown'
}

// Get entry code (first 3-4 letters of name)
function getEntryCode(entryId: string): string {
  const name = getEntryName(entryId)
  return name.substring(0, 4).toUpperCase()
}

// Check if a side is the winner
function isWinner(match: ClientMatch, side: ClientMatchSide): boolean {
  if (match.status !== 'confirmed' && match.status !== 'finalized') {
    return false
  }
  return match.winnerId === side.entryId
}

// Get round class for styling
function getRoundClass(round: ClientBracketRound): string {
  const name = round.roundName.toLowerCase()
  if (name.includes('final') && !name.includes('semi')) return 'gold'
  if (name.includes('semi')) return 'semifinals'
  if (name.includes('quarter')) return 'quarterfinals'
  return 'round'
}

// Format date
function formatDate(date?: Date): string {
  if (!date) return 'TBD'
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
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
    border 0.2s linear;
}

.bracket-match:focus {
  border-color: #2196f3;
}

.bracket-match::before,
.bracket-match::after {
  transition: all 0.2s linear;
}

@media (max-width: 24em) {
  .bracket-match {
    padding: 0.75em 0.5em;
  }
}

@media (min-width: 38em) {
  .bracket-match::before,
  .bracket-match::after {
    position: absolute;
    left: 0;
    z-index: 1;
    content: '';
    display: block;
    width: 1em;
    height: 10%;
    border-left: 2px solid #9e9e9e;
  }
  .bracket-match::before {
    bottom: 50%;
    border-bottom: 2px solid #9e9e9e;
    transform: translate(0, 1px);
  }
  .tournament--rounded .bracket-match::before {
    border-bottom-left-radius: 0.6em;
  }
  .bracket-match::after {
    top: 50%;
    border-top: 2px solid #9e9e9e;
    transform: translate(0, -1px);
  }
  .tournament--rounded .bracket-match::after {
    border-top-left-radius: 0.6em;
  }
}

@media (min-width: 72em) {
  .bracket-match::before,
  .bracket-match::after {
    width: 1.5em;
  }
  .bracket-match::before {
    transform: translate(0, 1px);
  }
  .bracket-match::after {
    transform: translate(0, -1px);
  }
}

.bracket-round:last-child .bracket-match::before,
.bracket-round:last-child .bracket-match::after {
  border-left: 0;
}

.bracket-round:last-child .bracket-match::before {
  border-bottom-left-radius: 0;
}

.bracket-round:last-child .bracket-match::after {
  display: none;
}

.bracket-round:first-child .bracket-match::before,
.bracket-round:first-child .bracket-match::after {
  display: none;
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
  background-color: var(--p-red-100);
  border-color: var(--p-red100);
  color: black;
}

.bracket-team--winner .bracket-number {
  background-color: var(--p-yellow-100);
  border-color: var(--p-yellow-100);
}

.bracket-medal {
  padding: 0 0.5em;
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
