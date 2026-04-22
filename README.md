# RandoCours Maroc v1.0.0

Application éducative PWA — Escape Game pédagogique avec IA, QR codes et économie RandoCoins.

## Démarrage rapide

```bash
cp .env.example .env   # Remplir les clés
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed           # Optionnel
pnpm dev               # API :3001 · Web :3000
```

Ou avec Docker :
```bash
docker-compose -f infra/docker/docker-compose.yml up
```

## Architecture

- **Backend** : Express + TypeScript · 7 routes · 6 services · 2 jobs cron
- **Frontend** : Next.js 14 PWA · 8 pages · 3 composants jeu
- **DB** : PostgreSQL (Supabase) · Prisma · 12 tables · trigger APPEND ONLY
- **IA** : Claude Sonnet (Anthropic) · génération QCM + Coach Socrate
- **Infra** : AWS me-south-1 Bahreïn · ECS Fargate · S3 · ElastiCache

## Tests

```bash
pnpm test       # 20 tests Jest
pnpm test:e2e   # 7 tests Playwright
```

## Déploiement

```bash
./infra/scripts/deploy.sh all
```

Voir `docs/DEPLOIEMENT.md` et `docs/API.md` pour les guides complets.

## Conformité Loi 09-08 CNDP Maroc

Données hébergées exclusivement en `me-south-1` (Bahreïn). Trigger APPEND ONLY sur transactions. Anonymisation complète via DELETE /api/v1/auth/me/data.

---
Mohammed Iguider · RandoCours Maroc · 2026
