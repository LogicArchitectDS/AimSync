-- migrations/0001_consolidate_models.sql
-- Consolidation of legacy tables into a unified progression model.
-- Date: 2026-06-13
-- Legacy tables removed: training_sessions, player_stats, player_profiles

-- 1. Add missing columns to user_progression to make it the single source of truth for user data
ALTER TABLE user_progression ADD COLUMN global_accuracy REAL DEFAULT 0;
ALTER TABLE user_progression ADD COLUMN total_games INTEGER DEFAULT 0;
ALTER TABLE user_progression ADD COLUMN time_played INTEGER DEFAULT 0;
ALTER TABLE user_progression ADD COLUMN modes_data TEXT DEFAULT '{}';
ALTER TABLE user_progression ADD COLUMN playlists TEXT DEFAULT '[]';
ALTER TABLE user_progression ADD COLUMN miss_quadrants TEXT DEFAULT '{}';
ALTER TABLE user_progression ADD COLUMN last_played_at DATETIME;
ALTER TABLE user_progression ADD COLUMN xp_flicking INTEGER DEFAULT 0;
ALTER TABLE user_progression ADD COLUMN xp_tracking INTEGER DEFAULT 0;
ALTER TABLE user_progression ADD COLUMN xp_speed INTEGER DEFAULT 0;
ALTER TABLE user_progression ADD COLUMN xp_precision INTEGER DEFAULT 0;
ALTER TABLE user_progression ADD COLUMN xp_perception INTEGER DEFAULT 0;
ALTER TABLE user_progression ADD COLUMN xp_cognition INTEGER DEFAULT 0;
ALTER TABLE user_progression ADD COLUMN quadrant_top_left REAL DEFAULT 0.0;
ALTER TABLE user_progression ADD COLUMN quadrant_top_right REAL DEFAULT 0.0;
ALTER TABLE user_progression ADD COLUMN quadrant_bottom_left REAL DEFAULT 0.0;
ALTER TABLE user_progression ADD COLUMN quadrant_bottom_right REAL DEFAULT 0.0;

-- 2. Ensure all users from legacy tables exist in user_progression
INSERT OR IGNORE INTO user_progression (user_id)
SELECT user_id FROM player_stats
UNION
SELECT user_id FROM player_profiles;

-- 3. Migrate data from player_stats
UPDATE user_progression
SET 
    global_accuracy = (SELECT global_accuracy FROM player_stats WHERE player_stats.user_id = user_progression.user_id),
    total_games = (SELECT total_games FROM player_stats WHERE player_stats.user_id = user_progression.user_id),
    time_played = (SELECT time_played FROM player_stats WHERE player_stats.user_id = user_progression.user_id),
    modes_data = (SELECT modes_data FROM player_stats WHERE player_stats.user_id = user_progression.user_id),
    playlists = (SELECT playlists FROM player_stats WHERE player_stats.user_id = user_progression.user_id),
    miss_quadrants = (SELECT miss_quadrants FROM player_stats WHERE player_stats.user_id = user_progression.user_id),
    last_played_at = (SELECT last_played_at FROM player_stats WHERE player_stats.user_id = user_progression.user_id)
WHERE user_id IN (SELECT user_id FROM player_stats);

-- 4. Migrate data from player_profiles
UPDATE user_progression
SET 
    xp_flicking = (SELECT xp_flicking FROM player_profiles WHERE player_profiles.user_id = user_progression.user_id),
    xp_tracking = (SELECT xp_tracking FROM player_profiles WHERE player_profiles.user_id = user_progression.user_id),
    xp_speed = (SELECT xp_speed FROM player_profiles WHERE player_profiles.user_id = user_progression.user_id),
    xp_precision = (SELECT xp_precision FROM player_profiles WHERE player_profiles.user_id = user_progression.user_id),
    xp_perception = (SELECT xp_perception FROM player_profiles WHERE player_profiles.user_id = user_progression.user_id),
    xp_cognition = (SELECT xp_cognition FROM player_profiles WHERE player_profiles.user_id = user_progression.user_id),
    quadrant_top_left = (SELECT quadrant_top_left FROM player_profiles WHERE player_profiles.user_id = user_progression.user_id),
    quadrant_top_right = (SELECT quadrant_top_right FROM player_profiles WHERE player_profiles.user_id = user_progression.user_id),
    quadrant_bottom_left = (SELECT quadrant_bottom_left FROM player_profiles WHERE player_profiles.user_id = user_progression.user_id),
    quadrant_bottom_right = (SELECT quadrant_bottom_right FROM player_profiles WHERE player_profiles.user_id = user_progression.user_id),
    total_xp = COALESCE((SELECT total_xp FROM player_profiles WHERE player_profiles.user_id = user_progression.user_id), total_xp)
WHERE user_id IN (SELECT user_id FROM player_profiles);

-- 5. Drop legacy tables
DROP TABLE IF EXISTS training_sessions;
DROP TABLE IF EXISTS player_stats;
DROP TABLE IF EXISTS player_profiles;
