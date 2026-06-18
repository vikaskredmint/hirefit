import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

export const s3 = new S3Client({
  region: config.s3.region,
  endpoint: config.s3.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

const safeName = (name) =>
  (name || "resume.pdf")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

export async function uploadResumeFile({ candidateId, file }) {
  const key = `resumes/${candidateId}/${Date.now()}-${safeName(file.originalname)}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || "application/pdf",
    }),
  );
  return { key, signedUrl: await signResumeUrl(key) };
}

export const uploadResumePdf = uploadResumeFile;

export async function signResumeUrl(key, expiresIn = 60 * 60 * 24 * 7) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
    }),
    { expiresIn },
  );
}
