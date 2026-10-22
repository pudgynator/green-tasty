terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Reserved for ACM certificates once a custom domain is added (CloudFront requires
# certs to live in us-east-1 regardless of the distribution's region).
provider "aws" {
  alias  = "us_west_1"
  region = "us-west-1"
}
