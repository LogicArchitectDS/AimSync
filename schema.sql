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
    last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP
);