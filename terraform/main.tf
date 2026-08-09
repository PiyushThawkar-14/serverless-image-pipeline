data "aws_caller_identity" "current" {}

resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  # S3 bucket names are globally unique, so the shell script appended a UNIX timestamp.
  # A random suffix does the same job but is stored in state, so re-running plan does
  # not propose replacing the bucket the way a fresh timestamp would.
  bucket_name = "${local.name_prefix}-${random_id.suffix.hex}"

  # Both prefixes are load-bearing: the trigger only fires on uploads/ and the handler
  # only writes to processed/, which is what stops the function re-triggering itself.
  upload_prefix    = "uploads/"
  processed_prefix = "processed/"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
