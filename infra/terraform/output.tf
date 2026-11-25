output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs to use in the SAM Lambda VpcConfig."
  value       = [aws_subnet.private_1a.id, aws_subnet.private_1b.id]
}

output "lambda_security_group_id" {
  description = "Lambda security group ID to use in the SAM Lambda VpcConfig."
  value       = aws_security_group.lambda_sg.id
}

output "rds_address" {
  description = "RDS hostname for the application connection string."
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "RDS PostgreSQL port."
  value       = aws_db_instance.postgres.port
}

output "rds_database_name" {
  description = "Application database name."
  value       = aws_db_instance.postgres.db_name
}

output "cognito_user_pool_id" {
  description = "Frontend VITE_COGNITO_USER_POOL_ID."
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "SAM CognitoUserPoolArn parameter."
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_web_client_id" {
  description = "Frontend VITE_COGNITO_CLIENT_ID."
  value       = aws_cognito_user_pool_client.web.id
}

output "cognito_loadtest_client_id" {
  description = "COGNITO_CLIENT_ID for the Locust load test."
  value       = aws_cognito_user_pool_client.loadtest.id
}

output "photos_bucket_name" {
  description = "SAM S3BucketName parameter."
  value       = aws_s3_bucket.photos.id
}

output "photos_public_url" {
  description = "SAM S3PublicUrl parameter."
  value       = "https://${aws_s3_bucket.photos.bucket_regional_domain_name}"
}
