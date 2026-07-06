-- 대회 모드 전용: 1인당 최대 경기 수 제한 (NULL이면 제한 없음)
ALTER TABLE rooms ADD COLUMN max_games_per_player INTEGER DEFAULT NULL;
