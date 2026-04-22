# ============================================================
# Outputs Terraform — RandoCours Maroc
# Ces valeurs sont disponibles après : terraform apply
# ============================================================

output "alb_dns_name" {
  description = "DNS du Load Balancer — à pointer dans Cloudflare"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID du ALB pour les enregistrements DNS ALIAS"
  value       = aws_lb.main.zone_id
}

output "ecr_api_url" {
  description = "URL du repository ECR pour l'API"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_web_url" {
  description = "URL du repository ECR pour le Web"
  value       = aws_ecr_repository.web.repository_url
}

output "rds_endpoint" {
  description = "Endpoint RDS PostgreSQL"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Endpoint ElastiCache Redis"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "s3_certifications_bucket" {
  description = "Nom du bucket S3 pour les certifications"
  value       = aws_s3_bucket.certifications.bucket
}

output "ecs_cluster_name" {
  description = "Nom du cluster ECS"
  value       = aws_ecs_cluster.main.name
}

# Ces deux outputs sont utilisés par deploy.sh via SSM Parameter Store
output "private_subnet_id" {
  description = "ID du premier subnet privé (pour les ECS tasks)"
  value       = aws_subnet.private[0].id
}

output "ecs_security_group_id" {
  description = "ID du Security Group ECS (pour les ECS tasks)"
  value       = aws_security_group.ecs.id
}

output "database_url" {
  description = "DATABASE_URL complète pour Prisma"
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}"
  sensitive   = true
}

output "acm_certificate_arn" {
  description = "ARN du certificat ACM (à valider via DNS Cloudflare)"
  value       = aws_acm_certificate.main.arn
}

output "acm_dns_validation" {
  description = "Enregistrements DNS à créer dans Cloudflare pour valider le certificat"
  value = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}

output "deployment_instructions" {
  description = "Instructions post-deployment"
  value = <<-EOT
  ============================================================
  DEPLOIEMENT TERMINE — Actions manuelles restantes :
  
  1. DNS Cloudflare :
     → Créer enregistrement CNAME : randocours.ma → ${aws_lb.main.dns_name}
     → Créer enregistrement CNAME : api.randocours.ma → ${aws_lb.main.dns_name}
     → Ajouter les enregistrements ACM de validation (voir acm_dns_validation)
  
  2. Supabase SQL Editor :
     → Exécuter : packages/db/prisma/append_only_trigger.sql
     → Activer RLS sur toutes les tables
  
  3. Premier déploiement :
     → ./infra/scripts/deploy.sh all
  
  4. Seed initial :
     → DATABASE_URL="..." pnpm db:seed
  ============================================================
  EOT
}
