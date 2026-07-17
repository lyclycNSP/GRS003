import { createSign } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type RepositoryVerification = { repositoryNodeId: string; repositoryVisibility: string; repositoryVerifiedAt: Date; repositoryVerificationStatus: "verified"; repositoryVerificationDetail: string };

function base64url(value: string | Buffer) { return Buffer.from(value).toString("base64url"); }
function appJwt() {
  const appId = process.env.GITHUB_APP_ID; const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !privateKey) throw new Error("GITHUB_APP_NOT_CONFIGURED");
  const now = Math.floor(Date.now() / 1000); const head = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })); const body = base64url(JSON.stringify({ iat: now - 30, exp: now + 540, iss: appId }));
  const input = `${head}.${body}`; const signer = createSign("RSA-SHA256"); signer.update(input); signer.end(); return `${input}.${signer.sign(privateKey).toString("base64url")}`;
}

function repoParts(repoUrl: string) { const url = new URL(repoUrl); const [owner, repo] = url.pathname.split("/").filter(Boolean); return { owner, repo }; }

export async function getGitHubInstallationAccount(installationId: string): Promise<{ login: string; type: string } | null> {
  try {
    const response = await fetch(`https://api.github.com/app/installations/${installationId}`, { headers: { Authorization: `Bearer ${appJwt()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const body = await response.json() as { account?: { login?: string; type?: string } };
    return body.account?.login ? { login: body.account.login, type: body.account.type ?? "unknown" } : null;
  } catch { return null; }
}

export async function verifyGitHubRepository(userId: string, repoUrl: string, sha: string): Promise<{ ok: true; data: RepositoryVerification } | { ok: false; message: string }> {
  const mode = process.env.GITHUB_REPOSITORY_VERIFIER ?? (process.env.NODE_ENV === "production" ? "github-app" : "mock");
  const { owner, repo } = repoParts(repoUrl);
  if (mode === "mock") {
    if (process.env.NODE_ENV === "production") return { ok: false, message: "生产环境禁止使用 Mock 仓库验证器" };
    return { ok: true, data: { repositoryNodeId: `mock:${owner}/${repo}`, repositoryVisibility: "public", repositoryVerifiedAt: new Date(), repositoryVerificationStatus: "verified", repositoryVerificationDetail: "development-mock" } };
  }
  const installations = await prisma.gitHubInstallation.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  if (!installations.length) return { ok: false, message: "请先安装 ARY GitHub App 并授权目标仓库" };
  for (const installation of installations) {
    try {
      const tokenResponse = await fetch(`https://api.github.com/app/installations/${installation.installationId}/access_tokens`, { method: "POST", headers: { Authorization: `Bearer ${appJwt()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" }, body: JSON.stringify({ repositories: [repo], permissions: { contents: "read" } }), cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!tokenResponse.ok) continue;
      const tokenBody = await tokenResponse.json() as { token: string };
      const headers = { Authorization: `Bearer ${tokenBody.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
      const [repoResponse, commitResponse] = await Promise.all([fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) }), fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${sha}`, { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) })]);
      if (!repoResponse.ok || !commitResponse.ok) continue;
      const repository = await repoResponse.json() as { node_id: string; visibility?: string; private: boolean; full_name: string };
      const commit = await commitResponse.json() as { sha: string };
      if (repository.full_name.toLowerCase() !== `${owner}/${repo}`.toLowerCase() || commit.sha.toLowerCase() !== sha.toLowerCase()) continue;
      return { ok: true, data: { repositoryNodeId: repository.node_id, repositoryVisibility: repository.visibility ?? (repository.private ? "private" : "public"), repositoryVerifiedAt: new Date(), repositoryVerificationStatus: "verified", repositoryVerificationDetail: `installation:${installation.installationId}` } };
    } catch { /* Try another installation; never log tokens or upstream bodies. */ }
  }
  return { ok: false, message: "GitHub App 无法确认该 Commit 属于已授权仓库，请检查安装范围后重试" };
}
