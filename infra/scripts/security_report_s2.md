# Rapport de conformité — Agent Sécurité (A5)
# Session 2 — Base de données + Auth
# Date : Mars 2026

## ✅ Points validés

### Schéma Prisma
- [x] Champ `is_mineur` présent sur `users` — bloquage fonctionnalités RC
- [x] Champ `parent_email` et `consentement_parent` — workflow mineur
- [x] Champ `est_actif` — permet la désactivation sans suppression (Loi 09-08)
- [x] Table `audit_logs` — traçabilité CNDP complète
- [x] Table `transactions` — pas de champ "suppressible", APPEND ONLY par trigger

### Trigger APPEND ONLY
- [x] Trigger `trg_transactions_no_update` défini → empêche UPDATE
- [x] Trigger `trg_transactions_no_delete` défini → empêche DELETE
- [x] Commentaire légal : "Obligations fiscales Maroc — 5 ans minimum"

### Auth Middleware
- [x] Vérification JWT via Supabase (pas de JWT auto-signé côté API)
- [x] `requireRole` refuse avec 403 et log le rôle actuel/requis
- [x] `requireConsentement` bloque les mineurs sans consentement parental

### CNDP Middleware
- [x] `logAccesDonneesPersonnelles` — log asynchrone (ne bloque pas)
- [x] Capture IP (avec support X-Forwarded-For pour proxy)
- [x] Capture User-Agent

### walletService
- [x] `SELECT ... FOR UPDATE` — protection race conditions
- [x] Transaction ACID — rollback automatique si erreur
- [x] Validation montant > 0 avant tout accès DB
- [x] Codes d'erreur explicites (SOLDE_INSUFFISANT, COMPTE_BLOQUE)

## ⚠️ Points à surveiller en Session 7

- [ ] Vérifier que DATABASE_URL pointe vers me-south-1 en production
- [ ] Rotation du SUPABASE_JWT_SECRET en production
- [ ] Activer RLS (Row Level Security) sur Supabase pour toutes les tables
- [ ] S'assurer que le bucket S3 est privé (pas d'accès public par défaut)

## ❌ Non conforme — À corriger avant déploiement

- Aucun point bloquant en Session 2.
