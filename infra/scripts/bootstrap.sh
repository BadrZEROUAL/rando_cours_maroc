#!/bin/bash
# ============================================================
# RandoCours Maroc — Bootstrap AWS (à exécuter UNE SEULE FOIS)
# Crée les ressources nécessaires avant terraform init
# Usage : ./infra/scripts/bootstrap.sh
# ============================================================

set -euo pipefail

AWS_REGION="me-south-1"
APP_NAME="randocours-maroc"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "========================================================"
echo "  Bootstrap AWS RandoCours Maroc"
echo "  Compte : ${ACCOUNT_ID} | Région : ${AWS_REGION}"
echo "========================================================"

# ── 1. Activer la région Bahreïn ──────────────────────────────
echo ""
echo "-> Vérification région ${AWS_REGION}..."
aws ec2 describe-availability-zones --region "${AWS_REGION}" \
  --query 'AvailabilityZones[0].State' --output text || {
  echo "ERREUR : Région ${AWS_REGION} non disponible."
  echo "Activez-la dans : AWS Console > Account Settings > Regions"
  exit 1
}
echo "OK : Région ${AWS_REGION} disponible"

# ── 2. Bucket S3 pour le tfstate Terraform ────────────────────
echo ""
echo "-> Création bucket tfstate..."
if aws s3api head-bucket --bucket "${APP_NAME}-tfstate" --region "${AWS_REGION}" 2>/dev/null; then
  echo "OK : Bucket tfstate existe déjà"
else
  aws s3api create-bucket \
    --bucket "${APP_NAME}-tfstate" \
    --region "${AWS_REGION}" \
    --create-bucket-configuration LocationConstraint="${AWS_REGION}"
  
  aws s3api put-bucket-versioning \
    --bucket "${APP_NAME}-tfstate" \
    --versioning-configuration Status=Enabled
  
  aws s3api put-bucket-encryption \
    --bucket "${APP_NAME}-tfstate" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  
  echo "OK : Bucket ${APP_NAME}-tfstate créé"
fi

# ── 3. Secrets dans AWS Secrets Manager ──────────────────────
echo ""
echo "-> Création des secrets (valeurs à remplir manuellement)..."

create_secret() {
  local NAME=$1
  local DESC=$2
  local PLACEHOLDER=$3
  
  if aws secretsmanager describe-secret --secret-id "${NAME}" \
    --region "${AWS_REGION}" &>/dev/null; then
    echo "  OK (existe): ${NAME}"
  else
    aws secretsmanager create-secret \
      --name "${NAME}" \
      --description "${DESC}" \
      --secret-string "${PLACEHOLDER}" \
      --region "${AWS_REGION}" \
      --output text --query 'ARN'
    echo "  CREE : ${NAME}"
    echo "  !! Mettre à jour la valeur avec votre vraie clé !!"
  fi
}

create_secret \
  "randocours/anthropic-api-key" \
  "Anthropic API Key pour Claude Sonnet" \
  "REMPLACER_PAR_sk-ant-api03-..."

create_secret \
  "randocours/supabase-service-role" \
  "Supabase Service Role Key" \
  "REMPLACER_PAR_eyJhbGci..."

create_secret \
  "randocours/qr-jwt-secret" \
  "Secret JWT pour les QR codes RandoCours" \
  "$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null || openssl rand -hex 64)"

# Récupérer les ARNs pour Terraform
ANTHROPIC_ARN=$(aws secretsmanager describe-secret \
  --secret-id "randocours/anthropic-api-key" \
  --region "${AWS_REGION}" --query 'ARN' --output text)
SUPABASE_ARN=$(aws secretsmanager describe-secret \
  --secret-id "randocours/supabase-service-role" \
  --region "${AWS_REGION}" --query 'ARN' --output text)
QR_JWT_ARN=$(aws secretsmanager describe-secret \
  --secret-id "randocours/qr-jwt-secret" \
  --region "${AWS_REGION}" --query 'ARN' --output text)

# ── 4. Générer terraform.tfvars ───────────────────────────────
echo ""
echo "-> Génération de terraform.tfvars..."
cat > "$(dirname "$0")/../aws/terraform.tfvars" << TFVARS
# ============================================================
# Auto-généré par bootstrap.sh le $(date '+%Y-%m-%d %H:%M')
# NE PAS COMMITTER CE FICHIER (déjà dans .gitignore)
# ============================================================

aws_region = "${AWS_REGION}"
environment = "production"
app_name    = "${APP_NAME}"

# Base de données — CHANGER le mot de passe !
db_password = "CHANGER_CE_MOT_DE_PASSE_$(openssl rand -hex 8)"
db_username = "randocours_admin"
db_name     = "randocours"

# Secrets Manager ARNs (auto-renseignés)
anthropic_api_key_secret_arn = "${ANTHROPIC_ARN}"
supabase_service_role_arn    = "${SUPABASE_ARN}"
qr_jwt_secret_arn            = "${QR_JWT_ARN}"
TFVARS

echo "OK : infra/aws/terraform.tfvars généré"

# ── 5. ECR Repositories ───────────────────────────────────────
echo ""
echo "-> Création des repositories ECR..."

for REPO in "${APP_NAME}-api" "${APP_NAME}-web"; do
  if aws ecr describe-repositories --repository-names "${REPO}" \
    --region "${AWS_REGION}" &>/dev/null; then
    echo "  OK (existe): ${REPO}"
  else
    aws ecr create-repository \
      --repository-name "${REPO}" \
      --region "${AWS_REGION}" \
      --image-scanning-configuration scanOnPush=true \
      --output text --query 'repository.repositoryUri'
    echo "  CREE : ${REPO}"
  fi
done

# ── 6. Log group CloudWatch pour les migrations ───────────────
aws logs create-log-group \
  --log-group-name "/ecs/${APP_NAME}-migrate" \
  --region "${AWS_REGION}" 2>/dev/null || true

# ── Résumé ────────────────────────────────────────────────────
echo ""
echo "========================================================"
echo "  Bootstrap terminé !"
echo ""
echo "  Actions MANUELLES restantes avant terraform apply :"
echo ""
echo "  1. Mettre à jour les secrets :"
echo "     aws secretsmanager update-secret \\"
echo "       --secret-id randocours/anthropic-api-key \\"
echo "       --secret-string 'sk-ant-api03-VOTRE_VRAIE_CLE' \\"
echo "       --region ${AWS_REGION}"
echo ""
echo "  2. Mettre à jour infra/aws/terraform.tfvars :"
echo "     - Changer db_password"
echo "     - Ajouter SUPABASE_URL si nécessaire"
echo ""
echo "  3. Puis lancer :"
echo "     cd infra/aws"
echo "     terraform init"
echo "     terraform plan"
echo "     terraform apply"
echo "========================================================"
