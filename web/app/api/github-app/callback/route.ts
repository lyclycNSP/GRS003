import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGitHubInstallationAccount } from "@/lib/github-repository-verifier";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(); const state = request.nextUrl.searchParams.get("state") ?? ""; const expected = request.cookies.get("ary_github_install_state")?.value ?? ""; const installationId = request.nextUrl.searchParams.get("installation_id") ?? "";
  if (!ctx || !state || !expected || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected)) || !/^\d+$/.test(installationId)) return NextResponse.json({ error: "GitHub App 安装回调无效" }, { status: 400 });
  const account = await getGitHubInstallationAccount(installationId);
  if (!account) return NextResponse.json({ error: "无法确认 GitHub App 安装信息" }, { status: 502 });
  const existing = await prisma.gitHubInstallation.findUnique({ where: { installationId } });
  if (existing && existing.userId !== ctx.userId) return NextResponse.json({ error: "该 GitHub App Installation 已绑定其他 ARY 账号" }, { status: 409 });
  await prisma.gitHubInstallation.upsert({ where: { installationId }, update: { accountLogin: account.login, accountType: account.type }, create: { id: `github_install_${randomUUID()}`, userId: ctx.userId, installationId, accountLogin: account.login, accountType: account.type } });
  const response = NextResponse.redirect(new URL("/console/rider?actionMessage=GitHub%20App%20%E5%B7%B2%E6%8E%88%E6%9D%83", request.url)); response.cookies.set("ary_github_install_state", "", { path: "/api/github-app", expires: new Date(0) }); return response;
}
