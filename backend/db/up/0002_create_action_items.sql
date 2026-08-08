-- Grate Migration: 0002_create_action_items.sql
CREATE TABLE IF NOT EXISTS action_items (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES file_records(id) ON DELETE CASCADE,
    action_type VARCHAR(32) NOT NULL,
    source_path VARCHAR(4096) NOT NULL,
    target_path VARCHAR(4096) NOT NULL,
    category VARCHAR(64),
    reasoning TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE
);
