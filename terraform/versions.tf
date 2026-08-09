terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Local state is deliberate for a single-developer demo stack. A shared backend
  # (S3 + DynamoDB locking) is the first thing to add before more than one person
  # or a CI job runs apply.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}
