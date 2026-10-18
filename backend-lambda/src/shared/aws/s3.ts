import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getEnv } from '../env';

let client: S3Client | undefined;
let presignClient: S3Client | undefined;

/**
 * Credentials come from the default provider chain (the Lambda execution role on AWS,
 * test keys on LocalStack) - never pass keys explicitly or the session token is lost.
 */
export function getS3(): S3Client {
  if (!client) {
    const { AWS_REGION, AWS_ENDPOINT_URL } = getEnv();
    client = new S3Client({
      region: AWS_REGION,
      // LocalStack serves buckets by path (http://host:4566/bucket/key), not by subdomain
      ...(AWS_ENDPOINT_URL && { endpoint: AWS_ENDPOINT_URL, forcePathStyle: true }),
    });
  }
  return client;
}

export function objectUrl(key: string): string {
  const { S3_PUBLIC_URL, S3_BUCKET, AWS_REGION } = getEnv();
  const base = S3_PUBLIC_URL ?? `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com`;
  return `${base}/${key}`;
}

/** Upload rules for room photos, enforced by S3 itself through the presigned POST policy */
export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PRESIGN_EXPIRES_SECONDS = 300;

function bucket(): string {
  const { S3_BUCKET } = getEnv();
  if (!S3_BUCKET) throw new Error('S3_BUCKET is not set');
  return S3_BUCKET;
}

/** Signing happens locally (no network), so it works from a Lambda in a VPC without NAT */
function getPresignS3(): S3Client {
  const { S3_PRESIGN_ENDPOINT, AWS_REGION } = getEnv();
  if (!S3_PRESIGN_ENDPOINT) return getS3();
  presignClient ??= new S3Client({ region: AWS_REGION, endpoint: S3_PRESIGN_ENDPOINT, forcePathStyle: true });
  return presignClient;
}

/**
 * A browser form upload straight to S3: POST `fields` + the file to `url`.
 * S3 rejects a different Content-Type, a file over PHOTO_MAX_BYTES, or a late upload.
 */
export async function presignPhotoPost(key: string, contentType: string) {
  return createPresignedPost(getPresignS3(), {
    Bucket: bucket(),
    Key: key,
    Conditions: [
      ['content-length-range', 1, PHOTO_MAX_BYTES],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: PRESIGN_EXPIRES_SECONDS,
  });
}

/**
 * Removes an object but never fails the request: the database row is the source of truth,
 * and a Lambda without a route to S3 (no VPC endpoint) should not hang on cleanup.
 */
export async function deleteObjectQuietly(key: string): Promise<void> {
  try {
    await getS3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }), {
      abortSignal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.warn(JSON.stringify({ message: 'S3 delete failed, object left behind', key, error: String(err) }));
  }
}
