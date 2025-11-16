-- Script pour vérifier les données
-- Remplacez les IDs par ceux de votre tournoi et joueurs

-- 1. Vérifier la configuration du tournoi
SELECT 
  id,
  name,
  max_times_with_same_opponent,
  max_times_with_same_partner,
  max_matches_per_player
FROM tournaments 
WHERE id = 'VOTRE_TOURNAMENT_ID';

-- 2. Compter combien de fois deux joueurs spécifiques se sont affrontés
SELECT 
  m.id,
  m.status,
  m.score_a,
  m.score_b,
  mp1.player_id as player1,
  mp1.team_side as player1_side,
  mp2.player_id as player2,
  mp2.team_side as player2_side
FROM matches m
JOIN match_participation mp1 ON m.id = mp1.match_id
JOIN match_participation mp2 ON m.id = mp2.match_id
WHERE m.tournament_id = 'VOTRE_TOURNAMENT_ID'
  AND mp1.player_id = 'PLAYER_A1_ID'
  AND mp2.player_id = 'PLAYER_B1_ID'
  AND mp1.team_side != mp2.team_side;
