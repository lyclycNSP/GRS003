import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DemoSafetyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const ctx = await getAuthContext();
  const work = await prisma.work.findUnique({ where: { slug }, include: { assignments: true } });
  const publicWork = work?.status === "published" && work.visibility === "public";
  const assignedJudge = !!ctx && ctx.activeRole === "judge" && work?.assignments.some((assignment) => assignment.judgeUserId === ctx.userId);
  if (!work?.demoUrl || (!publicWork && !assignedJudge)) notFound();
  const target = new URL(work.demoUrl);
  return <main style={{ maxWidth: 720, margin: "80px auto", padding: 32 }} data-testid="demo-safety-page">
    <p>External Demo</p><h1>即将离开 ARY</h1>
    <p>目标网站由参赛者维护，ARY 未抓取、运行或安全扫描其内容。请勿在不信任的网站输入账号、密码或敏感信息。</p>
    <dl><dt>目标域名</dt><dd><code>{target.hostname}</code></dd><dt>协议</dt><dd>HTTPS</dd></dl>
    <p><a href={work.demoUrl} rel="noopener noreferrer nofollow" target="_blank">确认并打开外部 Demo</a></p>
    <p><Link href={`/works/${work.slug}`}>返回作品页面</Link></p>
  </main>;
}
