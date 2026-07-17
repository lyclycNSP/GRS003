import assert from "node:assert/strict";
import { fetchGithubIdentity, selectVerifiedGithubEmail } from "../lib/github-oauth";
import { appendPendingOAuthState, consumePendingOAuthState, encodePendingOAuthStates, parsePendingOAuthStates } from "../lib/oauth-state";

assert.equal(selectVerifiedGithubEmail([
  { email: "secondary@example.com", primary: false, verified: true },
  { email: "PRIMARY@EXAMPLE.COM", primary: true, verified: true }
]), "primary@example.com");
assert.equal(selectVerifiedGithubEmail([{ email: "unverified@example.com", primary: true, verified: false }]), null);
const pending=appendPendingOAuthState(appendPendingOAuthState([],"state-a","/console/rider",1000),"state-b","/console/organizer",1001);
assert.deepEqual(parsePendingOAuthStates(encodePendingOAuthStates(pending),1002).map(item=>item.state),["state-a","state-b"]);
const consumed=consumePendingOAuthState(pending,"state-a");
assert.equal(consumed.matched?.next,"/console/rider");assert.deepEqual(consumed.remaining.map(item=>item.state),["state-b"]);

const requested: string[] = [];
const fetchMock = (async (input: URL | RequestInfo) => {
  const url = String(input);
  requested.push(url);
  if (url.includes("access_token")) return Response.json({ access_token: "ephemeral-token" });
  if (url.endsWith("/user")) return Response.json({ id: 42, login: "octo-rider", name: "Octo Rider", avatar_url: "https://example.test/avatar.png" });
  if (url.endsWith("/user/emails")) return Response.json([{ email: "octo@example.test", primary: true, verified: true }]);
  return new Response(null, { status: 404 });
}) as typeof fetch;

async function main() {
  const identity = await fetchGithubIdentity("oauth-code", {
    clientId: "client-id", clientSecret: "client-secret", redirectUri: "http://127.0.0.1:3000/api/auth/github/callback"
  }, fetchMock);
  assert.equal(identity?.email, "octo@example.test");
  assert.deepEqual(requested, ["https://github.com/login/oauth/access_token", "https://api.github.com/user", "https://api.github.com/user/emails"]);

  const config = {
    clientId: "client-id",
    clientSecret: "super-secret-never-log",
    redirectUri: "http://127.0.0.1:3000/api/auth/github/callback"
  };
  const failureCases: Array<[string, typeof fetch]> = [
    ["token endpoint error", (async () => new Response("gateway failed", { status: 502 })) as typeof fetch],
    ["token endpoint non-JSON", (async () => new Response("not-json", {
      status: 200,
      headers: { "content-type": "text/plain" }
    })) as typeof fetch],
    ["token response without access token", (async () => Response.json({ scope: "read:user" })) as typeof fetch],
    ["network error", (async () => { throw new Error("socket closed"); }) as typeof fetch]
  ];
  for (const [label, failingFetch] of failureCases) {
    let result: Awaited<ReturnType<typeof fetchGithubIdentity>> | undefined;
    let thrown: unknown;
    try {
      result = await fetchGithubIdentity("oauth-code", config, failingFetch);
    } catch (error) {
      thrown = error;
    }
    assert.equal(thrown, undefined, `${label} should be converted to a controlled login failure`);
    assert.equal(result, null, `${label} should not produce a GitHub identity`);
    assert.equal(String(thrown ?? result).includes(config.clientSecret), false, `${label} must not leak the OAuth secret`);
  }

  console.log("PASS GitHub OAuth imports verified email and safely handles upstream failures");
}

main().catch((error) => { console.error(error); process.exit(1); });
