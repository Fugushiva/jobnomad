-- =============================================================================
-- Migration: Extensions
-- Required before any table creation that uses uuid_generate_v4() or vector
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
-- pgcrypto is used for gen_random_uuid() alternative and SHA-256 in business logic
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
