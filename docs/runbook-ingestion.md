# Runbook — Ingestion Pipeline

> **Scope**: `/api/cron/ingest` — multi-source job ingestion  
> **Last updated**: May 2026  
> **On-call**: Jérôme

---

## Overview

The ingestion cron fetches new job postings from 3 sources every 6 hours,
deduplicates them, and stores them with `status='pending_extraction'` for
the extraction cron (T4 — Gemini) to process.

```
Vercel Cron (every 6h)
  → GET /api/cron/ingest
    → runIngestion() [src/lib/sources/ingest.ts]
      → remoteOKAdapter.fetch()  → POST to jobs (pending_extraction)
      → wwrAdapter.fetch()       → POST to jobs (pending_extraction)
      → himalayasAdapter.fetch() → POST to jobs (pending_extraction)
    → UPDATE cron_runs
```

---

## Health check

```sql
-- Last 5 ingest runs
SELECT cron_name, started_at, status, jobs_new, jobs_skipped, jobs_failed, duration_ms, error_message
FROM cron_runs
WHERE cron_name = 'ingest'
ORDER BY started_at DESC
LIMIT 5;
```

UptimeRobot pings `/api/cron/ingest` health via the `cron_runs` table.
Healthy = last run < 7h ago AND status IN ('completed', 'timeout').

---

## Manual trigger

```bash
# Trigger a run manually (replace with your actual CRON_SECRET)
curl -X GET "https://app.jobnomad.com/api/cron/ingest" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Response:
```json
{
  "ok": true,
  "runId": "uuid",
  "status": "completed",
  "jobsFetched": 42,
  "jobsNew": 18,
  "jobsSkipped": 24,
  "jobsFailed": 0,
  "durationMs": 12500,
  "perSource": {
    "remoteok": { "fetched": 15, "new": 7, "skipped": 8, "failed": 0, "notModified": false, "durationMs": 3200 },
    "wwr":      { "fetched": 20, "new": 8, "skipped": 12, "failed": 0, "notModified": false, "durationMs": 4100 },
    "himalayas":{ "fetched": 7, "new": 3, "skipped": 4, "failed": 0, "notModified": false, "durationMs": 2800 }
  }
}
```

---

## Disable a source without deploy

Add/update the environment variable in **Vercel Dashboard → Project → Settings → Environment Variables**:

```
INGEST_DISABLED_SOURCES=wwr,himalayas
```

Comma-separated list of source names. Takes effect on the next cron invocation (no redeploy needed).
Empty or absent → all sources enabled.

Valid values: `remoteok`, `wwr`, `himalayas`, `workingnomads`

---

## Diagnose a source failure

### Step 1: Check cron_runs
```sql
SELECT status, error_message, metadata
FROM cron_runs
WHERE cron_name = 'ingest'
ORDER BY started_at DESC
LIMIT 1;
```
The `metadata` column contains `perSource` stats including any `error` field per source.

### Step 2: Check source_state
```sql
SELECT source, consecutive_failures, last_error, last_fetched_at
FROM source_state
ORDER BY consecutive_failures DESC;
```

### Step 3: Test the source manually
```bash
# Test RemoteOK
curl -I "https://remoteok.com/api" \
  -H "User-Agent: JobNomad/1.0 (+https://jobnomad.app/bot; mailto:bot@jobnomad.app)"

# Test WWR RSS
curl -I "https://weworkremotely.com/categories/remote-programming-jobs.rss" \
  -H "User-Agent: JobNomad/1.0 (+https://jobnomad.app/bot; mailto:bot@jobnomad.app)"

# Test Himalayas RSS
curl -I "https://himalayas.app/jobs/rss" \
  -H "User-Agent: JobNomad/1.0 (+https://jobnomad.app/bot; mailto:bot@jobnomad.app)"
```

Expected: `HTTP/2 200` or `HTTP/2 304`. A `429` means rate-limited; wait and retry.

---

## Common issues

### All sources return 0 new jobs

**Likely cause**: All content was already seen (dedup working correctly, 304 cache hits).

**Verify**:
```sql
SELECT source, count(*) FROM jobs
WHERE ingested_at > now() - interval '7 hours'
GROUP BY source;
```
If counts are 0 after multiple runs, check if `hash_dedup` unique constraint is blocking legitimate new jobs.

### `consecutive_failures` > 0 for a source

**Likely cause**: HTTP error (429, 5xx) or parse failure.

**Action**: Read `last_error` from `source_state`. If it's a 429, wait for the rate limit window (usually 1h). If it's a parse failure, check if the source changed their feed format.

### Cron runs are missing (no row in last 7h)

**Likely cause**: Vercel Cron not firing, or the route returned 500 before writing to `cron_runs`.

**Check**: Vercel Dashboard → Project → Crons → ingest → Logs.

### `status='timeout'`

The cron exceeded the 50s deadline. Partial results were saved (the run is NOT a failure).
Check `perSource` in metadata to see which adapter didn't complete. Disable slow sources temporarily.

---

## Performance targets (from spec §3.1)

| Metric | Target | Measure |
|---|---|---|
| Cron duration | < 60s (Hobby limit) | `duration_ms` in cron_runs |
| Per-adapter fetch | < 10s | `perSource.*.durationMs` |
| New jobs per run | ~40-60 | `jobs_new` in cron_runs |
| Dedup efficiency | > 50% skipped | `jobs_skipped / jobs_fetched` |

---

## Adding a new source (phase 2)

1. Create `src/lib/sources/adapters/workingnomads.ts` implementing `SourceAdapter`.
2. Add it to `src/lib/sources/adapters/index.ts`.
3. Add `workingnomads` to `INGEST_DISABLED_SOURCES` initially for a dry-run test.
4. Run `supabase db push` (no migration needed — schema already has `workingnomads`).
5. Remove from `INGEST_DISABLED_SOURCES` to enable.

---

## Key files

| File | Purpose |
|---|---|
| `app/api/cron/ingest/route.ts` | Route handler (auth, cron_runs, deadline) |
| `src/lib/sources/ingest.ts` | Orchestrator (adapter loop, dedup, upsert) |
| `src/lib/sources/adapters/remoteok.ts` | RemoteOK JSON API adapter |
| `src/lib/sources/adapters/wwr.ts` | WeWorkRemotely RSS adapter (3 feeds) |
| `src/lib/sources/adapters/himalayas.ts` | Himalayas RSS adapter |
| `src/lib/sources/http.ts` | HTTP guard (UA, retry, 429, conditional GET) |
| `src/lib/sources/normalize.ts` | SHA-256 dedup hash |
| `src/lib/sources/rss.ts` | RSS 2.0 parser (XXE-safe) |
| `supabase/migrations/20260505000018_source_state.sql` | ETag/failure tracking per source |
