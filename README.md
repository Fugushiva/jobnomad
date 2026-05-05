# JobNomad

Job board intelligent pour freelances basés en Asie. Filtre et score par IA les offres remote réellement compatibles avec ta timezone, ton statut de contractor et tes contraintes géographiques.

## Le problème

80% des offres taguées "remote" exigent en réalité un overlap timezone avec les États-Unis ou l'Europe, ou n'acceptent pas les contractors étrangers. Ces contraintes sont cachées dans le texte libre de l'offre, pas dans les métadonnées du job board.

## La solution

JobNomad lit le texte intégral de chaque offre via Gemini 2.5 Flash-Lite et extrait : politique géographique, requirements timezone, type de contrat, red flags pour l'Asie. Le feed utilisateur est du SQL pur — zéro appel IA au clic, latence < 200ms.

## Stack

| Couche | Techno |
|---|---|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| UI | Tailwind CSS v4 + shadcn/ui |
| Auth | Supabase Auth (magic links) |
| Base de données | Supabase Postgres 17 + pgvector |
| IA extraction | Gemini 2.5 Flash-Lite |
| IA embeddings | OpenAI text-embedding-3-small |
| Paiement | Stripe Subscriptions |
| Email | Resend |
| Hébergement | Vercel Hobby |
| Cron | Vercel Cron Jobs |

## Prérequis

- Node.js 20+
- npm 10+
- Un projet Supabase (Frankfurt / eu-central-1)
- Un compte Vercel (Hobby suffit)

## Installation

```bash
# 1. Cloner le repo
git clone https://github.com/Fugushiva/jobnomad.git
cd jobnomad

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env.local
# Remplir les valeurs (voir section ci-dessous)

# 4. Lier le projet Supabase et appliquer le schéma
npx supabase link --project-ref <ton-project-ref>
npx supabase db push --password <ton-db-password>

# 5. Générer les types TypeScript (après toute migration)
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts

# 6. Lancer le serveur de développement
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## Variables d'environnement

```bash
cp .env.example .env.local
# Remplir les valeurs — voir détails ci-dessous
```

### Tableau de référence complet

| Variable | Obligatoire | Dev local | Vercel Prod | Vercel Preview | Sensitive | Source |
|----------|-------------|-----------|-------------|----------------|-----------|--------|
| `NEXT_PUBLIC_SITE_URL` | Oui | `http://localhost:3000` | `https://jobnomad.app` | URL preview | Non | Manuel |
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | `http://localhost:54321` | `https://<ref>.supabase.co` | Idem prod | Non | Supabase > API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Oui | Clé locale CLI | `sb_publishable_...` | Idem prod | Non | Supabase > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui (serveur) | Clé locale CLI | `eyJ...` | Idem prod | **Oui** | Supabase > API |
| `SUPABASE_PROJECT_REF` | Script SMTP | Ref du projet | Ref du projet | Idem prod | Non | Supabase > General |
| `SUPABASE_ACCESS_TOKEN` | Script SMTP | Token perso | *(ne pas ajouter)* | *(ne pas ajouter)* | **Oui** | supabase.com/dashboard/account/tokens |
| `RESEND_API_KEY` | Prod uniquement | *(laisser vide)* | `re_...` | `re_...` | **Oui** | resend.com > API Keys |
| `EMAIL_FROM_ADDRESS` | Prod uniquement | *(laisser vide)* | `auth@jobnomad.app` | Idem prod | Non | Domaine vérifié Resend |
| `EMAIL_FROM_NAME` | Non | *(laisser vide)* | `JobNomad` | Idem prod | Non | Libre |
| `STRIPE_SECRET_KEY` | Prod uniquement | *(laisser vide)* | `sk_live_...` | `sk_test_...` | **Oui** | Stripe > Developers |
| `STRIPE_WEBHOOK_SECRET` | Prod uniquement | *(laisser vide)* | `whsec_...` | `whsec_...` | **Oui** | Stripe > Webhooks |
| `GEMINI_API_KEY` | Prod uniquement | *(laisser vide)* | `AIza...` | Idem prod | **Oui** | aistudio.google.com |
| `OPENAI_API_KEY` | Prod uniquement | *(laisser vide)* | `sk-proj-...` | Idem prod | **Oui** | platform.openai.com |
| `CRON_SECRET` | Oui (cron) | Valeur locale | `openssl rand -hex 32` | Idem prod | **Oui** | Générer |
| `RATE_LIMIT_PEPPER` | Oui | Valeur locale | `openssl rand -hex 16` | Idem prod | **Oui** | Générer |

