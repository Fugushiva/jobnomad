-- =============================================================================
-- Migration: jobs
-- Central table. Written by the cron ingest pipeline (service_role).
-- Read by any anon/auth user when status = 'active'.
-- All AI attributes are pre-computed at ingestion — never at click time (ADR-003).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Source metadata
  source                TEXT NOT NULL
    CHECK (source IN ('remoteok', 'wwr', 'himalayas', 'workingnomads')),
  source_id             TEXT,
  -- Original ID from the source API/RSS
  source_url            TEXT NOT NULL,

  -- Core job data
  title                 TEXT NOT NULL,
  company               TEXT NOT NULL,
  logo_url              TEXT,
  -- Company logo, referenced in next.config.ts remotePatterns
  description           TEXT NOT NULL,
  posted_at             TIMESTAMPTZ,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  extracted_at          TIMESTAMPTZ,
  -- Set when Gemini extraction completes

  -- ---------------------------------------------------------------------------
  -- AI-extracted geographic policy (from Gemini 2.5 Flash-Lite)
  -- ---------------------------------------------------------------------------
  geo_policy            TEXT
    CHECK (geo_policy IN ('worldwide', 'specific_regions', 'specific_countries', 'unclear')),
  allowed_regions       TEXT[],
  -- Subset of: 'EU', 'NA', 'LATAM', 'APAC', 'AFRICA', 'MENA'
  allowed_countries     TEXT[],
  -- ISO-3166 alpha-2 codes
  excluded_countries    TEXT[],

  -- ---------------------------------------------------------------------------
  -- AI-extracted timezone requirement
  -- ---------------------------------------------------------------------------
  tz_requirement_type   TEXT
    CHECK (tz_requirement_type IN ('none', 'overlap', 'exact')),
  tz_reference          TEXT,
  -- e.g. 'UTC-5', 'EST', 'Europe/London'
  tz_min_overlap_hours  INTEGER
    CHECK (tz_min_overlap_hours IS NULL OR (tz_min_overlap_hours >= 0 AND tz_min_overlap_hours <= 24)),

  -- ---------------------------------------------------------------------------
  -- AI-extracted contract & legal
  -- ---------------------------------------------------------------------------
  contract_type         TEXT
    CHECK (contract_type IN ('employee', 'contractor', 'both', 'unclear')),
  visa_sponsorship      TEXT
    CHECK (visa_sponsorship IN ('yes', 'no', 'not_applicable')),

  -- ---------------------------------------------------------------------------
  -- AI-extracted salary
  -- ---------------------------------------------------------------------------
  salary_min            INTEGER CHECK (salary_min IS NULL OR salary_min >= 0),
  salary_max            INTEGER CHECK (salary_max IS NULL OR salary_max >= 0),
  salary_currency       TEXT,
  -- ISO 4217, e.g. 'USD', 'EUR'
  salary_period         TEXT
    CHECK (salary_period IN ('hour', 'day', 'month', 'year')),
  CONSTRAINT salary_consistency CHECK (
    salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max
  ),

  -- ---------------------------------------------------------------------------
  -- AI-extracted skills & seniority
  -- ---------------------------------------------------------------------------
  skills_required       TEXT[] NOT NULL DEFAULT '{}',
  skills_nice_to_have   TEXT[] NOT NULL DEFAULT '{}',
  seniority             TEXT
    CHECK (seniority IN ('junior', 'mid', 'senior', 'lead', 'any', 'unclear')),

  -- ---------------------------------------------------------------------------
  -- AI-extracted red flags for Asia-based freelancers
  -- JSON array of strings: literal phrases from the offer text, max 100 chars each
  -- Example: ["4h overlap with EST required", "must be authorized to work in US"]
  -- ---------------------------------------------------------------------------
  red_flags             JSONB NOT NULL DEFAULT '[]',

  -- ---------------------------------------------------------------------------
  -- AI confidence scores for critical fields (0.0 - 1.0)
  -- Used in UI to mark ambiguous offers rather than silently filter
  -- Example: {"geo_policy": 0.9, "timezone": 0.6, "contract_type": 0.8}
  -- ---------------------------------------------------------------------------
  confidence_scores     JSONB,

  -- ---------------------------------------------------------------------------
  -- Embedding for semantic matching (OpenAI text-embedding-3-small, 1536 dims)
  -- Computed on: normalized description + skills_required
  -- ---------------------------------------------------------------------------
  embedding             vector(1536),

  -- ---------------------------------------------------------------------------
  -- Pipeline status
  -- ---------------------------------------------------------------------------
  status                TEXT NOT NULL DEFAULT 'pending_extraction'
    CHECK (status IN ('pending_extraction', 'active', 'expired', 'extraction_failed')),

  -- ---------------------------------------------------------------------------
  -- Deduplication hash: sha256(normalize(title) + normalize(company) + normalize(description[:200]))
  -- Prevents duplicate AI calls across sources and re-ingestion runs
  -- ---------------------------------------------------------------------------
  hash_dedup            TEXT NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------------
-- Indexes — optimized for the feed query and cron pipeline
-- ---------------------------------------------------------------------------

-- Primary feed query: active jobs ordered by recency
CREATE INDEX IF NOT EXISTS idx_jobs_status_posted_at
  ON public.jobs (status, posted_at DESC)
  WHERE status = 'active';

-- Cron pipeline: find jobs awaiting extraction
CREATE INDEX IF NOT EXISTS idx_jobs_pending_extraction
  ON public.jobs (ingested_at DESC)
  WHERE status = 'pending_extraction';

-- Filter indexes (FM07: 5 combinable filters)
CREATE INDEX IF NOT EXISTS idx_jobs_geo_policy
  ON public.jobs (geo_policy)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_jobs_contract_type
  ON public.jobs (contract_type)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_jobs_seniority
  ON public.jobs (seniority)
  WHERE status = 'active';

-- Salary filter (range queries)
CREATE INDEX IF NOT EXISTS idx_jobs_salary_min
  ON public.jobs (salary_min)
  WHERE status = 'active' AND salary_min IS NOT NULL;

-- Vector similarity search (IVFFlat, cosine metric)
-- lists=100 per spec §5.3 — good for ~10k-100k active rows
CREATE INDEX IF NOT EXISTS idx_jobs_embedding
  ON public.jobs USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search (FM07, F-S06)
CREATE INDEX IF NOT EXISTS idx_jobs_fulltext
  ON public.jobs USING gin (to_tsvector('english', title || ' ' || description));

-- GIN on skills_required array for skill-based filtering
CREATE INDEX IF NOT EXISTS idx_jobs_skills_required
  ON public.jobs USING gin (skills_required);

-- Dedup hash lookup (already unique constraint, but make intent explicit)
CREATE INDEX IF NOT EXISTS idx_jobs_hash_dedup
  ON public.jobs (hash_dedup);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can read active jobs
CREATE POLICY "jobs_select_active"
  ON public.jobs FOR SELECT
  USING (status = 'active');

-- Only service_role can insert/update/delete (cron pipeline)
-- No auth.uid() policies for INSERT/UPDATE/DELETE — service_role bypasses RLS.
