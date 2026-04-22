# RandoCours Maroc — Guide Déploiement AWS Bahreïn

## Prérequis

- AWS CLI configuré avec accès à `me-south-1`
- Docker Desktop installé et lancé
- Terraform >= 1.5.0
- pnpm >= 8.0.0

---

## Étape 1 — Activer la région Bahreïn

```bash
# Dans la console AWS, activer me-south-1
aws ec2 describe-availability-zones --region me-south-1
# Doit retourner les zones disponibles
```

---

## Étape 2 — Créer les secrets AWS Secrets Manager

```bash
# Clé Anthropic
aws secretsmanager create-secret \
  --name randocours/anthropic-api-key \
  --secret-string "sk-ant-api03-..." \
  --region me-south-1

# Supabase Service Role
aws secretsmanager create-secret \
  --name randocours/supabase-service-role \
  --secret-string "eyJhbGci..." \
  --region me-south-1

# QR JWT Secret
aws secretsmanager create-secret \
  --name randocours/qr-jwt-secret \
  --secret-string "$(node -e 'console.log(require("crypto").randomBytes(64).toString("hex"))')" \
  --region me-south-1
```

---

## Étape 3 — Créer le bucket S3 certifications

```bash
aws s3api create-bucket \
  --bucket randocours-certifications \
  --region me-south-1 \
  --create-bucket-configuration LocationConstraint=me-south-1

# Bloquer l'accès public
aws s3api put-public-access-block \
  --bucket randocours-certifications \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Politique CORS pour téléchargement PDF
aws s3api put-bucket-cors \
  --bucket randocours-certifications \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedOrigins": ["https://randocours.ma"],
      "AllowedMethods": ["GET"],
      "MaxAgeSeconds": 3600
    }]
  }'
```

---

## Étape 4 — Créer les repositories ECR

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

# API
aws ecr create-repository \
  --repository-name randocours-api \
  --region me-south-1

# Web
aws ecr create-repository \
  --repository-name randocours-web \
  --region me-south-1

echo "ECR Base: ${ACCOUNT}.dkr.ecr.me-south-1.amazonaws.com"
```

---

## Étape 5 — Appliquer la configuration Terraform

```bash
cd infra/aws

# Initialiser
terraform init

# Planifier
terraform plan \
  -var="db_password=VOTRE_MOT_DE_PASSE_DB" \
  -var="anthropic_api_key_secret_arn=arn:aws:secretsmanager:me-south-1:ACCOUNT:secret:randocours/anthropic-api-key" \
  -var="supabase_service_role_arn=arn:aws:secretsmanager:me-south-1:ACCOUNT:secret:randocours/supabase-service-role" \
  -var="qr_jwt_secret_arn=arn:aws:secretsmanager:me-south-1:ACCOUNT:secret:randocours/qr-jwt-secret"

# Appliquer
terraform apply -auto-approve
```

---

## Étape 6 — Premier déploiement

```bash
# Depuis la racine du projet
chmod +x infra/scripts/deploy.sh
./infra/scripts/deploy.sh all
```

---

## Étape 7 — Migrations base de données

```bash
# Appliquer les migrations Prisma
DATABASE_URL="postgresql://..." pnpm db:migrate:prod

# Appliquer le trigger APPEND ONLY manuellement dans Supabase
# → Coller le contenu de packages/db/prisma/append_only_trigger.sql
# → dans Supabase Dashboard > SQL Editor > Run
```

---

## Étape 8 — Seed initial (optionnel)

```bash
DATABASE_URL="postgresql://..." pnpm db:seed
```

---

## Vérifications post-déploiement

```bash
# Health check API
curl https://api.randocours.ma/health

# Vérifier que les données restent en me-south-1
aws cloudtrail lookup-events \
  --region me-south-1 \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::S3::Bucket

# Vérifier RLS Supabase (Row Level Security)
# → Dashboard Supabase > Authentication > Policies
# → Chaque table doit avoir des policies actives
```

---

## Variables d'environnement ECS (à configurer dans Task Definition)

```
DATABASE_URL            → via Secrets Manager
SUPABASE_URL            → valeur directe
SUPABASE_SERVICE_ROLE_KEY → via Secrets Manager
ANTHROPIC_API_KEY       → via Secrets Manager
QR_JWT_SECRET           → via Secrets Manager
REDIS_URL               → ElastiCache endpoint
AWS_REGION              → me-south-1
APP_URL                 → https://randocours.ma
NODE_ENV                → production
```

---

## Conformité Loi 09-08 CNDP — Checklist finale

- [ ] Toutes les ressources AWS créées en `me-south-1` uniquement
- [ ] Aucune réplication S3 cross-région configurée
- [ ] RDS Multi-AZ en `me-south-1a` et `me-south-1b` uniquement
- [ ] ElastiCache en `me-south-1` uniquement
- [ ] CloudTrail activé pour audit des accès
- [ ] Trigger APPEND ONLY appliqué sur la table `transactions`
- [ ] RLS Supabase activé sur toutes les tables
- [ ] Route DELETE `/auth/me/data` testée et fonctionnelle
- [ ] Workflow mineur testé (inscription + blocage RC sans consentement)
