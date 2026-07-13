const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function getAppUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  const url = new URL(raw);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use https in production");
  }
  if (process.env.NODE_ENV === "production" && LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error("NEXT_PUBLIC_APP_URL cannot use a loopback host in production");
  }
  return url.origin;
}

export function hasGithubOAuthConfig() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}
