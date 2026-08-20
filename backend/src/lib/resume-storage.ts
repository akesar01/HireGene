import { GridFSBucket, ObjectId } from "mongodb";
import { getDb } from "./mongo.js";

const BUCKET = "resume_pdfs";
const PDF_MAGIC = Buffer.from("%PDF", "utf8");

export function isPdfBuffer(bytes: Buffer): boolean {
  return bytes.length >= 5 && bytes.subarray(0, 4).equals(PDF_MAGIC);
}

export function sanitizeResumeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "resume.pdf";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (cleaned.toLowerCase().endsWith(".pdf") && cleaned.length > 4) {
    return cleaned.slice(0, 120);
  }
  return "resume.pdf";
}

async function getBucket(): Promise<GridFSBucket | null> {
  const db = await getDb();
  if (!db) return null;
  return new GridFSBucket(db, { bucketName: BUCKET });
}

export async function saveResumePdf(opts: {
  userId: string;
  shareSlug: string;
  fileName: string;
  bytes: Buffer;
}): Promise<string> {
  const bucket = await getBucket();
  if (!bucket) {
    throw new Error("Profile service unavailable");
  }

  const existing = bucket.find({ "metadata.userId": opts.userId });
  for await (const doc of existing) {
    await bucket.delete(doc._id);
  }

  const safeName = sanitizeResumeFileName(opts.fileName);
  const upload = bucket.openUploadStream(safeName, {
    metadata: {
      userId: opts.userId,
      shareSlug: opts.shareSlug,
      originalName: safeName,
      contentType: "application/pdf",
    },
  });

  await new Promise<void>((resolve, reject) => {
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(opts.bytes);
  });

  return String(upload.id);
}

export async function loadResumePdfBySlug(shareSlug: string): Promise<{
  bytes: Buffer;
  fileName: string;
} | null> {
  const bucket = await getBucket();
  if (!bucket) return null;

  const doc = await bucket
    .find({ "metadata.shareSlug": shareSlug })
    .sort({ uploadDate: -1 })
    .limit(1)
    .next();
  if (!doc) return null;

  const chunks: Buffer[] = [];
  const stream = bucket.openDownloadStream(doc._id);
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const originalName =
    typeof doc.metadata?.originalName === "string" ? doc.metadata.originalName : "";

  return {
    bytes: Buffer.concat(chunks),
    fileName: sanitizeResumeFileName(originalName || doc.filename || "resume.pdf"),
  };
}

export async function deleteResumePdf(fileId: string): Promise<void> {
  if (!ObjectId.isValid(fileId)) return;
  const bucket = await getBucket();
  if (!bucket) return;
  try {
    await bucket.delete(new ObjectId(fileId));
  } catch {
    // Already gone
  }
}
