import assert from "node:assert/strict";
import { buildLoginPath, resolveRequestOrigin, sanitizeInternalNext } from "../lib/login-redirect";

function requestOrigin(
  headers: Record<string, string>,
  nextUrl = { origin: "http://127.0.0.1:3100", protocol: "http:" }
) {
  const normalized = new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
  return resolveRequestOrigin({ headers: { get: (name) => normalized.get(name.toLowerCase()) ?? null }, nextUrl });
}

assert.equal(sanitizeInternalNext(null), "/console");
assert.equal(sanitizeInternalNext(undefined, "/fallback"), "/fallback");
assert.equal(sanitizeInternalNext("/console/rider?tab=works#latest"), "/console/rider?tab=works#latest");
assert.equal(sanitizeInternalNext("/races/bay-area-happy-trip"), "/races/bay-area-happy-trip");

for (const unsafe of [
  "https://evil.example/steal",
  "http://evil.example/steal",
  "//evil.example/steal",
  "/\\evil.example/steal",
  "\\\\evil.example\\steal",
  "console/rider",
  "/console\r\nLocation: https://evil.example"
]) {
  assert.equal(sanitizeInternalNext(unsafe), "/console", `unsafe next must fall back: ${JSON.stringify(unsafe)}`);
}

assert.equal(buildLoginPath("/console/rider"), "/login?next=%2Fconsole%2Frider");
assert.equal(
  buildLoginPath("https://evil.example/steal", "github_identity_failed"),
  "/login?next=%2Fconsole&error=github_identity_failed"
);

assert.equal(requestOrigin({ host: "localhost:3100" }), "http://localhost:3100");
assert.equal(
  requestOrigin({
    host: "internal-proxy:3100",
    "x-forwarded-host": "ary.example.test:8443",
    "x-forwarded-proto": "https"
  }),
  "https://ary.example.test:8443"
);
assert.equal(
  requestOrigin({
    host: "internal-proxy:3100",
    "x-forwarded-host": "first.example.test, second.example.test",
    "x-forwarded-proto": "https, http"
  }),
  "https://first.example.test",
  "forwarded headers must use only their first comma-delimited value"
);

for (const unsafeHost of [
  "evil.example\r\nlocation: https://evil.example",
  "evil.example/path",
  "evil.example\\path",
  "user@evil.example",
  "evil.example?next=/steal",
  "evil.example:0",
  "evil.example:65536"
]) {
  assert.equal(
    requestOrigin({ host: "localhost:3100", "x-forwarded-host": unsafeHost, "x-forwarded-proto": "https" }),
    "http://127.0.0.1:3100",
    `unsafe forwarded host must fall back: ${JSON.stringify(unsafeHost)}`
  );
}

assert.equal(
  requestOrigin({ host: "localhost:3100", "x-forwarded-host": "ary.example.test", "x-forwarded-proto": "javascript" }),
  "http://127.0.0.1:3100",
  "unsupported forwarded protocols must fall back"
);

console.log("PASS login redirects only accept safe same-origin relative destinations");
