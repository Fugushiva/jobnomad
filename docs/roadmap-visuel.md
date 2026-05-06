# JobNomad — Roadmap visuelle (phase 1, sans IA)

> **Scope** : ce doc couvre uniquement le travail **front-end / UX / persistance directe**.
> Aucune feature qui dépend d'un appel LLM (extraction Gemini, embeddings, scoring sémantique, digest IA) n'est traitée ici. Ces features arrivent dans une phase ultérieure.
>
> **Hypothèses verrouillées** :
> - Stack : Next.js 16.2 (App Router), React 19.2, Tailwind v4 + shadcn/ui, Supabase (Postgres + Auth)
> - Schéma DB `user_profiles` figé sur le MVP du spec (pas de migration ajoutée)
> - Auth = Supabase magic link uniquement
> - Le matching réel arrive plus tard ; en attendant le feed affiche les jobs actifs filtrés par préférences déclaratives (timezone, contract, salaire)

---

## Vue d'ensemble — ordre d'attaque

| # | Tâche | Pourquoi maintenant ? | Bloque |
|---|-------|----------------------|--------|
| 1 | **Onboarding wizard** (4 étapes) | Sans profil → feed vide → produit inutilisable | Tâche 2 |
| 2 | **Feed réel** (DB → JobCard) | Première vraie valeur livrée à l'utilisateur | — |
| 3 | **Polish auth pages** (login/verify/error) | Premier contact, doit être impeccable | — |
| 4 | **Landing page v2** | Acquisition future, peut attendre que 1+2 soient stables | — |

Annexes :
- A. Pages transverses qui apparaissent en cours de route (`/saved`, `/settings`, `/jobs/[id]`)
- B. Composants à créer / améliorer
- C. Décisions explicitement reportées (out-of-scope phase 1)

---

## Tâche 1 — Onboarding wizard (`/onboarding`)

**Statut actuel** : stub (page `/onboarding` affiche une carte "coming soon")
**Spec source** : F-M03 du PDF Conception Technique
**Cible** : 100% MVP, zéro IA, persistance directe Supabase via Server Action

### 1.1 Objectifs

- Faire passer un utilisateur fraîchement authentifié de **0 → profil complet → feed utilisable** en moins de 90 secondes
- Persister le profil dans `user_profiles` avec `onboarding_completed_at` non-null à la fin
- Permettre la reprise (si l'utilisateur ferme l'onglet à l'étape 3, il revient à l'étape 3)
- Aucun champ n'est obligatoire si le spec ne l'exige pas (timezone et contract_preference sont les seuls NOT NULL en DB)

### 1.2 Architecture

```
app/(protected)/onboarding/
├── page.tsx                  # Server Component — lit le profil existant, route vers la bonne étape
├── layout.tsx                # Wrapper visuel : stepper + container
├── actions.ts                # Server Actions (saveStep1..4, completeOnboarding) avec Zod
├── _components/
│   ├── stepper.tsx           # Indicateur visuel 1/4 → 4/4 (réutilisable)
│   ├── step-1-identity.tsx   # Form étape 1
│   ├── step-2-skills.tsx     # Form étape 2
│   ├── step-3-preferences.tsx# Form étape 3
│   ├── step-4-review.tsx     # Récap + submit final
│   ├── timezone-combobox.tsx # IANA timezone picker (Intl.supportedValuesOf)
│   └── skill-tag-input.tsx   # Tag input avec suggestions
└── _lib/
    ├── schema.ts             # Zod schemas par étape + schéma global
    └── timezones.ts          # Helpers : groupBy region, fallback
```

### 1.3 Découpage des 4 étapes

#### Étape 1 — Identité (très court, low friction)
- **Champs** :
  - `display_name` (TEXT, optionnel) → "How should we call you?"
  - `language` (TEXT, default `'en'`, select EN / FR pour MVP)
