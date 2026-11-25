variable "aws_region" {
  description = "AWS region for the infrastructure."
  type        = string
  default     = "ap-southeast-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_username" {
  description = "Master username for PostgreSQL."
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "Master password for PostgreSQL. Supply through an ignored tfvars file or TF_VAR_db_password."
  type        = string
  sensitive   = true
}

variable "db_engine_version" {
  description = "PostgreSQL 17 minor version supported in the selected AWS region."
  type        = string
  default     = "17.9"
}

variable "frontend_origins" {
  description = "Browser origins of the frontend, allowed by the photos bucket CORS rule. Keep in sync with the SAM AllowedOrigins parameter."
  type        = list(string)
  default = [
    "https://main.d1y960msxzwtz9.amplifyapp.com",
    "http://localhost:5173",
  ]
}

variable "rds_night_stop_enabled" {
  description = "Run the nightly RDS stop/start schedules. Off until the project hand-in, so late work and demos still reach the DB."
  type        = bool
  default     = false
}

variable "rds_stop_cron" {
  description = "When to stop the DB, EventBridge cron in Asia/Bangkok."
  type        = string
  default     = "cron(0 2 * * ? *)"
}

variable "rds_start_cron" {
  description = "When to start the DB, EventBridge cron in Asia/Bangkok. Start takes ~5-10 minutes."
  type        = string
  default     = "cron(0 7 * * ? *)"
}
