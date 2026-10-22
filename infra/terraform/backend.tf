terraform {
  backend "s3" {
    bucket       = "restaurant-terraform-state-670322849742"
    key          = "restaurant/terraform.tfstate"
    region       = "us-west-2"
    use_lockfile = true
    encrypt      = true
  }
}
