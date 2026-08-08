-- Grate Migration: 0004_add_indexes.sql
CREATE INDEX IF NOT EXISTS idx_file_records_category ON file_records(category);
CREATE INDEX IF NOT EXISTS idx_file_records_extension ON file_records(extension);
CREATE INDEX IF NOT EXISTS idx_file_records_status ON file_records(status);
CREATE INDEX IF NOT EXISTS idx_file_records_filename ON file_records(filename);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_file_id ON action_items(file_id);