### Règles de sécurité

- **`NEXT_PUBLIC_*`** sont inlinées dans le bundle navigateur — ne jamais y mettre de secrets.
- **`SUPABASE_ACCESS_TOKEN`** est un token de management (Management API), pas un token d'app. Ne **jamais** l'ajouter dans les variables Vercel runtime — uniquement en local (`.env.local`) et en GitHub Secret CI.
- **`SUPABASE_SERVICE_ROLE_KEY`** bypass toutes les politiques RLS — uniquement dans les route handlers serveur (`app/api/cron/`), jamais côté client.
- En dev local, `RESEND_API_KEY` n'est pas nécessaire : Supabase CLI capture tous les emails via [Inbucket](http://localhost:54324).

### Générer les secrets

```bash
# CRON_SECRET
openssl rand -hex 32

# RATE_LIMIT_PEPPER
openssl rand -hex 16
```

Pour le setup complet Resend + SMTP + Vercel + DNS, voir [`docs/auth-setup.md`](docs/auth-setup.md).

## Scripts disponibles

```bash
npm run dev          # Serveur de développement (Turbopack)
npm run build        # Build de production
npm run start        # Serveur de production
npm run lint         # ESLint
npm run typecheck    # TypeScript (tsc --noEmit)
npm run test         # Tests unitaires (Vitest)
npm run test:watch   # Tests unitaires en mode watch
npm run test:e2e     # Tests E2E (Playwright)
npm run test:e2e:ui  # Tests E2E avec UI interactive
npm run test:all     # Unitaires + E2E

# SMTP Resend — configuration Supabase Auth
npm run smtp:dry     # Preview du payload SMTP (dry-run, aucun appel API)
npm run smtp:setup   # Applique la config SMTP Resend sur Supabase (idempotent)
npm run smtp:verify  # Lit la config SMTP actuelle (audit, détecte la dérive)
```

## CI/CD

Chaque PR déclenche automatiquement lint + typecheck + tests + build via GitHub Actions.  
Les pushes sur `master` déclenchent un déploiement Vercel automatique.



## Structure du projet

