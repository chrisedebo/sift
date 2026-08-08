-- Grate Migration: 0001_create_file_records.sql
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
