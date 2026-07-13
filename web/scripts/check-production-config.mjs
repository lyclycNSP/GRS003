import process from "node:process";

const errors = [];
const required = ["DATABASE_URL", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "NEXT_PUBLIC_APP_URL", "CA_CONNECTOR_KEYS", "DEFAULT_CA_CONNECTOR_ID"];
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

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log("Production security configuration passed");