```
jobnomad/
├── app/                        # Next.js App Router
│   ├── (protected)/            # Routes authentifiées (RLS)
│   │   ├── feed/               # Page principale du feed
│   │   ├── onboarding/         # Onboarding profil utilisateur
│   │   └── layout.tsx
│   ├── auth/                   # Pages d'authentification
│   ├── globals.css             # Tailwind v4 + design tokens
│   ├── layout.tsx              # Root layout (ThemeProvider)
│   ├── page.tsx                # Home/landing
│   └── favicon.ico
├── components/                 # Composants React réutilisables
│   ├── ui/                     # 20 shadcn/ui primitives (dont Toaster Sonner)
│   ├── brand/                  # Logo, LogoMark
│   ├── layout/                 # Header, Footer, ThemeToggle
│   ├── jobs/                   # JobCard, ScoreBadge, RedFlagBadge
│   ├── feed/                   # FeedSkeleton
│   ├── states/                 # EmptyState, ErrorState
│   └── providers/              # ThemeProvider
├── hooks/                      # React hooks
│   ├── use-theme-toggle.ts     # Bascule thème light/dark/system
│   └── use-media-query.ts      # SSR-safe matchMedia hook
├── lib/                        # Utilitaires métier
│   ├── toast/
│   │   └── index.ts            # API toast centralisée (toast + toastError)
│   ├── forms/
│   │   └── use-zod-form.ts     # react-hook-form + Zod integration
│   └── utils.ts                # cn() (classnames merge)
├── src/
│   └── lib/                    # Business logic (server-only)
│       ├── supabase/            # Supabase clients + generated types
│       ├── sources/             # Ingestion pipeline (adapters, normalize, ingest)
│       ├── cron/                # Shared cron helpers (auth, logger)
│       ├── cleanup/             # Cleanup orchestrator (runCleanup)
│       └── auth/                # Auth helpers (rate limit, origin, schemas)
├── scripts/                    # Scripts de setup et maintenance
│   ├── setup-supabase-smtp.ts  # Config SMTP Resend via Management API
│   └── __tests__/              # Tests du script SMTP
├── supabase/
│   ├── migrations/             # Migrations SQL versionnées
│   ├── templates/              # Templates email (magic-link, confirm-signup, recovery)
│   ├── tests/                  # Tests RLS + pgTAP fonctions SQL
│   │   ├── rls_*.sql           # 6 fichiers RLS (user_profiles, jobs, saved_jobs…)
│   │   ├── functions_smoke.sql # Smoke test des fonctions SQL
│   │   └── functions_cleanup.sql # 29 assertions comportementales cleanup_expired_data
│   ├── seed.sql                # Données de dev local
│   └── config.toml             # Config Supabase CLI (Inbucket, auth, redirects)
├── e2e/                        # Tests Playwright E2E
│   ├── a11y.spec.ts            # Tests accessibilité
│   ├── auth.spec.ts            # Tests auth flow complet
│   ├── auth-smtp-health.spec.ts# Smoke test SMTP (opt-in, SMTP_HEALTH_TEST=1)
│   └── toast.spec.ts           # Tests toast (rendu, dismiss, responsive, a11y)
├── docs/
│   ├── db-schema.md            # ERD, politique de rétention, décisions archi
│   ├── ui.md                   # Guide des composants shadcn/ui
│   ├── ci-cd.md                # Runbook CI/CD, secrets, rotation
│   └── auth-setup.md           # Configuration Supabase Auth
└── public/                     # Ressources statiques
```

## Documentation

- **`docs/db-schema.md`** — ERD complet, politique de rétention des données, décisions architecturales
- **`docs/ui.md`** — Guide des composants shadcn/ui et design system (tokens, accessibility)
- **`docs/ci-cd.md`** — Runbook complet : secrets, rotation CRON_SECRET, debugging, variables Vercel
- **`docs/auth-setup.md`** — Runbook complet : Resend SMTP, magic links, Inbucket dev, checklist prod, rotation clés
- **`docs/runbook-ingestion.md`** — Runbook pipeline ingestion : health check, trigger manuel, disable source, diagnostics
- **`docs/adr/ADR-007-multi-source-mvp.md`** — Decision: 3 sources en phase 1 MVP

## Base de données

10 tables en production sur Supabase Frankfurt :

| Table | Rôle |
|---|---|
| `user_profiles` | Profil onboarding (timezone, skills, taux) |
| `subscriptions` | Tier free/pro, état Stripe |
| `jobs` | Offres avec attributs IA pré-calculés |
| `saved_jobs` | Bookmarks utilisateur |
| `job_views` | Interactions + quota tier gratuit |
| `email_digests` | Historique emails envoyés |
| `ai_usage_log` | Audit coûts IA (toutes API) |
| `cron_runs` | Santé des cron jobs (monitoring) |
| `feedback_extraction` | Erreurs d'extraction signalées par les users |
| `source_state` | ETag/Last-Modified par source d'ingestion |
| `auth_rate_limits` | Rate-limiting anti-brute-force auth |

RLS activé sur toutes les tables. Schéma complet : [`docs/db-schema.md`](docs/db-schema.md).

## Cron jobs

| Cron | Schedule | Description |
|---|---|---|
| `/api/cron/ingest` | `0 0 * * *` (quotidien 00:00 UTC) | Ingestion multi-sources (RemoteOK, WWR, Himalayas) |
| `/api/cron/cleanup` | `0 3 * * 0` (hebdo dim. 03:00 UTC) | Nettoyage rétention données (Free tier DB < 500 MB) |

