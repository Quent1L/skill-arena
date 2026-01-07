<template>
  <div class="custom-bracket">
    <!-- Winner Bracket -->
    <div v-if="winnerBracket.length > 0" class="bracket-section">
      <h3 v-if="hasLoserBracket" class="bracket-title">Winner Bracket</h3>
      <div class="bracket-scroll-container">
        <div class="bracket-rounds">
          <div
            v-for="(round, roundIndex) in winnerBracket"
            :key="`winner-${roundIndex}`"
            class="bracket-round"
          >
            <div class="round-header">
              <h4>{{ getRoundName(roundIndex, winnerBracket.length, 'winner') }}</h4>
            </div>
            <div class="round-matches">
              <div
                v-for="(match, matchIndex) in round"
                :key="match.id"
                class="match-wrapper"
                :style="getMatchWrapperStyle(roundIndex, matchIndex, round.length)"
              >
                <div
                  class="match-card"
                  :class="{ 'clickable': match.id }"
                  @click="handleMatchClick(match)"
                >
                  <!-- Opponent 1 -->
                  <div
                    class="opponent"
                    :class="{ 'winner': isWinner(match, 1) }"
                  >
                    <span class="opponent-name">{{ getParticipantName(match.opponent1) }}</span>
                    <span class="opponent-score">{{ getScore(match.opponent1) }}</span>
                  </div>
                  
                  <!-- Opponent 2 -->
                  <div
                    class="opponent"
                    :class="{ 'winner': isWinner(match, 2) }"
                  >
                    <span class="opponent-name">{{ getParticipantName(match.opponent2) }}</span>
                    <span class="opponent-score">{{ getScore(match.opponent2) }}</span>
                  </div>
                </div>

                <!-- Connector to next round -->
                <svg
                  v-if="roundIndex < winnerBracket.length - 1"
                  class="connector"
                  :class="{ 'connector-top': matchIndex % 2 === 0, 'connector-bottom': matchIndex % 2 === 1 }"
                >
                  <path
                    :d="getConnectorPath(matchIndex)"
                    fill="none"
                    stroke="var(--bracket-border-color)"
                    stroke-width="2"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loser Bracket (for double elimination) -->
    <div v-if="hasLoserBracket" class="bracket-section loser-bracket-section">
      <h3 class="bracket-title">Loser Bracket</h3>
      <div class="bracket-scroll-container">
        <div class="bracket-rounds">
          <div
            v-for="(round, roundIndex) in loserBracket"
            :key="`loser-${roundIndex}`"
            class="bracket-round"
          >
            <div class="round-header">
              <h4>{{ getRoundName(roundIndex, loserBracket.length, 'loser') }}</h4>
            </div>
            <div class="round-matches">
              <div
                v-for="(match, matchIndex) in round"
                :key="match.id"
                class="match-wrapper"
                :style="getMatchWrapperStyle(roundIndex, matchIndex, round.length)"
              >
                <div
                  class="match-card"
                  :class="{ 'clickable': match.id }"
                  @click="handleMatchClick(match)"
                >
                  <!-- Opponent 1 -->
                  <div
                    class="opponent"
                    :class="{ 'winner': isWinner(match, 1) }"
                  >
                    <span class="opponent-name">{{ getParticipantName(match.opponent1) }}</span>
                    <span class="opponent-score">{{ getScore(match.opponent1) }}</span>
                  </div>
                  
                  <!-- Opponent 2 -->
                  <div
                    class="opponent"
                    :class="{ 'winner': isWinner(match, 2) }"
                  >
                    <span class="opponent-name">{{ getParticipantName(match.opponent2) }}</span>
                    <span class="opponent-score">{{ getScore(match.opponent2) }}</span>
                  </div>
                </div>

                <!-- Connector to next round -->
                <svg
                  v-if="roundIndex < loserBracket.length - 1"
                  class="connector"
                  :class="{ 'connector-top': matchIndex % 2 === 0, 'connector-bottom': matchIndex % 2 === 1 }"
                >
                  <path
                    :d="getConnectorPath(matchIndex)"
                    fill="none"
                    stroke="var(--bracket-border-color)"
                    stroke-width="2"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Grand Final (for double elimination) -->
    <div v-if="grandFinalMatches.length > 0" class="bracket-section grand-final-section">
      <h3 class="bracket-title">Grand Final</h3>
      <div class="bracket-scroll-container">
        <div class="bracket-rounds">
          <div class="bracket-round">
            <div class="round-header">
              <h4>Final</h4>
            </div>
            <div class="round-matches">
              <div
                v-for="match in grandFinalMatches"
                :key="match.id"
                class="match-wrapper grand-final-match"
              >
                <div
                  class="match-card"
                  :class="{ 'clickable': match.id }"
                  @click="handleMatchClick(match)"
                >
                  <!-- Opponent 1 -->
                  <div
                    class="opponent"
                    :class="{ 'winner': isWinner(match, 1) }"
                  >
                    <span class="opponent-name">{{ getParticipantName(match.opponent1) }}</span>
                    <span class="opponent-score">{{ getScore(match.opponent1) }}</span>
                  </div>
                  
                  <!-- Opponent 2 -->
                  <div
                    class="opponent"
                    :class="{ 'winner': isWinner(match, 2) }"
                  >
                    <span class="opponent-name">{{ getParticipantName(match.opponent2) }}</span>
                    <span class="opponent-score">{{ getScore(match.opponent2) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Match, Participant } from 'brackets-model'

interface Props {
  matches: Match[]
  participants: Participant[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  matchClick: [match: Match]
}>()

// Organize matches by group (winner/loser/grand_final)
const winnerBracket = computed(() => organizeBracket('winner_bracket'))
const loserBracket = computed(() => organizeBracket('loser_bracket'))
const grandFinalMatches = computed(() => {
  return props.matches.filter(m => m.group_id && getGroupNumber(m) === 3) || []
})

const hasLoserBracket = computed(() => loserBracket.value.length > 0)

function getGroupNumber(match: Match): number {
  // Group IDs in brackets-model: 1 = winner bracket, 2 = loser bracket, 3 = grand final
  // We need to extract the number from the group_id
  if (typeof match.group_id === 'number') return match.group_id
  return 1
}

function organizeBracket(bracketType: 'winner_bracket' | 'loser_bracket'): Match[][] {
  const groupId = bracketType === 'winner_bracket' ? 1 : 2
  
  // Filter matches by group
  const bracketMatches = props.matches.filter(m => {
    const gid = getGroupNumber(m)
    return gid === groupId
  })

  if (bracketMatches.length === 0) return []

  // Group by round
  const roundsMap = new Map<number, Match[]>()
  bracketMatches.forEach(match => {
    // Convert Id type (string | number) to number
    const roundNum = typeof match.round_id === 'number' ? match.round_id : (typeof match.round_id === 'string' ? parseInt(match.round_id, 10) : 0)
    if (!roundsMap.has(roundNum)) {
      roundsMap.set(roundNum, [])
    }
    roundsMap.get(roundNum)!.push(match)
  })

  // Sort rounds and convert to array
  const sortedRounds = Array.from(roundsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([_, matches]) => matches.sort((a, b) => (a.number || 0) - (b.number || 0)))

  return sortedRounds
}

function getParticipantName(opponent: any): string {
  if (!opponent || opponent.id === null || opponent.id === undefined) {
    return 'TBD'
  }
  
  const participant = props.participants.find(p => p.id === opponent.id)
  return participant?.name || 'TBD'
}

function getScore(opponent: any): string {
  if (!opponent || opponent.score === null || opponent.score === undefined) {
    return '-'
  }
  return String(opponent.score)
}

function isWinner(match: Match, opponentNum: 1 | 2): boolean {
  const opponent = opponentNum === 1 ? match.opponent1 : match.opponent2
  if (!opponent || !match.opponent1 || !match.opponent2) return false
  
  // Check if this opponent has a higher score
  const score1 = match.opponent1.score ?? 0
  const score2 = match.opponent2.score ?? 0
  
  if (score1 === score2) return false
  
  return opponentNum === 1 ? score1 > score2 : score2 > score1
}

function getRoundName(roundIndex: number, totalRounds: number, bracketType: 'winner' | 'loser'): string {
  const roundsFromEnd = totalRounds - roundIndex
  
  if (bracketType === 'winner') {
    if (roundsFromEnd === 1) return 'Final'
    if (roundsFromEnd === 2) return 'Semi-Final'
    if (roundsFromEnd === 3) return 'Quarter-Final'
    return `Round ${roundIndex + 1}`
  } else {
    return `LB Round ${roundIndex + 1}`
  }
}

function getMatchWrapperStyle(roundIndex: number, matchIndex: number, totalMatches: number) {
  // For a proper tournament bracket, each match should be centered between
  // the two matches from the previous round that feed into it
  
  // Actual match card height is approximately 100px (2 opponents * 50px each)
  const matchCardHeight = 100
  
  // Base gap between matches in round 0 (first round)
  const baseGap = 20
  
  if (roundIndex === 0) {
    // First round: simple spacing
    if (matchIndex === 0) {
      return { marginTop: '0px' }
    } else {
      return { marginTop: `${baseGap}px` }
    }
  } else {
    // Subsequent rounds: each match should be centered between two matches from previous round
    
    // Calculate positions in previous round
    // Match 1: top = 0, center = matchCardHeight/2
    // Match 2: top = matchCardHeight + baseGap, center = matchCardHeight + baseGap + matchCardHeight/2
    
    // For round 1:
    // Match 1 center: 50px
    // Match 2 center: 100 + 20 + 50 = 170px
    // Midpoint: (50 + 170) / 2 = 110px
    // This match should have its center at 110px, so top = 110 - 50 = 60px
    
    const prevRoundGap = baseGap * Math.pow(2, roundIndex - 1)
    const match1Center = matchCardHeight / 2
    const match2Center = matchCardHeight + prevRoundGap + matchCardHeight / 2
    const midpoint = (match1Center + match2Center) / 2
    const thisMatchTop = midpoint - matchCardHeight / 2
    
    // For subsequent matches in this round, they follow the same pattern
    // but offset by the full height of previous match pairs
    const gapBetweenMatchesInThisRound = (matchCardHeight + prevRoundGap) * 2
    
    if (matchIndex === 0) {
      return { marginTop: `${thisMatchTop}px` }
    } else {
      return { marginTop: `${gapBetweenMatchesInThisRound}px` }
    }
  }
}

function getConnectorPath(matchIndex: number): string {
  // Create path for connector line
  // The connectors should go from the center of a match to the center of the next round's match
  const isTop = matchIndex % 2 === 0
  const matchCardHeight = 100
  const centerY = matchCardHeight / 2 // Center of the match card
  
  if (isTop) {
    // Top match: line goes from center right, then down to meet the next match
    return `M 0 ${centerY} L 30 ${centerY} L 30 ${matchCardHeight + 10}`
  } else {
    // Bottom match: line goes from center right, then up to meet the next match  
    return `M 0 ${centerY} L 30 ${centerY} L 30 ${-10}`
  }
}

function handleMatchClick(match: Match) {
  if (match.id) {
    emit('matchClick', match)
  }
}
</script>

<style scoped>
.custom-bracket {
  width: 100%;
  min-height: 500px;
  background: var(--bracket-bg-color, var(--surface-ground));
  color: var(--bracket-text-color, var(--text-color));
  padding: 1rem;
}

.bracket-section {
  margin-bottom: 3rem;
}

.bracket-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--bracket-text-color, var(--text-color));
}

