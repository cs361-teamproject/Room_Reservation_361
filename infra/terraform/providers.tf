terraform {
  backend "s3" {
    bucket       = "roomres-terraform-state-568318158381-ap-southeast-1"
    key          = "room-reservation/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
