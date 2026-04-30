-- progression-schema.sql

-- 1. Track global player stats across the 6 AimSync Factors
CREATE TABLE IF NOT EXISTS player_profiles (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    
    -- The 6 Pillars of Aiming
    xp_flicking INTEGER DEFAULT 0,
    xp_tracking INTEGER DEFAULT 0,
    xp_speed INTEGER DEFAULT 0,
    xp_precision INTEGER DEFAULT 0,
    xp_perception INTEGER DEFAULT 0,
    xp_cognition INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Track live progress on assigned tasks
CREATE TABLE IF NOT EXISTS active_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    task_id TEXT NOT NULL,          
    task_type TEXT NOT NULL,        
    reward_factor TEXT NOT NULL,    -- So the DB knows which column to update upon completion!
    current_progress REAL DEFAULT 0,
    is_completed BOOLEAN DEFAULT 0,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY(user_id) REFERENCES player_profiles(user_id)
);