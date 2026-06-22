-- Up
ALTER TABLE scores_telemetry ADD COLUMN flagged BOOLEAN DEFAULT 0;
ALTER TABLE scores_telemetry ADD COLUMN flag_reason TEXT DEFAULT NULL;
