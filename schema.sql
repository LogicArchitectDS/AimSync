-- schema.sql
DROP TABLE IF EXISTS training_sessions;

CREATE TABLE training_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    protocol TEXT NOT NULL,
    score INTEGER NOT NULL,
    shots_fired INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    kps REAL NOT NULL,
    is_flagged BOOLEAN DEFAULT 0, -- The Anti-Cheat column is now built-in
    quadrant_top_left REAL DEFAULT 0.0,
    quadrant_top_right REAL DEFAULT 0.0,
    quadrant_bottom_left REAL DEFAULT 0.0,
    quadrant_bottom_right REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- schema.sql
DROP TABLE IF EXISTS player_stats;

CREATE TABLE player_stats (
    user_id TEXT PRIMARY KEY,
    global_accuracy REAL DEFAULT 0,
    total_games INTEGER DEFAULT 0,
    time_played INTEGER DEFAULT 0,
    modes_data TEXT DEFAULT '{}',
    playlists TEXT DEFAULT '[]',
    miss_quadrants TEXT DEFAULT '{}',
    last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- schema.sql
DROP TABLE IF EXISTS player_profiles;

CREATE TABLE player_profiles (
    user_id TEXT PRIMARY KEY,
    xp_flicking INTEGER DEFAULT 0,
    xp_tracking INTEGER DEFAULT 0,
    xp_speed INTEGER DEFAULT 0,
    xp_precision INTEGER DEFAULT 0,
    xp_perception INTEGER DEFAULT 0,
    xp_cognition INTEGER DEFAULT 0,
    total_xp INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    quadrant_top_left REAL DEFAULT 0.0,
    quadrant_top_right REAL DEFAULT 0.0,
    quadrant_bottom_left REAL DEFAULT 0.0,
    quadrant_bottom_right REAL DEFAULT 0.0,
    last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP
);