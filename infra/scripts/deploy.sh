#!/bin/bash
# ============================================================
# RandoCours Maroc — Script de déploiement AWS Bahreïn
# Région : me-south-1 (Bahreïn) — Conformité Loi 09-08 CNDP
# Usage : ./infra/scripts/deploy.sh [api|web|all]
# Prérequis : terraform apply exécuté au moins une fois
# ============================================================

set -euo pipefail

AWS_REGION="me-south-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ECR_REPO_API="${ECR_BASE}/randocours-api"
ECR_REPO_WEB="${ECR_BASE}/randocours-web"
ECS_CLUSTER="randocours-cluster"
ECS_SERVICE_API="randocours-api-service"
ECS_SERVICE_WEB="randocours-web-service"
GIT_SHA=$(git rev-parse --short HEAD)
DEPLOY_TARGET="${1:-all}"
TERRAFORM_DIR="$(dirname "$0")/../aws"

resolve_network_config() {
  echo "-> Lecture des IDs réseau depuis Terraform outputs..."
  if command -v terraform &>/dev/null && [ -f "${TERRAFORM_DIR}/terraform.tfstate" ]; then
    SUBNET_ID=$(terraform -chdir="${TERRAFORM_DIR}" output -raw private_subnet_id 2>/dev/null || echo "")
    SG_ID=$(terraform -chdir="${TERRAFORM_DIR}" output -raw ecs_security_group_id 2>/dev/null || echo "")
  else
    echo "  Tentative lecture SSM Parameter Store..."
    SUBNET_ID=$(aws ssm get-parameter --name "/randocours/network/private-subnet-id" \
      --region "${AWS_REGION}" --query "Parameter.Value" --output text 2>/dev/null || echo "")
    SG_ID=$(aws ssm get-parameter --name "/randocours/network/ecs-sg-id" \
      --region "${AWS_REGION}" --query "Parameter.Value" --output text 2>/dev/null || echo "")
  fi

  if [[ -z "${SUBNET_ID:-}" || -z "${SG_ID:-}" ]]; then
    echo "ERREUR : SUBNET_ID ou SG_ID introuvable."
    echo "Solution : cd infra/aws && terraform apply"
    echo "Ou : export SUBNET_ID=subnet-xxx SG_ID=sg-xxx && ./deploy.sh"
    exit 1
  fi
  echo "  SUBNET_ID = ${SUBNET_ID}"
  echo "  SG_ID     = ${SG_ID}"
}

echo "========================================================"
echo "  RandoCours Maroc — Deploiement AWS ${AWS_REGION}"
echo "  Commit : ${GIT_SHA} | Cible : ${DEPLOY_TARGET}"
echo "========================================================"

echo "-> Connexion AWS ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login --username AWS --password-stdin "${ECR_BASE}"

build_and_push() {
  local SERVICE=$1 DOCKERFILE=$2 ECR_REPO=$3
  echo ""
  echo "-> Build ${SERVICE}..."
  docker build -f "${DOCKERFILE}" \
    -t "${ECR_REPO}:${GIT_SHA}" -t "${ECR_REPO}:latest" \
    --platform linux/amd64 .
  docker push "${ECR_REPO}:${GIT_SHA}"
  docker push "${ECR_REPO}:latest"
  echo "OK : ${ECR_REPO}:${GIT_SHA}"
}

run_migrations() {
  resolve_network_config
  echo ""
  echo "-> Migration Prisma via ECS task..."
  TASK_ARN=$(aws ecs run-task \
    --cluster "${ECS_CLUSTER}" \
    --task-definition randocours-migrate \
    --region "${AWS_REGION}" \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_ID}],securityGroups=[${SG_ID}],assignPublicIp=DISABLED}" \
    --query 'tasks[0].taskArn' --output text)
  echo "  Task : ${TASK_ARN}"
  aws ecs wait tasks-stopped --cluster "${ECS_CLUSTER}" --tasks "${TASK_ARN}" --region "${AWS_REGION}"
  EXIT_CODE=$(aws ecs describe-tasks --cluster "${ECS_CLUSTER}" --tasks "${TASK_ARN}" \
    --region "${AWS_REGION}" --query 'tasks[0].containers[0].exitCode' --output text)
  if [[ "${EXIT_CODE}" != "0" ]]; then
    echo "ERREUR : Migration echouee (exit: ${EXIT_CODE}) — voir CloudWatch Logs"
    exit 1
  fi
  echo "OK : Migrations appliquees"
}

update_ecs() {
  local SERVICE=$1 ECS_SERVICE=$2
  echo ""
  echo "-> Update ECS ${SERVICE}..."
  aws ecs update-service --cluster "${ECS_CLUSTER}" --service "${ECS_SERVICE}" \
    --force-new-deployment --region "${AWS_REGION}" \
    --output text --query 'service.serviceName'
  aws ecs wait services-stable --cluster "${ECS_CLUSTER}" \
    --services "${ECS_SERVICE}" --region "${AWS_REGION}"
  echo "OK : ${SERVICE} stable"
}

if [[ "${DEPLOY_TARGET}" == "api" || "${DEPLOY_TARGET}" == "all" ]]; then
  build_and_push "API" "infra/docker/Dockerfile.api" "${ECR_REPO_API}"
  run_migrations
  update_ecs "API" "${ECS_SERVICE_API}"
fi

if [[ "${DEPLOY_TARGET}" == "web" || "${DEPLOY_TARGET}" == "all" ]]; then
  build_and_push "Web" "infra/docker/Dockerfile.web" "${ECR_REPO_WEB}"
  update_ecs "Web" "${ECS_SERVICE_WEB}"
fi

echo ""
echo "========================================================"
echo "  DEPLOIEMENT TERMINE — ${GIT_SHA}"
echo "  Region : ${AWS_REGION} (Bahrein — Loi 09-08 conforme)"
echo "========================================================"

if [[ "${DEPLOY_TARGET}" == "all" ]]; then
  git tag -a "deploy-$(date +%Y%m%d)-${GIT_SHA}" \
    -m "Deploy $(date '+%Y-%m-%d %H:%M') SHA:${GIT_SHA}" 2>/dev/null || true
fi
