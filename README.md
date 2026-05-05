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

Crée un fichier `.env.local` à la racine :

```env
# Supabase — Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Supabase — Project Settings > API > service_role (serveur uniquement)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe — Dashboard > Developers > API keys
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend — resend.com > API Keys
RESEND_API_KEY=re_...

# Google AI — aistudio.google.com
GEMINI_API_KEY=AIza...

# OpenAI — platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-...

# Vercel Cron — générer avec: openssl rand -hex 32
CRON_SECRET=<chaine-aleatoire-32-chars>
```

> `NEXT_PUBLIC_*` sont exposés au navigateur. Ne jamais y mettre `SUPABASE_SERVICE_ROLE_KEY` ni les clés API IA/Stripe.

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
│   └── lib/                    # (Supabase clients, future: business logic)
├── supabase/
│   ├── migrations/             # 17 migrations SQL versionnées
│   ├── tests/                  # Tests RLS + smoke tests fonctions SQL
│   ├── seed.sql                # Données de dev local
│   └── config.toml
├── e2e/                        # Tests Playwright E2E
│   ├── a11y.spec.ts            # 15 tests accessibilité
│   └── toast.spec.ts           # 11 tests toast (rendu, dismiss, responsive, a11y)
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
- **`docs/auth-setup.md`** — Configuration Supabase Auth (magic links)
- **`docs/runbook-ingestion.md`** — Runbook pipeline ingestion : health check, trigger manuel, disable source, diagnostics
- **`docs/adr/ADR-007-multi-source-mvp.md`** — Decision: 3 sources en phase 1 MVP

## Base de données

9 tables en production sur Supabase Frankfurt :

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

RLS activé sur toutes les tables. Schéma complet : [`docs/db-schema.md`](docs/db-schema.md).

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
