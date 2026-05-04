# CI/CD — Runbook

Documentation opérationnelle du pipeline CI/CD de JobNomad.

## Architecture

```
PR / push master
       │
       ├─── GitHub Actions (quality gates)
       │         ├── lint         (ESLint)
       │         ├── typecheck    (tsc --noEmit)
       │         ├── unit         (Vitest — mocked, pas de DB)
       │         ├── build        (next build — placeholders CI)
       │         ├── audit        (npm audit --audit-level=high --omit=dev)
       │         ├── actionlint   (validation des fichiers workflow)
       │         ├── gitleaks     (scan secrets — uniquement sur PR)
       │         ├── CodeQL       (SAST JS/TS — sur PR + weekly)
       │         ├── e2e          (Playwright chromium — sur PR, paths filtrés)
       │         └── db           (Supabase local + pgTAP — sur PR, supabase/**)
       │
       └─── Vercel (déploiement)
                 ├── Preview deployment → chaque PR
                 └── Production deployment → push sur master
```

**Principe :** GitHub Actions = portes qualité. Vercel = déploiement.  
Les deux sont indépendants. Vercel ne dépend pas que la CI soit verte
(configurable dans Vercel dashboard > Settings > Git > Required checks).

---

## Workflows GitHub Actions

| Fichier | Déclencheur | Durée estimée |
|---|---|---|
| `ci.yml` | PR + push master | < 3 min (jobs parallèles) |
| `e2e.yml` | PR sur `app/** src/** e2e/** ...` | 2–4 min |
| `db.yml` | PR sur `supabase/**` | ~2 min |
| `codeql.yml` | PR + push master + hebdo (dim 02:00 UTC) | 3–5 min |
| `secret-scan.yml` | PR uniquement | < 1 min |

### Sécurité des workflows

- Toutes les actions tierces sont **pinned à un commit SHA** (pas à un tag).  
  Dependabot surveille les bumps chaque lundi matin.
- `permissions: contents: read` au niveau workflow.  
  Les jobs qui écrivent (CodeQL `security-events: write`) l'élargissent explicitement.
- Les jobs utilisant des secrets sont gated sur  
  `github.event.pull_request.head.repo.full_name == github.repository`  
  → les PRs de forks ne peuvent pas exfiltrer de secrets.
- Le job `build` utilise des **placeholders** (jamais les vraies clés).  
  Les vraies clés ne passent **jamais** dans les logs CI.

---

## Variables d'environnement — matrice complète

| Variable | Expose au browser | Requis pour | Où configurer |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ✅ oui | auth redirects | Vercel + GH Secrets |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ oui | tous les clients | Vercel + GH Secrets |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ oui | client browser | Vercel + GH Secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ jamais | crons + webhooks | Vercel (server) + GH Secrets |
| `CRON_SECRET` | ❌ jamais | auth des crons | Vercel (server) + GH Secrets |
| `RATE_LIMIT_PEPPER` | ❌ jamais | hash IPs rate-limit | Vercel (server) + GH Secrets |
| `RESEND_API_KEY` | ❌ jamais | emails transac. | Vercel (server) + GH Secrets |
| `GEMINI_API_KEY` | ❌ jamais | extraction IA | Vercel (server) + GH Secrets |
| `OPENAI_API_KEY` | ❌ jamais | embeddings | Vercel (server) + GH Secrets |
| `STRIPE_SECRET_KEY` | ❌ jamais | paiements | Vercel (server) + GH Secrets |
| `STRIPE_WEBHOOK_SECRET` | ❌ jamais | validation webhooks | Vercel (server) + GH Secrets |

> **Règle absolue :** les variables `NEXT_PUBLIC_*` ne doivent contenir QUE des valeurs  
> qui peuvent être lues par n'importe qui. Ne jamais y mettre de clé serveur.

---

## Ajouter un secret GitHub Actions

```bash
# Via CLI (recommandé)
gh secret set MA_VARIABLE --body "valeur" --repo Fugushiva/jobnomad

# Vérifier
gh secret list --repo Fugushiva/jobnomad
```

Ou via l'UI : **GitHub > Settings > Secrets and variables > Actions > New repository secret**

---

## Ajouter une variable d'environnement sur Vercel

**Via Vercel CLI (après `vercel login`) :**

```bash
# Production + Preview + Development
vercel env add GEMINI_API_KEY production
vercel env add GEMINI_API_KEY preview
# (development = .env.local, géré localement)
```

**Via l'UI Vercel :**  
Settings > Environment Variables > Add

> Les variables `NEXT_PUBLIC_*` doivent être ajoutées dans Vercel avec le préfixe
> exact — Vercel les injecte dans le bundle client automatiquement.

---

## Rotation du `CRON_SECRET`

Le `CRON_SECRET` est le bearer token qui protège tous les endpoints `/api/cron/**`.

1. Générer un nouveau secret :
   ```bash
   node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'))"
   ```
2. Mettre à jour sur GitHub :
   ```bash
   gh secret set CRON_SECRET --body "<nouveau_secret>" --repo Fugushiva/jobnomad
   ```