- **Validation** : display_name 1–80 chars, language ∈ {en, fr}
- **CTA** : "Continue" → étape 2

#### Étape 2 — Skills & expérience
- **Champs** :
  - `skills` (JSONB array of `{name: string, level: 'junior'|'mid'|'senior'}`)
    - Tag input avec autocomplete (liste seed côté client : ~80 skills tech courants)
    - Niveau sélectionné par chip (3 boutons junior/mid/senior par tag)
    - Min 3 skills, max 15
  - `bio` (TEXT, optionnel, max 500 chars) → textarea avec compteur
- **Validation** : ≥ 3 skills, chaque skill {name 2–40 chars, level enum}
- **CTA** : "Continue" + "Back"

#### Étape 3 — Préférences pro
- **Champs** :
  - `timezone` (TEXT NOT NULL) — combobox des timezones IANA, default = browser detect
  - `contract_preference` (NOT NULL, enum: contractor / employee / both) — radio cards
  - `min_rate_usd` (INTEGER, optionnel) — input numeric avec slider visuel
  - `rate_period` (enum: hour / day / month / year) — select, dépend de min_rate_usd
  - `excluded_regions` (TEXT[]) — checkbox multi-select : `US_ONLY`, `EU_ONLY`, `UK_ONLY`, `CA_ONLY`
- **Validation** : timezone IANA valide, contract requis, si min_rate_usd alors rate_period requis
- **CTA** : "Continue" + "Back"

