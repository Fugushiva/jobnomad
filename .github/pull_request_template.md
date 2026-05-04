## Description

<!-- What does this PR do? Why is it needed? Link to the issue: fixes #XX -->

## Type de changement

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (requires migration or env update)
- [ ] Refactor / cleanup
- [ ] CI/CD / infra
- [ ] Documentation

## Checklist

### Code
- [ ] Les tests existants passent localement (`npm run test`)
- [ ] Les nouveaux comportements ont des tests associés
- [ ] TypeScript sans erreur (`npm run typecheck`)
- [ ] ESLint sans warning (`npm run lint`)
- [ ] Build local vert (`npm run build`)

### Sécurité
- [ ] Aucun secret ou valeur sensible dans le code ou les logs
- [ ] Toute nouvelle table Supabase a RLS activé + politique `user_id = auth.uid()`
- [ ] Toute Server Action appelle `supabase.auth.getUser()` avant mutation
- [ ] Les inputs externes sont validés avec Zod

### Variables d'environnement
- [ ] Toute nouvelle variable est ajoutée à `.env.example` (sans valeur)
- [ ] Les variables `NEXT_PUBLIC_*` ne contiennent que des valeurs publiques
- [ ] `SUPABASE_SERVICE_ROLE_KEY` n'est référencé que dans `src/lib/supabase/service.ts` et `app/api/cron/**`

### Base de données (si applicable)
- [ ] Migration SQL versionnée dans `supabase/migrations/`
- [ ] Tests RLS pgTAP ajoutés/mis à jour dans `supabase/tests/`

## Notes pour le reviewer

<!-- Contexte supplémentaire, captures d'écran, points d'attention -->
