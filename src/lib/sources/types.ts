/**
 * Core types for the multi-source ingestion pipeline.
 *
 * Architecture: thin route handler (app/api/cron/ingest/route.ts)
 *   → orchestrator (ingest.ts)
 *   → SourceAdapter[] (adapters/*.ts)
 *   → http.ts / rss.ts (shared utilities)
 *   → Supabase (service client, passed as dependency)
 *
 * Phase 2 migration note: N8N will call the same HTTP endpoint.
 * The business logic in this lib never changes.
 */

// ---------------------------------------------------------------------------
// Source identifiers
// ---------------------------------------------------------------------------

export type SourceName = 'remoteok' | 'wwr' | 'himalayas' | 'workingnomads'

// ---------------------------------------------------------------------------
// Raw job — output of an adapter, before normalization
// ---------------------------------------------------------------------------

export interface RawJob {
  /** Opaque ID from the source (used for dedup tracking, not stored as PK) */
  source_id: string | null
  /** Canonical URL to the original job posting */
  source_url: string
  /** Job title, raw from source */
  title: string
  /** Company name, raw from source */
  company: string
  /** Full job description, raw HTML/Markdown/plain text — Gemini cleans in T4 */
  description: string
  /** Date the job was posted (null = unknown, common in RSS) */
  posted_at: Date | null
  /** Logo URL (optional — may be null for RSS sources) */
  logo_url: string | null
}

// ---------------------------------------------------------------------------
// Normalized job — after normalize.ts processing, ready for DB insert
// ---------------------------------------------------------------------------

export interface NormalizedJob extends RawJob {
  source: SourceName
  /**
   * Deduplication hash.
   * sha256( normalize(title) + '|' + normalize(company) + '|' + normalize(description[0:200]) )
   * Stored as hex string, must match jobs.hash_dedup UNIQUE constraint.
   */
  hash_dedup: string
}

// ---------------------------------------------------------------------------
// Fetch context — injected into each adapter.fetch() call
// ---------------------------------------------------------------------------

export interface FetchContext {
  /** AbortSignal tied to the global deadline budget */
  signal: AbortSignal
  /** Value of last stored ETag for conditional GET (may be null on first run) */
  ifNoneMatch: string | null
  /** Value of last stored Last-Modified for conditional GET (may be null) */
  ifModifiedSince: string | null
  /** Structured logger — never logs raw description or secrets */
  log: Logger
}

// ---------------------------------------------------------------------------
// Logger interface — structured, safe
// ---------------------------------------------------------------------------

export type LogLevel = 'info' | 'warn' | 'error'

export interface Logger {
  (level: LogLevel, message: string, meta?: Record<string, unknown>): void
}

// ---------------------------------------------------------------------------
// Per-source fetch result — returned by adapter.fetch()
// ---------------------------------------------------------------------------

export interface FetchResult {
  jobs: RawJob[]
  /**
   * true if the source returned 304 Not Modified — caller skips inserts
   * but still counts this as a successful run.
   */
  notModified: boolean
  /** Updated ETag from the response (null if not provided) */
  etag: string | null
  /** Updated Last-Modified from the response (null if not provided) */
  lastModified: string | null
  /** Milliseconds the HTTP request took */
  durationMs: number
}

// ---------------------------------------------------------------------------
// Source adapter interface
// ---------------------------------------------------------------------------

export interface SourceAdapter {
  readonly source: SourceName
  /**
   * When false: adapter is skipped in the orchestrator.
   * Can be toggled via env var INGEST_DISABLED_SOURCES=wwr,himalayas
   * without a code deploy (see ingest.ts).
   */
  readonly enabled: boolean
  fetch(ctx: FetchContext): Promise<FetchResult>
}

// ---------------------------------------------------------------------------
// Per-source stats — accumulated by orchestrator
// ---------------------------------------------------------------------------

export interface PerSourceStats {
  fetched: number
  new: number
  skipped: number
  failed: number
  notModified: boolean
  durationMs: number
  error?: string
}

// ---------------------------------------------------------------------------
// Overall ingestion result — returned to the cron route handler
// ---------------------------------------------------------------------------

export interface IngestResult {
  runId: string
  jobsFetched: number
  jobsNew: number
  jobsSkipped: number
  jobsFailed: number
  durationMs: number
  perSource: Partial<Record<SourceName, PerSourceStats>>
  /** true if deadline was hit before all sources finished */
  deadlineHit: boolean
}