3. Mettre à jour sur Vercel (UI ou CLI).
4. Mettre à jour `.env.local` localement.
5. Vérifier que le Vercel Cron appelle bien avec le bon header :
   - Vercel injecte automatiquement `Authorization: Bearer <CRON_SECRET>` si la variable est configurée dans la config cron de `vercel.json`.
   - Si tu appelles manuellement : `curl -H "Authorization: Bearer $CRON_SECRET" https://jobnomad.app/api/cron/ingest`

---

## Configurer Vercel (étapes initiales)

### 1. Importer le projet

1. Aller sur [vercel.com/new](https://vercel.com/new)
2. Cliquer "Import Git Repository" → sélectionner `Fugushiva/jobnomad`
3. Framework Preset: **Next.js** (auto-détecté)
4. Root Directory: laisser vide (racine du repo)
5. Région: **Frankfurt (fra1)**
6. Cliquer "Deploy"

### 2. Configurer les variables d'environnement

Dans **Settings > Environment Variables**, ajouter chaque variable du tableau
ci-dessus pour les environnements **Production** et **Preview** :

```
NEXT_PUBLIC_SITE_URL          = https://jobnomad.app
NEXT_PUBLIC_SUPABASE_URL      = https://sccrhflapbqgdqrarcwu.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY     = eyJ...       (server only)
CRON_SECRET                   = 774d70...    (généré — voir .env.local)
RATE_LIMIT_PEPPER             = 74b9da...    (généré — voir .env.local)
RESEND_API_KEY                = re_...       (quand tu auras la clé)
GEMINI_API_KEY                = AIza...      (quand tu auras la clé)
OPENAI_API_KEY                = sk-proj-...  (quand tu auras la clé)
STRIPE_SECRET_KEY             = sk_live_...  (phase 1B)
STRIPE_WEBHOOK_SECRET         = whsec_...    (phase 1B)
```

### 3. Activer les Preview Deployments

Par défaut actif. Vérifier dans Settings > Git > Preview Deployments : **On**.

### 4. Relier les checks GitHub

Dans Settings > Git :
- "Required Checks" : ajouter `lint`, `typecheck`, `unit tests`, `build`
- Vercel postera un commentaire de preview URL sur chaque PR automatiquement.

---

## Branch protection sur `master`

Configurée via `gh api` (voir commit `chore(ci)`).

Règles actives :
- **Required status checks** : `lint`, `typecheck`, `unit tests`, `build`
- **Strict status checks** : oui (la branche doit être à jour avec master)
- **Linear history** : oui (no merge commits)
- **Force push** : interdit
- **Admin bypass** : oui (toi tu peux merger même si CI rouge — à utiliser avec parcimonie)
- **Require conversation resolution** : non (solo dev)

Pour modifier via `gh api` :
```bash
gh api --method PUT /repos/Fugushiva/jobnomad/branches/master/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      {"context": "lint", "app_id": -1},
      {"context": "typecheck", "app_id": -1},
      {"context": "unit tests", "app_id": -1},
      {"context": "build", "app_id": -1}
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true,
  "required_conversation_resolution": false
}
EOF
```

---

## Déboguer un build qui échoue

### La CI est rouge sur mon PR — que faire ?

1. Cliquer sur le check qui échoue dans la PR
2. Cliquer "Details" → voir les logs du job
3. Reproduire localement :

```bash
# Lint
npm run lint

# Typecheck
npm run typecheck

# Tests
npm run test

# Build (utilise tes vraies vars locales)
npm run build
```

### Le build passe en local mais pas en CI

Cause probable : **variable d'environnement manquante en CI**.

Le `build` CI utilise des placeholders. Si ton code référence une var qui n'est
pas dans le bloc `env:` du job `build` dans `ci.yml`, Next.js plantera.

Solution : ajouter un placeholder dans `ci.yml` → job `build` → bloc `env:`.

### La DB suite (pgTAP) échoue

```bash
# Localement (nécessite Docker)
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase stop
```

### Playwright échoue en CI mais pas en local

- Vérifier que `playwright.config.ts` a bien `forbidOnly: !!process.env.CI`
- Le rapport HTML est uploadé comme artifact dans GitHub Actions (onglet Summary du run).
- Télécharger `playwright-report.zip` → ouvrir `index.html` pour voir les screenshots.

---

## Dependabot

Dependabot soumet des PRs automatiquement chaque lundi matin pour :
- Les packages npm (patch + minor groupés en 1 PR)
- Les actions GitHub (SHAs mis à jour)

Pour reviewer une PR Dependabot :
1. Lire le changelog de la lib (lien dans la PR)
2. S'assurer que la CI est verte
3. Merger avec "Squash and merge" pour garder l'historique linéaire

---

## Liens utiles

- [GitHub Actions runs](https://github.com/Fugushiva/jobnomad/actions)
- [Vercel dashboard](https://vercel.com/dashboard)
- [Supabase dashboard](https://supabase.com/dashboard/project/sccrhflapbqgdqrarcwu)
- [CodeQL alerts](https://github.com/Fugushiva/jobnomad/security/code-scanning)
- [Dependabot alerts](https://github.com/Fugushiva/jobnomad/security/dependabot)
