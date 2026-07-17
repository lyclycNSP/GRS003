import process from "node:process";
import fs from "node:fs";
import path from "node:path";

const errors = [];
const required = ["DATABASE_URL", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "NEXT_PUBLIC_APP_URL", "CA_CONNECTOR_KEYS", "DEFAULT_CA_CONNECTOR_ID", "TRACK_ASSET_ROOT", "ORGANIZER_ATTACHMENT_STORES_JSON", "CLAMAV_HOST", "GITHUB_APP_ID", "GITHUB_APP_SLUG", "GITHUB_APP_PRIVATE_KEY"];
for (const name of required) {
  if (!process.env[name]) errors.push(`${name} is required`);
}

try {
  const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
  if (appUrl.protocol !== "https:") errors.push("NEXT_PUBLIC_APP_URL must use https");
  if (["localhost", "127.0.0.1"].includes(appUrl.hostname)) errors.push("NEXT_PUBLIC_APP_URL cannot use a loopback host");
} catch {
  errors.push("NEXT_PUBLIC_APP_URL must be a valid absolute URL");
}

if ((process.env.DATABASE_URL ?? "").startsWith("file:")) {
  errors.push("production DATABASE_URL must use a managed database, not SQLite");
}
if (process.env.ENABLE_DEBUG_LOGIN === "true") errors.push("ENABLE_DEBUG_LOGIN must be false in production");
if (process.env.ATTACHMENT_STORAGE_DRIVER !== "organizer-s3") errors.push("ATTACHMENT_STORAGE_DRIVER must be organizer-s3 in production");
if (process.env.ATTACHMENT_SCANNER !== "clamav") errors.push("ATTACHMENT_SCANNER must be clamav in production");
if (process.env.GITHUB_REPOSITORY_VERIFIER !== "github-app") errors.push("GITHUB_REPOSITORY_VERIFIER must be github-app in production");

if (process.env.TRACK_ASSET_ROOT) {
  const root = path.resolve(process.env.TRACK_ASSET_ROOT);
  const sourceRoot = path.resolve(process.cwd());
  if (root === sourceRoot || root.startsWith(`${sourceRoot}${path.sep}`)) errors.push("TRACK_ASSET_ROOT must be outside the source directory in production");
  try { fs.accessSync(root, fs.constants.W_OK); } catch { errors.push("TRACK_ASSET_ROOT must exist and be writable"); }
}

try {
  const keys = JSON.parse(process.env.CA_CONNECTOR_KEYS ?? "{}");
  if (!keys || typeof keys !== "object" || Object.keys(keys).length === 0) errors.push("CA_CONNECTOR_KEYS must contain at least one connector");
  for (const [connectorId, value] of Object.entries(keys)) {
    if (!value || typeof value !== "object" || typeof value.keyId !== "string" || typeof value.secret !== "string" || value.secret.length < 32) {
      errors.push(`CA_CONNECTOR_KEYS.${connectorId} must have keyId and a secret of at least 32 characters`);
    }
  }
  if (process.env.DEFAULT_CA_CONNECTOR_ID && !keys[process.env.DEFAULT_CA_CONNECTOR_ID]) {
    errors.push("DEFAULT_CA_CONNECTOR_ID must exist in CA_CONNECTOR_KEYS");
  }
} catch {
  errors.push("CA_CONNECTOR_KEYS must be valid JSON");
}

try {
  const stores = JSON.parse(process.env.ORGANIZER_ATTACHMENT_STORES_JSON ?? "{}");
  if (!stores || typeof stores !== "object" || Array.isArray(stores) || Object.keys(stores).length === 0) errors.push("ORGANIZER_ATTACHMENT_STORES_JSON must contain at least one Organizer-owned store");
  for (const [userId, store] of Object.entries(stores)) {
    if (!store || typeof store !== "object" || !store.bucket || !store.region || !store.accessKeyId || !store.secretAccessKey) {
      errors.push(`ORGANIZER_ATTACHMENT_STORES_JSON.${userId} must contain bucket, region, accessKeyId and secretAccessKey`);
    }
  }
} catch {
  errors.push("ORGANIZER_ATTACHMENT_STORES_JSON must be valid JSON");
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log("Production security configuration passed");
