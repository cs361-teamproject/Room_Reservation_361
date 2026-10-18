import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  STAGE: z.string().default('local'),
  DATABASE_URL: z.string().url(),
  ALLOWED_ORIGINS: csv,
  AWS_REGION: z.string().default('ap-southeast-1'),
  // Set only when running against LocalStack; unset on real AWS
  AWS_ENDPOINT_URL: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  // Local only: lets STAGE=local verify Bearer ID tokens itself (on AWS, API Gateway does it)
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
  // Endpoint written into presigned upload URLs, for when the browser cannot reach AWS_ENDPOINT_URL
  // (LocalStack Lambdas use http://localstack:4566; the browser needs http://localhost:4566)
  S3_PRESIGN_ENDPOINT: z.string().url().optional(),
  S3_PUBLIC_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Env vars come from the Lambda configuration (or `--env-file` in dev); validated once per container. */
export function getEnv(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
    }
    cached = parsed.data;
  }
  return cached;
}
