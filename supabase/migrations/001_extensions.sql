-- ============================================================
-- 001 – Extensions
-- Run before all other migrations.
-- ============================================================

-- UUID generation (used for gen_random_uuid() fallback)
create extension if not exists "uuid-ossp";

-- Fuzzy / trigram text search (trending query matching)
create extension if not exists "pg_trgm";

-- Accent-insensitive search (supports Spanish, Portuguese, etc.)
create extension if not exists "unaccent";
