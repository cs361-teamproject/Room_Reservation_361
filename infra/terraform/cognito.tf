# Cognito: login for the frontend and the API Gateway authorizer in the SAM stack.
# Users themselves are data, not config: they are created outside Terraform.
# The backend matches users by cognito:username (User.username in the DB), so a rebuilt pool
# works as long as the same usernames are recreated.

resource "aws_cognito_user_pool" "main" {
  name = "room-reserve-pool"

  # Deleting the pool deletes every user and their passwords; keep two guards on it.
  deletion_protection = "ACTIVE"
  lifecycle {
    prevent_destroy = true
  }

  auto_verified_attributes = ["email"]
  mfa_configuration        = "OFF"

  password_policy {
    minimum_length                   = 8
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Schema attributes cannot change after creation: any diff here replaces the pool.
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 0
      max_length = 2048
    }
  }
}

# Role groups. The API reads the role from the DB, these mirror it for the console.
resource "aws_cognito_user_group" "roles" {
  for_each     = toset(["student", "lecturer", "staff", "admin"])
  name         = each.key
  user_pool_id = aws_cognito_user_pool.main.id
}

# Clients have no client secret. Leave generate_secret unset (default false): import never
# reads it back, so writing it out forces both clients to be replaced with new IDs.

# Frontend: our own login form (pages/Login.tsx) with SRP, no Hosted UI.
resource "aws_cognito_user_pool_client" "web" {
  name         = "Room-reservation"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 5
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
}

# Locust load test (loadtest/locustfile.py) logs in with plain USER_PASSWORD_AUTH.
resource "aws_cognito_user_pool_client" "loadtest" {
  name         = "roomres-loadtest"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]
}
