terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend S3 pour stocker le tfstate — à créer AVANT terraform init
  # Commande de création : aws s3api create-bucket --bucket randocours-tfstate \
  #   --region me-south-1 --create-bucket-configuration LocationConstraint=me-south-1
  backend "s3" {
    bucket         = "randocours-tfstate"
    key            = "production/terraform.tfstate"
    region         = "me-south-1"
    encrypt        = true
    # dynamodb_table = "randocours-tfstate-lock"  # optionnel : state locking
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}