Les deux crons utilisent `Authorization: Bearer $CRON_SECRET` (timing-safe).
Chaque exécution écrit une ligne dans `cron_runs` (`status`, `rows_deleted`, `metadata`).

> **Vercel Hobby** : limite de 2 crons gratuits. Tout futur cron (digest, extraction IA)
> nécessitera un upgrade Vercel Pro ou un mécanisme de trigger interne.

### Politique de rétention enforced par `/api/cron/cleanup`

| Table | Rétention |
|---|---|
| `jobs` status=`active` | expire après **14 jours** |
| `jobs` status=`expired` | supprimé après **30 jours** (cascade → saved_jobs, job_views, feedback) |
| `job_views` | supprimé après **60 jours** |
| `email_digests` | supprimé après **30 jours** |
| `ai_usage_log` | supprimé après **180 jours** |
| `feedback_extraction` | supprimé après **180 jours** |
| `cron_runs` | supprimé après **90 jours** |

### Trigger manuel

```bash
# Trigger le cleanup manuellement (debug / post-déploiement)
curl -X GET https://jobnomad.app/api/cron/cleanup \
  -H "Authorization: Bearer $CRON_SECRET"

# Vérifier le dernier run
# (requête sur cron_runs via Supabase dashboard ou psql)
SELECT cron_name, status, rows_deleted, duration_ms, metadata, started_at
FROM cron_runs
WHERE cron_name = 'cleanup'
ORDER BY started_at DESC
LIMIT 5;
```

## Régénérer les types après une migration

```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

## Notifications (toasts)

Le projet utilise [Sonner](https://sonner.emilkowal.ski) comme unique système de toasts.
`<Toaster />` est monté une seule fois dans `app/layout.tsx`, à l'intérieur du `<ThemeProvider>`.

### Usage

Depuis n'importe quel Client Component :

```tsx
'use client'
import { toast, toastError } from '@/lib/toast'

// Succès
toast.success('Job sauvegardé')

// Info
toast.info('Profil mis à jour')

// Warning
toast.warning('Vous approchez votre limite quotidienne')

// Promise — loading → success/error automatique
toast.promise(saveJob(id), {
  loading: 'Sauvegarde…',
  success: 'Job sauvegardé',
  error: 'Échec de la sauvegarde',
})

// Erreur — TOUJOURS utiliser toastError, jamais toast.error(error.message)
try {
  await saveJob(id)
} catch (err) {
  toastError(err, 'Impossible de sauvegarder cette offre')
}
```

### Règles de sécurité

- **Ne jamais** passer `error.message` ou `error.stack` brut à `toast.error()`.
  Cela peut exposer des chemins serveur, messages SQL ou infos infra sensibles.
- **Toujours** utiliser `toastError(err, "message utilisateur")` qui sanitize l'entrée :
  seuls les strings passés explicitement et le message fallback sont affichés.
- En développement (`NODE_ENV !== 'production'`), l'erreur brute est loggée
  dans la console pour debugging — jamais envoyée à l'UI.

### Configuration

| Paramètre | Valeur |
|---|---|
| Position desktop | `top-right` (≥ 768 px) |
| Position mobile | `top-center` (< 768 px) |
| Durée par défaut | 4 secondes |
| Thème | Suit `next-themes` automatiquement (dark / light / system) |
| Couleurs | Tokens design system CSS (`--success-soft`, `--danger-soft`, etc.) |

### Ajouter un toast dans une feature

1. Importer depuis `@/lib/toast` (jamais directement depuis `sonner`).
2. Pour les erreurs, utiliser **exclusivement** `toastError()`.
3. Ne pas ajouter de second `<Toaster />` — il est déjà global dans `app/layout.tsx`.

## Modèle de prix

- Tier gratuit : 25 offres/jour
- Tier pro : $15/mois, accès illimité via Stripe

## Licence

Projet privé — tous droits réservés.
