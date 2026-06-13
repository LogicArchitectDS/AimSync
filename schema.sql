-- Unified AimSync Schema
-- Consolidated Date: 2026-06-13
-- Removed legacy tables (training_sessions, player_stats, player_profiles) to eliminate data duplication and sync issues.

-- 1. Main User Progression & Stats (Consolidated Source of Truth)
DROP TABLE IF EXISTS user_progression;
CREATE TABLE user_progression (
    user_id TEXT PRIMARY KEY,
    
    -- Leveling & Badges
    current_level INTEGER DEFAULT 1,
    total_xp INTEGER DEFAULT 0,
    surgeon_badge_unlocked INTEGER DEFAULT 0,
    vector_lock_badge_unlocked INTEGER DEFAULT 0,
    vanguard_badge_unlocked INTEGER DEFAULT 0,
    
    -- Aggregated Stats (Migrated from player_stats)
    global_accuracy REAL DEFAULT 0,
    total_games INTEGER DEFAULT 0,
    time_played INTEGER DEFAULT 0,
    modes_data TEXT DEFAULT '{}',      -- JSON object for per-mode stats
    playlists TEXT DEFAULT '[]',       -- JSON array for custom playlists
    miss_quadrants TEXT DEFAULT '{}',  -- JSON object for cumulative misses
    
    -- XP Factor Breakdown (Migrated from player_profiles)
    xp_flicking INTEGER DEFAULT 0,
    xp_tracking INTEGER DEFAULT 0,
    xp_speed INTEGER DEFAULT 0,
    xp_precision INTEGER DEFAULT 0,
    xp_perception INTEGER DEFAULT 0,
    xp_cognition INTEGER DEFAULT 0,
    
    -- Quadrant Heatmap (Rolling Averages)
    quadrant_top_left REAL DEFAULT 0.0,
    quadrant_top_right REAL DEFAULT 0.0,
    quadrant_bottom_left REAL DEFAULT 0.0,
    quadrant_bottom_right REAL DEFAULT 0.0,

    last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Kinematic Telemetry & Session Logs (Migrated from training_sessions)
DROP TABLE IF EXISTS scores_telemetry;
CREATE TABLE scores_telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    difficulty TEXT,
    username TEXT,
    ghost_telemetry TEXT, -- Compressed JSON stream
    hits INTEGER NOT NULL,
    misses INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    max_combo INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    xp_earned INTEGER NOT NULL,
    integrity_flag TEXT NOT NULL, -- HIGH_INTEGRITY, LOW_INTEGRITY (Anti-Cheat)
    average_urgency_index REAL DEFAULT 1.0,
    over_flick_coefficient REAL DEFAULT 1.0,
    miss_quadrants TEXT, -- Session-specific JSON
    neural_stability_score REAL DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES user_progression(user_id)
);
