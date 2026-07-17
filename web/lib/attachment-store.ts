import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type AttachmentStore = {
  provider: "organizer_s3" | "ephemeral_memory" | "platform_legacy";
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  createDownloadUrl(key: string, displayName: string, expiresInSeconds: number): Promise<string | null>;
};

type OrganizerStoreConfig = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  prefix?: string;
  forcePathStyle?: boolean;
};

const memoryGlobal = globalThis as typeof globalThis & { __aryProblemAttachments?: Map<string, Buffer> };
const memoryAttachments = memoryGlobal.__aryProblemAttachments ??= new Map<string, Buffer>();

function safeKey(key: string) {
  if (!/^[a-z0-9/_-]+\.pdf$/i.test(key) || key.includes("..")) throw new Error("INVALID_STORAGE_KEY");
  return key;
}

function safeLocalPath(root: string, key: string) {
  const target = path.resolve(root, safeKey(key)); const resolvedRoot = path.resolve(root);
  if (!target.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("INVALID_STORAGE_KEY");
  return target;
}

function ephemeralMemoryStore(): AttachmentStore {
  return {
    provider: "ephemeral_memory",
    async put(key, body) { memoryAttachments.set(safeKey(key), Buffer.from(body)); },
    async get(key) { const body = memoryAttachments.get(safeKey(key)); if (!body) throw new Error("ATTACHMENT_NOT_FOUND"); return Buffer.from(body); },
    async remove(key) { memoryAttachments.delete(safeKey(key)); },
    async createDownloadUrl() { return null; }
  };
}

function parseOrganizerStores(): Record<string, OrganizerStoreConfig> {
  let parsed: unknown;
  try { parsed = JSON.parse(process.env.ORGANIZER_ATTACHMENT_STORES_JSON ?? "{}"); }
  catch { throw new Error("ORGANIZER_ATTACHMENT_STORES_JSON_INVALID"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("ORGANIZER_ATTACHMENT_STORES_JSON_INVALID");
  return parsed as Record<string, OrganizerStoreConfig>;
}

function organizerS3Store(ownerUserId: string): AttachmentStore {
  const config = parseOrganizerStores()[ownerUserId];
  if (!config?.bucket || !config.region || !config.accessKeyId || !config.secretAccessKey) throw new Error("ORGANIZER_ATTACHMENT_STORE_NOT_CONFIGURED");
  const prefix = (config.prefix ?? "ary-race-problems").replace(/^\/+|\/+$/g, "");
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle === true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, sessionToken: config.sessionToken }
  });
  const objectKey = (key: string) => `${prefix}/${safeKey(key)}`;
  return {
    provider: "organizer_s3",
    async put(key, body) {
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: objectKey(key), Body: body, ContentType: "application/pdf", ServerSideEncryption: "AES256" }));
    },
    async get(key) {
      const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: objectKey(key) }));
      if (!response.Body) throw new Error("ATTACHMENT_NOT_FOUND");
      return Buffer.from(await response.Body.transformToByteArray());
    },
    async remove(key) { await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey(key) })); },
    async createDownloadUrl(key, displayName, expiresInSeconds) {
      const safeName = displayName.replace(/["\\\r\n]/g, "_");
      return getSignedUrl(client, new GetObjectCommand({
        Bucket: config.bucket,
        Key: objectKey(key),
        ResponseContentType: "application/pdf",
        ResponseContentDisposition: `attachment; filename="race-problem.pdf"; filename*=UTF-8''${encodeURIComponent(safeName)}`
      }), { expiresIn: Math.max(30, Math.min(expiresInSeconds, 300)) });
    }
  };
}

export function getAttachmentStore(ownerUserId: string): AttachmentStore {
  const driver = process.env.ATTACHMENT_STORAGE_DRIVER ?? (process.env.NODE_ENV === "production" ? "organizer-s3" : "memory");
  if (driver === "memory") {
    if (process.env.NODE_ENV === "production") throw new Error("MEMORY_ATTACHMENT_STORAGE_FORBIDDEN_IN_PRODUCTION");
    return ephemeralMemoryStore();
  }
  if (driver === "organizer-s3") return organizerS3Store(ownerUserId);
  throw new Error("UNSUPPORTED_ATTACHMENT_STORAGE_DRIVER");
}

export function assertAttachmentStoreConfigured(ownerUserId: string) {
  getAttachmentStore(ownerUserId);
}

export function getLegacyLocalAttachmentStore(): AttachmentStore {
  const root = path.resolve(process.env.ATTACHMENT_LOCAL_ROOT ?? path.join(os.homedir(), ".ary-private-attachments"));
  return {
    provider: "platform_legacy",
    async put(key, body) { const target = safeLocalPath(root, key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, body, { flag: "wx", mode: 0o600 }); },
    async get(key) { return readFile(safeLocalPath(root, key)); },
    async remove(key) { await rm(safeLocalPath(root, key), { force: true }); },
    async createDownloadUrl() { return null; }
  };
}