.bracket-scroll-container {
  overflow-x: auto;
  overflow-y: auto;
  max-height: 800px;
  padding: 1rem 0;
}

.bracket-rounds {
  display: flex;
  gap: 4rem;
  min-width: min-content;
  padding: 1rem;
}

.bracket-round {
  display: flex;
  flex-direction: column;
  min-width: 250px;
}

.round-header {
  margin-bottom: 1rem;
  text-align: center;
}

.round-header h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--bracket-text-color, var(--text-color));
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.round-matches {
  display: flex;
  flex-direction: column;
  flex: 1;
  justify-content: flex-start;
}

.match-wrapper {
  position: relative;
  margin-bottom: 1rem;
}

.match-wrapper.grand-final-match {
  margin-top: 2rem;
  margin-left: auto;
  margin-right: auto;
}

.match-card {
  background: var(--bracket-card-bg-color, var(--surface-card));
  border: 2px solid var(--bracket-border-color, var(--surface-border));
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.match-card.clickable {
  cursor: pointer;
}

.match-card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: var(--primary-color);
}

.opponent {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--bracket-border-color, var(--surface-border));
  transition: background-color 0.2s ease;
}

.opponent:last-child {
  border-bottom: none;
}

.opponent.winner {
  background: var(--primary-color);
  color: white;
  font-weight: 600;
}

.opponent-name {
  flex: 1;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opponent-score {
  font-size: 1rem;
  font-weight: 600;
  margin-left: 1rem;
  min-width: 2rem;
  text-align: right;
}

.connector {
  position: absolute;
  right: -30px;
  width: 30px;
  height: 240px;
  pointer-events: none;
}

.connector.connector-top {
  top: 0;
}

.connector.connector-bottom {
  top: 0;
}

.loser-bracket-section {
  border-top: 3px solid var(--bracket-border-color, var(--surface-border));
  padding-top: 2rem;
}

.loser-bracket-section .bracket-title {
  color: var(--orange-500);
}

.grand-final-section {
  border-top: 3px solid var(--primary-color);
  padding-top: 2rem;
}

.grand-final-section .bracket-title {
  color: var(--primary-color);
  text-align: center;
}

/* Scrollbar styling */
.bracket-scroll-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.bracket-scroll-container::-webkit-scrollbar-track {
  background: var(--surface-ground);
  border-radius: 4px;
}

.bracket-scroll-container::-webkit-scrollbar-thumb {
  background: var(--surface-border);
  border-radius: 4px;
}

.bracket-scroll-container::-webkit-scrollbar-thumb:hover {
  background: var(--primary-color);
}
</style>
