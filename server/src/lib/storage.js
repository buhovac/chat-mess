import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";

// Cloudflare R2 speaks the S3 API, so the official AWS SDK works as-is —
// only the endpoint changes. The bucket is PRIVATE: files are only ever
// read back through GET /api/attachments/:messageId, which checks
// membership first (see modules/messages/attachments.js).

const r2EnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

const parsed = r2EnvSchema.safeParse(process.env);

// Required in production: fail at boot, like JWT_SECRET does in jwt.js,
// rather than discovering a misconfigured bucket on the first upload.
// Elsewhere (local dev, tests, CI) it's optional so nobody needs R2 keys
// just to run the app — the upload route answers 503 instead.
if (!parsed.success && process.env.NODE_ENV === "production") {
  const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`R2 storage env vars missing or empty: ${missing}`);
}

const config = parsed.success ? parsed.data : null;

const client = config
  ? new S3Client({
      // R2 has no regions; "auto" is the value Cloudflare documents.
      region: "auto",
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.R2_ACCESS_KEY_ID, secretAccessKey: config.R2_SECRET_ACCESS_KEY },
    })
  : null;

export function isStorageConfigured() {
  return client !== null;
}

export async function uploadFile(buffer, key, contentType) {
  await client.send(
    new PutObjectCommand({ Bucket: config.R2_BUCKET, Key: key, Body: buffer, ContentType: contentType }),
  );
}

// Returns a Node readable stream so the route can pipe the file to the
// client without buffering it all in memory.
export async function getFileStream(key) {
  const result = await client.send(new GetObjectCommand({ Bucket: config.R2_BUCKET, Key: key }));
  return result.Body;
}
