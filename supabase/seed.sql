-- =============================================================================
-- Seed: Local Development Data
-- DO NOT run against production. For use with `supabase start` (Docker) only.
-- Creates demo jobs that are readable without any auth.
-- =============================================================================

-- Demo jobs (status='active', no auth required to view)
INSERT INTO public.jobs (
  source, source_id, source_url,
  title, company, logo_url, description,
  posted_at, extracted_at,
  geo_policy, allowed_regions,
  tz_requirement_type, tz_reference, tz_min_overlap_hours,
  contract_type, visa_sponsorship,
  salary_min, salary_max, salary_currency, salary_period,
  skills_required, skills_nice_to_have, seniority,
  red_flags, confidence_scores,
  status, hash_dedup
)
VALUES
(
  'remoteok', 'rok-seed-001', 'https://remoteok.com/seed-001',
  'Senior Full-Stack Engineer (Remote Worldwide)',
  'Acme Corp',
  'https://logo.clearbit.com/acmecorp.com',
  'We are a fully distributed team and we mean it. Work from anywhere in the world. No timezone constraints. We use async-first communication and meet once a week via video.',
  now() - INTERVAL '2 days', now() - INTERVAL '2 days',
  'worldwide', ARRAY['EU', 'NA', 'LATAM', 'APAC', 'AFRICA', 'MENA'],
  'none', NULL, NULL,
  'contractor', 'not_applicable',
  80, 130, 'USD', 'hour',
  ARRAY['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
  ARRAY['Next.js', 'Supabase', 'AWS'],
  'senior',
  '[]'::jsonb,
  '{"geo_policy": 0.97, "timezone": 0.95, "contract_type": 0.92}'::jsonb,
  'active', encode(digest('seed-job-001-acme', 'sha256'), 'hex')
),
(
  'remoteok', 'rok-seed-002', 'https://remoteok.com/seed-002',
  'Product Designer — Remote (Europe & Americas)',
  'Designify',
  'https://logo.clearbit.com/designify.com',
  'We are looking for a talented product designer. You must be available for team meetings between 2pm-6pm CET. We welcome contractors based anywhere in Europe or the Americas.',
  now() - INTERVAL '1 day', now() - INTERVAL '1 day',
  'specific_regions', ARRAY['EU', 'NA', 'LATAM'],
  'overlap', 'CET', 4,
  'contractor', 'no',
  60, 90, 'USD', 'hour',
  ARRAY['Figma', 'Product Design', 'User Research'],
  ARRAY['Framer', 'Motion Design'],
  'mid',
  '["4h overlap with CET required", "available 2pm-6pm CET", "Europe or Americas only"]'::jsonb,
  '{"geo_policy": 0.88, "timezone": 0.91, "contract_type": 0.95}'::jsonb,
  'active', encode(digest('seed-job-002-designify', 'sha256'), 'hex')
),
(
  'remoteok', 'rok-seed-003', 'https://remoteok.com/seed-003',
  'Backend Engineer — Node.js',
  'StartupXYZ',
  NULL,
  'We are hiring a backend engineer. Must be authorized to work in the United States. We offer full-time employment with benefits. You must be in the US Eastern or Pacific timezone.',
  now() - INTERVAL '3 days', now() - INTERVAL '3 days',
  'specific_countries', ARRAY['US'],
  'exact', 'EST', 8,
  'employee', 'no',
  120000, 160000, 'USD', 'year',
  ARRAY['Node.js', 'AWS', 'Docker'],
  ARRAY['Kubernetes', 'Terraform'],
  'mid',
  '["must be authorized to work in the United States", "US Eastern or Pacific timezone", "full-time employment only, no contractors"]'::jsonb,
  '{"geo_policy": 0.99, "timezone": 0.98, "contract_type": 0.97}'::jsonb,
  'active', encode(digest('seed-job-003-startupxyz', 'sha256'), 'hex')
),
(
  'wwr', 'wwr-seed-001', 'https://weworkremotely.com/seed-001',
  'AI/ML Engineer — Global Remote',
  'AIventure',
  'https://logo.clearbit.com/aiventure.io',
  'Fully async team. We hire globally, no timezone requirements. You will work on cutting-edge LLM applications. Contractors and employees both welcome. We pay in USD.',
  now() - INTERVAL '4 hours', now() - INTERVAL '4 hours',
  'worldwide', ARRAY['EU', 'NA', 'LATAM', 'APAC', 'AFRICA', 'MENA'],
  'none', NULL, NULL,
  'both', 'not_applicable',
  100, 200, 'USD', 'hour',
  ARRAY['Python', 'LLM', 'Machine Learning', 'PyTorch'],
  ARRAY['TypeScript', 'FastAPI', 'Vector Databases'],
  'senior',
  '[]'::jsonb,
  '{"geo_policy": 0.95, "timezone": 0.98, "contract_type": 0.90}'::jsonb,
  'active', encode(digest('seed-job-004-aiventure', 'sha256'), 'hex')
)
ON CONFLICT (hash_dedup) DO NOTHING;
