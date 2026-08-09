variable "aws_region" {
  description = "Region the whole stack is created in."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Prefix for every resource name, so two deployments never collide."
  type        = string
  default     = "image-pipeline"

  validation {
    condition     = can(regex("^[a-z0-9-]{3,32}$", var.project_name))
    error_message = "project_name must be 3-32 characters of lowercase letters, digits or hyphens (it becomes part of an S3 bucket name)."
  }
}

variable "environment" {
  description = "Deployment environment, used in resource names and tags."
  type        = string
  default     = "dev"
}

variable "lambda_memory_mb" {
  description = "Lambda memory. sharp decodes the whole image in memory, so 512 MB is the practical floor for photos."
  type        = number
  default     = 1024

  validation {
    condition     = var.lambda_memory_mb >= 512 && var.lambda_memory_mb <= 10240
    error_message = "lambda_memory_mb must be between 512 and 10240."
  }
}

variable "lambda_timeout_seconds" {
  description = "Lambda timeout. Resizing is fast; a long timeout only makes a stuck invocation more expensive."
  type        = number
  default     = 30
}

variable "log_retention_days" {
  description = "CloudWatch log retention. The shell scripts let Lambda auto-create log groups that never expire, which quietly bills forever."
  type        = number
  default     = 14
}

variable "enable_sns_notifications" {
  description = "Create an SNS topic and point the handler at it. Off by default to match the shell-script stack."
  type        = bool
  default     = false
}

variable "sns_subscription_email" {
  description = "Optional email to subscribe to the topic. AWS sends a confirmation mail that must be clicked."
  type        = string
  default     = ""
}
