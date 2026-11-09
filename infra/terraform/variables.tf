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