#### Étape 4 — Review & confirm
- Récap visuel des 3 étapes en lecture seule (cards + bouton "Edit" qui ramène à l'étape concernée)
- Bouton **"Complete profile"** → Server Action `completeOnboarding` :
  - Valide le profil global avec Zod
  - `INSERT … ON CONFLICT (user_id) DO UPDATE` dans `user_profiles`
  - Pose `onboarding_completed_at = now()`
  - `redirect('/feed')`

### 1.4 Persistance

- **Approche retenue** : Server Action par étape (pas de stockage local-only)
  - À chaque "Continue", on `upsert` dans `user_profiles` les champs de l'étape
  - `onboarding_completed_at` reste `NULL` jusqu'à l'étape 4
- **Reprise** : `page.tsx` lit le profil → si `onboarding_completed_at` non null, redirige vers `/feed` ; sinon détermine la première étape incomplète et redirige `/onboarding/step-N` (variante : query param `?step=N`)
- **Pas de champ DB ajouté** : on déduit la "step courante" par les champs déjà remplis
  - Étape 1 OK si `language IS NOT NULL` (default `'en'`, donc toujours OK après premier save)
  - Étape 2 OK si `jsonb_array_length(skills) >= 3`
  - Étape 3 OK si `timezone IS NOT NULL AND contract_preference IS NOT NULL`
  - Étape 4 OK si `onboarding_completed_at IS NOT NULL`

### 1.5 États UI

- **Loading** : skeleton du stepper + skeleton du form pendant le data fetch initial
- **Pending submit** : Button `disabled` + spinner inline + désactivation du form
- **Erreur Zod** : `FormMessage` sous chaque champ (réutilise pattern `login-form.tsx`)
- **Erreur réseau / Supabase** : toast `toastError()` (système déjà en place — voir mémoire #5)
- **Succès intermédiaire** : transition douce vers la step suivante (View Transitions désactivé en phase 1 → simple navigation)
- **Succès final** : redirect immédiat `/feed`, pas de toast (le feed lui-même est la confirmation)

### 1.6 Composants à créer

- [ ] `components/onboarding/stepper.tsx` — barre de progression accessible (`aria-current="step"`)
- [ ] `components/forms/timezone-combobox.tsx` — généralisable, utilisable aussi en `/settings`
- [ ] `components/forms/skill-tag-input.tsx` — tag input avec niveau, généralisable
- [ ] `components/forms/region-checkbox-group.tsx` — pour `excluded_regions`
- [ ] `components/forms/rate-input.tsx` — number + period select couplés

### 1.7 Critères d'acceptation

- [ ] Un utilisateur peut compléter le wizard end-to-end sans erreur console
- [ ] Le profil est persisté en DB après chaque étape (test E2E avec Playwright)
- [ ] Fermer l'onglet à l'étape 2 puis revenir → on est ramené à l'étape 2 avec les données
- [ ] Tous les champs `NOT NULL` du schéma sont remplis avant `onboarding_completed_at`
- [ ] Test RLS : un user ne peut écrire que sur sa propre row (déjà couvert par les policies)
- [ ] Lighthouse a11y ≥ 95 sur chaque step
- [ ] Tous les states (loading, error, pending) ont une représentation visuelle dédiée

---

## Tâche 2 — Feed réel (`/feed`)

**Statut actuel** : stub (EmptyState fixe)
**Spec source** : F-M05 / F-M06 du PDF
**Cible** : afficher de vrais jobs depuis Supabase, filtrés par préférences déclaratives, **sans aucun appel LLM** (ni extraction, ni embedding, ni score IA)

### 2.1 Objectifs

- Liste des jobs actifs depuis `jobs` (table déjà alimentée par le cron d'ingestion)
- Filtrage déclaratif côté serveur via les préférences du profil
- Performance cible : TTFB < 200 ms (requête SQL pure, indexée)
- Bookmark fonctionnel (table `saved_jobs` existe déjà)

### 2.2 Architecture

```
app/(protected)/feed/
├── page.tsx              # Server Component — fetch jobs, render list
├── loading.tsx           # Skeleton (FeedSkeleton existe déjà)
├── error.tsx             # ErrorState
├── _actions.ts           # toggleBookmark Server Action
└── _components/
    ├── feed-filters.tsx  # Filtres clients (timezone, contract, salary, search)
    └── feed-list.tsx     # Wraps JobCard list, gère pagination
```

### 2.3 Stratégie de matching (phase 1, sans IA)

Tant que le scoring IA n'existe pas, on affiche le feed **trié par recency** avec des **filtres durs** dérivés du profil :

| Préférence profil | Filtre SQL appliqué |
|-------------------|---------------------|
| `contract_preference = 'contractor'` | `jobs.contract_type IN ('contractor', 'both', 'unclear')` |
| `contract_preference = 'employee'`   | `jobs.contract_type IN ('employee', 'both', 'unclear')`   |
| `excluded_regions` non vide          | exclure jobs dont `allowed_countries` ∩ excluded ≠ ∅       |
| `min_rate_usd` non null              | `salary_max IS NULL OR salary_max >= min_rate_usd_normalized` |

> **Note** : `contract_type` et `allowed_countries` sont des champs **alimentés par l'IA**. En phase 1 ils sont souvent NULL. Le filtre doit être **permissif** (NULL = on garde, plutôt que rejeter) pour ne pas vider le feed. C'est documenté comme limitation MVP attendue.

Tri : `ORDER BY posted_at DESC NULLS LAST, ingested_at DESC`
Pagination : limit 20 + offset (ou cursor sur `posted_at` pour V2)

### 2.4 États UI

- **Loading** : `FeedSkeleton` (existe) — 5 cards skeleton
- **Empty (aucun job en DB)** : `EmptyState` "No jobs yet, come back in 1h" (cron tourne toutes les heures)
- **Empty (filtres trop stricts)** : `EmptyState` "No matches, try widening your filters" + lien `/settings`
- **Erreur** : `ErrorState` avec retry
- **Succès** : liste de `JobCard` (composant existe, prêt à l'emploi)

### 2.5 Filtres UI (sidebar ou top bar)

Les filtres sont **client-side state** (URL-synced via `useSearchParams`) au-dessus du filtre profil :

- Search texte (titre + description) — utilise l'index FTS existant (`idx_jobs_fulltext`)
- Contract type (override profile)
- Timezone overlap min (slider 0–8h)
- Salary min (slider)
- Source (RemoteOK / WWR / Himalayas — multi-select)

> Le score / red flags ne sont pas affichés tant que l'IA n'est pas branchée. Le `JobCard` les supporte déjà comme props optionnels — on passe juste `undefined` en phase 1.

### 2.6 Bookmark

- Bouton bookmark sur `JobCard` (déjà câblé visuellement)
- Server Action `toggleBookmark(jobId)` :
  - INSERT/DELETE sur `saved_jobs` (table existe, RLS user-owned)
  - Revalidate `/feed` et `/saved`
- Optimistic update via `useOptimistic` (React 19)

### 2.7 Critères d'acceptation

- [ ] La page affiche en < 1s les jobs actifs (mesure local)
- [ ] Un job bookmarké apparaît bookmarké au refresh
- [ ] Filtres URL-synced (partageable, navigable back/forward)
- [ ] Si profil incomplet (`onboarding_completed_at IS NULL`), redirect vers `/onboarding` (Server Component check)
- [ ] Skeleton visible pendant data fetch
- [ ] Empty states distincts selon la cause
- [ ] Mobile : filtres dans un Sheet (composant déjà installé)

---

## Tâche 3 — Polish auth pages

**Statut** : ✅ Terminé (issue #51 — branche 51-ui-polish)
**Ce qui a été fait** :
- Composant partagé `components/auth/auth-layout.tsx` (Card + Logo + h1 + footer)
- `/auth/login` : consume AuthLayout (suppression doublons)
- `/auth/verify` : migration inline styles → Tailwind tokens, `<a>` → `<Link>`, animation pulse `motion-safe:animate-pulse`, liens "Use a different email" + "Back to home"
- `/auth/error` : migration inline styles → Tailwind tokens, dual CTAs (Button "Try again" + Link "Back to home")
- Tests unitaires Vitest : AuthLayout + 3 pages (758 tests total)
- Tests E2E Playwright : visual coherence + XSS guard

### 3.1 `/auth/login`

- Carte centrée déjà OK, à enrichir :
  - Ajouter un visuel Lagoon doux en background (gradient ou pattern SVG décoratif)
  - Animation entrée (fade + translate-y, respect `prefers-reduced-motion`)
  - Sous le bouton : lien "Browse jobs without account" → `/jobs` (page publique à créer en parallèle)
  - Encadré micro-trust : "No password. No spam. Magic link only."

### 3.2 `/auth/verify` (post-magic-link)
- Aujourd'hui : confirmation textuelle après envoi
- Cible :
  - Animation icône email (pulse léger sur l'enveloppe)
  - Compte à rebours visible "Resend available in 30s"
  - Bouton resend avec rate-limit côté DB déjà en place (migration `auth_rate_limits`)
  - Lien "Use a different email" qui reset le form

### 3.3 `/auth/error`
- Cas d'erreur de callback (token expiré, invalid)
- Cible :
  - Illustration discrète (pas dramatique)
  - Message clair par cas d'erreur (mapping query param → message)
  - CTA principal "Send a new link" → retour `/auth/login`

### 3.4 Critères d'acceptation

- [ ] Cohérence visuelle entre les 3 pages (même container, mêmes spacings)
- [ ] Respect `prefers-reduced-motion` partout où il y a animation
- [ ] Tests Lighthouse ≥ 95 a11y
- [ ] Aucun changement de logique server, uniquement UI

---

## Tâche 4 — Landing page v2 (`/`)

**Statut actuel** : hero + 3 cards sample. Fonctionnel mais maigre.
**Cible** : page d'acquisition complète, optimisée pour la conversion magic link

### 4.1 Sections à ajouter

1. **Hero** (existe, à conserver)
2. **"How it works"** — 3 étapes illustrées :
   - 1. Tell us your skills & timezone
   - 2. We surface only jobs that fit
   - 3. Apply with one click — no spray-and-pray
3. **"Why JobNomad"** — différenciation vs concurrents (RemoteOK seul, We Work Remotely seul) :
   - Multi-source aggregé
   - Filtres timezone qui marchent vraiment
   - Pas de cold mailing, pas de tracking aggressif
4. **Sample jobs** (existe — à garder mais ajouter "These are real jobs from today's feed")
5. **Pricing teaser** — Free / Pro stub (Pro arrive avec Stripe en phase 1.5)
6. **FAQ** (5 questions courtes en accordion — composant déjà installé)
7. **Footer CTA** — "Ready to find your next remote role?" + bouton

### 4.2 Performance / SEO

- Toutes les sections en Server Component
- `next/image` pour visuels (whitelist déjà configurée)
- Métadonnées OpenGraph + Twitter Card (à créer dans `app/page.tsx`)
- Sitemap.xml + robots.txt (à créer dans `app/sitemap.ts` et `app/robots.ts`)

### 4.3 Critères d'acceptation

- [ ] Lighthouse perf ≥ 90, SEO ≥ 95
- [ ] LCP < 2.5s sur 3G simulé
- [ ] Toutes les sections accessibles clavier
- [ ] Mobile-first responsive vérifié sur 360px

---

## Annexe A — Pages transverses qui vont apparaître

Ces pages ne sont pas dans la liste prioritaire mais elles deviennent obligatoires dès que les tâches 1-2 sont faites :

- **`/saved`** — liste des jobs bookmarkés (réutilise `JobCard` + filtre `saved_jobs`)
- **`/settings`** — édition du profil (réutilise les composants form de l'onboarding)
- **`/jobs/[id]`** — détail d'un job (réutilise `JobCard variant="detail"`)
- **`/jobs`** — feed public sans filtre profil (pour visiteurs non-authentifiés)

À planifier dans une tâche 5 dédiée une fois que 1+2 sont stables.

## Annexe B — Composants à créer (consolidé)

| Composant | Tâche | Réutilisation |
|-----------|-------|---------------|
| `Stepper` | 1 | onboarding, settings ? |
| `TimezoneCombobox` | 1 | onboarding, settings, filters |
| `SkillTagInput` | 1 | onboarding, settings |
| `RegionCheckboxGroup` | 1 | onboarding, settings |
| `RateInput` | 1 | onboarding, settings, filters |
| `FeedFilters` | 2 | feed, /jobs |
| `FilterSheet` (mobile) | 2 | feed, /jobs |
| `BookmarkButton` (extracted) | 2 | feed, saved, jobs/[id] |

## Annexe C — Out-of-scope explicite (phase 2+)

Ces points sont volontairement reportés :

- **Score de match IA** (le `ScoreBadge` existe mais n'affiche rien tant qu'on n'a pas l'embedding pipeline)
- **Red flags IA** (le `RedFlagBadge` existe mais reste vide)
- **Email digest** (`email_digests` table + Resend webhook)
- **Stripe / pricing payant** (table `subscriptions` existe, page settings paiement attendra)
- **Page `/admin`** ou backoffice
- **i18n complète** (on a `language` en DB mais pas de switcher fonctionnel — `next-intl` arrive après MVP)
- **Notifications in-app** (autre que toast)
- **Onboarding step "Connect LinkedIn"** — explicitement écarté (scope creep)

---

## Suivi

À mesure que les tâches avancent, mettre à jour le statut ici :

- [x] Tâche 1 — Onboarding wizard (issue #8 — branche 8-fm02-onboarding-profil-en-4-etapes-timezone-skills-contrat-taux)
- [ ] Tâche 2 — Feed réel
- [x] Tâche 3 — Polish auth pages
- [ ] Tâche 4 — Landing v2
- [ ] Annexe A — pages transverses
