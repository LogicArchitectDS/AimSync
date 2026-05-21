-- progression-schema.sql

DROP TABLE IF EXISTS scores_telemetry;
DROP TABLE IF EXISTS user_progression;

CREATE TABLE user_progression (
    user_id TEXT PRIMARY KEY,
    current_level INTEGER DEFAULT 1,
    total_xp INTEGER DEFAULT 0,
    surgeon_badge_unlocked INTEGER DEFAULT 0,
    vector_lock_badge_unlocked INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scores_telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    hits INTEGER NOT NULL,
    misses INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    max_combo INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    xp_earned INTEGER NOT NULL,
    integrity_flag TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES user_progression(user_id)
);