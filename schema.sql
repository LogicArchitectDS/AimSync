-- schema.sql
DROP TABLE IF EXISTS training_sessions;

CREATE TABLE training_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,          -- Will link to Auth.js later
    protocol TEXT NOT NULL,         -- e.g., 'static-flick'
    score INTEGER NOT NULL,
    shots_fired INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    kps REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);