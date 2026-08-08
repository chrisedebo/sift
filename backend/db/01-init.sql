-- Sift NAS Media & Digital Asset Manager Idempotent PostgreSQL Schema
-- Idempotent schema initialization script for PostgreSQL 15+
-- OS & Spec Length Bounds: PATH_MAX=4096, NAME_MAX=255, EXT=64, MIME=128

CREATE TABLE IF NOT EXISTS file_records (
    id SERIAL PRIMARY KEY,
    file_path VARCHAR(4096) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    extension VARCHAR(64) NOT NULL DEFAULT '',
    mime_type VARCHAR(128) NOT NULL DEFAULT '',
    sha256_hash VARCHAR(64),
    category VARCHAR(64) NOT NULL DEFAULT 'Uncategorized',
    summary TEXT,
    enriched_data TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'indexed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure columns exist and align column types with OS bounds
ALTER TABLE file_records ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64);
ALTER TABLE file_records ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE file_records ADD COLUMN IF NOT EXISTS enriched_data TEXT;

ALTER TABLE file_records ALTER COLUMN file_path TYPE VARCHAR(4096);
ALTER TABLE file_records ALTER COLUMN filename TYPE VARCHAR(255);
ALTER TABLE file_records ALTER COLUMN extension TYPE VARCHAR(64);
ALTER TABLE file_records ALTER COLUMN mime_type TYPE VARCHAR(128);
ALTER TABLE file_records ALTER COLUMN category TYPE VARCHAR(64);
ALTER TABLE file_records ALTER COLUMN status TYPE VARCHAR(32);

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

CREATE TABLE IF NOT EXISTS searx_cache (
    id SERIAL PRIMARY KEY,
    query VARCHAR(1024) UNIQUE NOT NULL,
    results_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fast Indexes for 10TB NAS Scale (Tens of thousands of files)
CREATE INDEX IF NOT EXISTS idx_file_records_category ON file_records(category);
CREATE INDEX IF NOT EXISTS idx_file_records_extension ON file_records(extension);
CREATE INDEX IF NOT EXISTS idx_file_records_status ON file_records(status);
CREATE INDEX IF NOT EXISTS idx_file_records_filename ON file_records(filename);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_file_id ON action_items(file_id);
