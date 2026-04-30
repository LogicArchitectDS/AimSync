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