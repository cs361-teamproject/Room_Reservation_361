# Room photos. The browser uploads with a presigned POST from the rooms Lambda and reads
# objects through their public URL; the DB stores only object keys.
# Must stay in var.aws_region: the Lambdas reach S3 through the VPC's S3 gateway endpoint.

data "aws_caller_identity" "current" {}

locals {
  photos_bucket_name = "roomres-photos-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
}

resource "aws_s3_bucket" "photos" {
  bucket = local.photos_bucket_name

  # Holds the only copy of every uploaded photo.
  lifecycle {
    prevent_destroy = true
  }
}

# ACLs stay blocked; only the bucket policy below makes objects public.
resource "aws_s3_bucket_public_access_block" "photos" {
  bucket = aws_s3_bucket.photos.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "photos_public_read" {
  bucket = aws_s3_bucket.photos.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadGetObject"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.photos.arn}/*"
    }]
  })

  # A public policy is rejected while BlockPublicPolicy is still on.
  depends_on = [aws_s3_bucket_public_access_block.photos]
}

resource "aws_s3_bucket_cors_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "POST"]
    allowed_origins = var.frontend_origins
    max_age_seconds = 3000
  }
}
