# ============================================================
# RandoCours Maroc — Variables Terraform AWS Bahreïn
# Région : me-south-1 (Bahreïn) — Conformité Loi 09-08 CNDP
# ============================================================

variable "aws_region" {
  description = "Région AWS — me-south-1 (Bahreïn) pour conformité Loi 09-08 Maroc"
  type        = string
  default     = "me-south-1"
}

variable "environment" {
  description = "Environnement de déploiement"
  type        = string
  default     = "production"
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "L'environnement doit être development, staging ou production."
  }
}

variable "app_name" {
  description = "Nom de l'application"
  type        = string
  default     = "randocours-maroc"
}

# ── ECS Fargate ───────────────────────────────────────────────
variable "ecs_cluster_name" {
  description = "Nom du cluster ECS Fargate"
  type        = string
  default     = "randocours-cluster"
}

variable "api_task_cpu" {
  description = "CPU alloué à la tâche API (unités ECS)"
  type        = number
  default     = 512 # 0.5 vCPU
}

variable "api_task_memory" {
  description = "Mémoire allouée à la tâche API (MiB)"
  type        = number
  default     = 1024 # 1 GB
}

variable "web_task_cpu" {
  description = "CPU alloué à la tâche Web (unités ECS)"
  type        = number
  default     = 256
}

variable "web_task_memory" {
  description = "Mémoire allouée à la tâche Web (MiB)"
  type        = number
  default     = 512
}

variable "api_desired_count" {
  description = "Nombre d'instances API souhaitées"
  type        = number
  default     = 2 # Haute disponibilité
}

variable "web_desired_count" {
  description = "Nombre d'instances Web souhaitées"
  type        = number
  default     = 2
}

# ── RDS PostgreSQL ────────────────────────────────────────────
variable "db_instance_class" {
  description = "Classe d'instance RDS"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "Nom de la base de données"
  type        = string
  default     = "randocours"
}

variable "db_username" {
  description = "Nom d'utilisateur PostgreSQL"
  type        = string
  default     = "randocours_admin"
  sensitive   = true
}

variable "db_password" {
  description = "Mot de passe PostgreSQL (géré via AWS Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "db_allocated_storage" {
  description = "Stockage RDS alloué (Go)"
  type        = number
  default     = 20
}

# ── ElastiCache Redis ─────────────────────────────────────────
variable "redis_node_type" {
  description = "Type de nœud ElastiCache Redis"
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_num_cache_nodes" {
  description = "Nombre de nœuds Redis"
  type        = number
  default     = 1
}

# ── S3 ────────────────────────────────────────────────────────
variable "s3_bucket_certifications" {
  description = "Nom du bucket S3 pour les certifications PDF"
  type        = string
  default     = "randocours-certifications"
}

variable "s3_versioning_enabled" {
  description = "Activer le versioning S3"
  type        = bool
  default     = true
}

# ── Réseau ────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR du VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Zones de disponibilité en me-south-1"
  type        = list(string)
  default     = ["me-south-1a", "me-south-1b"]
}

# ── Secrets (via AWS Secrets Manager) ────────────────────────
variable "anthropic_api_key_secret_arn" {
  description = "ARN du secret Anthropic API Key dans AWS Secrets Manager"
  type        = string
}

variable "supabase_service_role_arn" {
  description = "ARN du secret Supabase Service Role Key"
  type        = string
}

variable "qr_jwt_secret_arn" {
  description = "ARN du secret QR JWT Secret"
  type        = string
}

# ── Tags obligatoires ─────────────────────────────────────────
variable "tags" {
  description = "Tags appliqués à toutes les ressources AWS"
  type        = map(string)
  default = {
    Project     = "RandoCours Maroc"
    Environment = "production"
    ManagedBy   = "Terraform"
    Compliance  = "Loi-09-08-CNDP-Maroc"
    DataRegion  = "me-south-1-Bahrein"
  }
}
