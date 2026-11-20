-- 016_add_return_resolution_notes.sql
-- Add resolution_note to returns table for dispute explanations

ALTER TABLE returns ADD COLUMN IF NOT EXISTS resolution_note TEXT;
