/**
 * Bucket S3-compatibil (Railway Buckets) pentru pozele de bonuri/facturi.
 * Fișierele sunt private: la afișare se generează un URL presemnat, valabil câteva minute.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface S3Config { endpoint: string; bucket: string; region: string; accessKeyId: string; secretAccessKey: string; forcePathStyle: boolean }

function readConfig(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, region: process.env.S3_REGION || 'auto', forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' };
}

let cached: { client: S3Client; bucket: string } | null = null;

function s3() {
  if (cached) return cached;
  const cfg = readConfig();
  if (!cfg) throw new Error('Bucket-ul S3 nu e configurat (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).');
  cached = {
    bucket: cfg.bucket,
    client: new S3Client({
      endpoint: cfg.endpoint, region: cfg.region, forcePathStyle: cfg.forcePathStyle,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    }),
  };
  return cached;
}

export function storageConfigured(): boolean {
  return readConfig() !== null;
}

/** Urcă fișierul și întoarce cheia + un URL de referință (privat; pentru afișare folosește presignedUrl). */
export async function putFile(key: string, body: Uint8Array, mime: string): Promise<{ key: string; url: string }> {
  const { client, bucket } = s3();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: mime }));
  return { key, url: `s3://${bucket}/${key}` };
}

export async function presignedUrl(key: string, expiresInSec = 300): Promise<string> {
  const { client, bucket } = s3();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: expiresInSec });
}

export async function getFileBytes(key: string): Promise<Uint8Array> {
  const { client, bucket } = s3();
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Fișierul ${key} e gol.`);
  return res.Body.transformToByteArray();
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };

/** bonuri/2026-10/<submissionId>-<n>.jpg */
export function submissionFileKey(submissionId: string, n: number, mime: string, now = new Date()): string {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `bonuri/${month}/${submissionId}-${n}.${EXT[mime] ?? 'bin'}`;
}
