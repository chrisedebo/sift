-- Grate Migration: 0003_create_searx_cache.sql
CREATE TABLE IF NOT EXISTS searx_cache (
    id SERIAL PRIMARY KEY,
    query VARCHAR(1024) UNIQUE NOT NULL,
    results_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
