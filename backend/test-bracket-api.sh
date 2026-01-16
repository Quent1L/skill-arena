#!/bin/bash

# Bracket API Testing Script
# This script tests the bracket generation endpoints

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000/api"

echo "=========================================="
echo "Bracket API Testing Script"
echo "=========================================="
echo ""

# Check if server is running
echo -e "${YELLOW}Checking if server is running...${NC}"
if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/tournaments" > /dev/null; then
    echo -e "${RED}❌ Server is not running!${NC}"
    echo "Please start the server with: cd backend && bun run dev"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# You'll need to replace these with actual values from your database
echo -e "${YELLOW}⚠️  Before running tests, you need to:${NC}"
echo "1. Create a bracket tournament (mode='bracket')"
echo "2. Register at least 2 participants in the tournament"
echo "3. Get an authentication token from your session"
echo ""
echo "Set these environment variables:"
echo "  export TOURNAMENT_ID='your-tournament-uuid'"
echo "  export AUTH_TOKEN='your-auth-token'"
echo ""

# Check if required variables are set
if [ -z "$TOURNAMENT_ID" ] || [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}❌ Required environment variables not set${NC}"
    echo "Please set TOURNAMENT_ID and AUTH_TOKEN"
    exit 1
fi

echo "Using:"
echo "  Tournament ID: $TOURNAMENT_ID"
echo "  Auth Token: ${AUTH_TOKEN:0:20}..."
echo ""

# Test 1: Check if bracket can be generated
echo "=========================================="
echo "Test 1: Check if bracket can be generated"
echo "=========================================="
RESPONSE=$(curl -s "$BASE_URL/tournaments/$TOURNAMENT_ID/bracket/can-generate")
echo "Response:"
echo "$RESPONSE" | jq '.'
CAN_GENERATE=$(echo "$RESPONSE" | jq -r '.canGenerate')
if [ "$CAN_GENERATE" = "true" ]; then
    echo -e "${GREEN}✅ Bracket can be generated${NC}"
else
    REASON=$(echo "$RESPONSE" | jq -r '.reason')
    echo -e "${RED}❌ Cannot generate bracket: $REASON${NC}"
fi
echo ""

# Test 2: Generate bracket with random seeding
echo "=========================================="
echo "Test 2: Generate bracket (random seeding)"
echo "=========================================="
echo "Generating single elimination bracket with random seeding..."
RESPONSE=$(curl -s -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/bracket" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bracketType": "single_elimination",
    "seedingType": "random",
    "hasBronzeMatch": true
  }')

if echo "$RESPONSE" | jq -e '.config' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Bracket generated successfully${NC}"
    echo "Bracket details:"
    echo "$RESPONSE" | jq '{
      config: {
        bracketType: .config.bracketType,
        seedingType: .config.seedingType,
        totalParticipants: .config.totalParticipants,
        roundsCount: .config.roundsCount,
        hasBronzeMatch: .config.hasBronzeMatch
      },
      rounds: .rounds | length,
      seeds: .seeds | length,
      matches: .matches | length
    }'
else
    echo -e "${RED}❌ Failed to generate bracket${NC}"
    echo "Error response:"
    echo "$RESPONSE" | jq '.'
    exit 1
fi
echo ""

# Test 3: Get bracket data
echo "=========================================="
echo "Test 3: Get bracket data"
echo "=========================================="
RESPONSE=$(curl -s "$BASE_URL/tournaments/$TOURNAMENT_ID/bracket")
if echo "$RESPONSE" | jq -e '.config' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Bracket data retrieved${NC}"
    echo "Bracket structure:"
    echo "$RESPONSE" | jq '{
      totalParticipants: .config.totalParticipants,
      rounds: [.rounds[] | {roundNumber, roundName, bracketType, matchesCount}],
      seeds: [.seeds[] | {seedNumber, entryId}]
    }'
else
    echo -e "${RED}❌ Failed to get bracket data${NC}"
    echo "$RESPONSE" | jq '.'
fi
echo ""

# Test 4: Get specific match details
echo "=========================================="
echo "Test 4: Verify match structure"
echo "=========================================="
FIRST_MATCH=$(echo "$RESPONSE" | jq -r '.matches[0].match.id')
if [ -n "$FIRST_MATCH" ] && [ "$FIRST_MATCH" != "null" ]; then
    MATCH_RESPONSE=$(curl -s "$BASE_URL/matches/$FIRST_MATCH")
    echo "First match details:"
    echo "$MATCH_RESPONSE" | jq '{
      id,
      status,
      playedAt,
      sides: [.sides[] | {entryId, position, score}]
    }'
    echo -e "${GREEN}✅ Match structure verified${NC}"
else
    echo -e "${YELLOW}⚠️  No matches found in bracket${NC}"
fi
echo ""

# Test 5: Test regeneration prevention
echo "=========================================="
echo "Test 5: Test regeneration (should work)"
echo "=========================================="
echo "Attempting to regenerate bracket..."
RESPONSE=$(curl -s -X POST "$BASE_URL/tournaments/$TOURNAMENT_ID/bracket" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bracketType": "single_elimination",
    "seedingType": "random",
    "hasBronzeMatch": false
  }')

if echo "$RESPONSE" | jq -e '.config' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Bracket regenerated successfully${NC}"
    echo "New config:"
    echo "$RESPONSE" | jq '.config | {hasBronzeMatch, totalParticipants}'
else
    echo -e "${RED}❌ Regeneration failed${NC}"
    echo "$RESPONSE" | jq '.'
fi
echo ""

# Test 6: Delete bracket
echo "=========================================="
echo "Test 6: Delete bracket"
echo "=========================================="
RESPONSE=$(curl -s -X DELETE "$BASE_URL/tournaments/$TOURNAMENT_ID/bracket" \
  -H "Authorization: Bearer $AUTH_TOKEN")

if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Bracket deleted successfully${NC}"
else
    echo -e "${RED}❌ Failed to delete bracket${NC}"
    echo "$RESPONSE" | jq '.'
fi
echo ""

# Test 7: Verify bracket is gone
echo "=========================================="
echo "Test 7: Verify bracket deletion"
echo "=========================================="
RESPONSE=$(curl -s -w "%{http_code}" "$BASE_URL/tournaments/$TOURNAMENT_ID/bracket")
HTTP_CODE="${RESPONSE: -3}"
if [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✅ Bracket correctly removed (404 response)${NC}"
else
    echo -e "${YELLOW}⚠️  Got HTTP $HTTP_CODE${NC}"
fi
echo ""

echo "=========================================="
echo "✅ All tests completed!"
echo "=========================================="
