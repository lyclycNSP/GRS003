import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DirectoryPagination } from "@/app/components/DirectoryPagination";
import { PageHeader, StatRail, StatusBadge } from "@/app/components/ui";
import { getAuthContext } from "@/lib/auth";
import { getOrganizerParticipantLibrary } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import styles from "./Participants.module.css";

type SearchParams = { q?: string; status?: string; page?: string };

export default async function OrganizerParticipantsPage({ params, searchParams }: { params: Promise<{ raceId: string }>; searchParams?: Promise<SearchParams> }) {
  const { raceId } = await params;
  const query = (await searchParams) ?? {};
  const ctx = await getAuthContext();
  const destination = `/console/organizer/races/${encodeURIComponent(raceId)}/participants`;
  if (!ctx) redirect(`/login?next=${encodeURIComponent(destination)}`);
  if (!ctx.profileCompleted) redirect("/profile");
  if (ctx.activeRole !== "organizer") redirect("/console");
  if (!ctx.managedRaceIds.includes(raceId)) notFound();

  const status = query.status === "history" ? "history" : "approved";
  const [race, library] = await Promise.all([
    prisma.race.findUnique({ where: { id: raceId }, select: { id: true, title: true, slug: true, status: true } }),
    getOrganizerParticipantLibrary(raceId, ctx.userId, { q: query.q, status, page: query.page }),
  ]);
  if (!race || !library) notFound();

  const projectCount = library.items.filter((item) => item.raceProject).length;
  const workCount = library.items.filter((item) => item.work).length;
  const riskCount = library.items.reduce((total, item) => total + item.reviewFlags.length, 0);

  return <main className={styles.page} data-testid="organizer-participant-library">
    <PageHeader
      eyebrow="ORGANIZER · PARTICIPANT LIBRARY"
      title={`${race.title} 参赛选手库`}
      description="已审核报名与历史记录在这里集中管理；工作台只保留仍需处理的 pending 队列。"
      breadcrumbs={[{ label: "我的赛事", href: "/console/organizer" }, { label: race.title, href: `/console/organizer/races/${race.id}` }, { label: "参赛选手库" }]}
      actions={<Link className={styles.backLink} href={`/console/organizer/races/${race.id}#registration-review`}>返回报名审核</Link>}
    />

    <StatRail aria-label="参赛选手库摘要" items={[
      { label: status === "approved" ? "已通过记录" : "历史记录", value: library.total, hint: `第 ${library.page} 页` },
      { label: "RaceProject", value: projectCount, hint: "本页已建立" },
      { label: "Works", value: workCount, hint: "本页已提交" },
      { label: "Risk", value: riskCount, hint: "本页风险项" },
    ]} />

    <section className={styles.directoryPanel} id="participants">
      <div className={styles.panelHeading}>
        <div><span>AUTHORIZED ROSTER</span><h2>{status === "approved" ? "已通过参赛者" : "审核与退出历史"}</h2></div>
        <nav aria-label="选手库状态"><Link aria-current={status === "approved" ? "page" : undefined} href={destination}>已通过</Link><Link aria-current={status === "history" ? "page" : undefined} href={`${destination}?status=history`}>历史记录</Link></nav>
      </div>
      <form className={styles.searchForm} method="get" action={destination}>
        {status === "history" ? <input type="hidden" name="status" value="history" /> : null}
        <label><span>搜索选手、团队或 GitHub</span><input name="q" defaultValue={query.q ?? ""} placeholder="输入姓名、团队名或 GitHub Login" /></label>
        <button type="submit">搜索</button>
        {query.q ? <Link href={status === "history" ? `${destination}?status=history` : destination}>清除</Link> : null}
      </form>

      <div className={styles.participantList}>
        {library.items.length ? library.items.map((registration) => {
          const entrant = registration.team?.name ?? registration.user.displayName;
          const connections = registration.raceProject?.caConnections ?? [];
          return <article className={styles.participantCard} data-testid="participant-library-row" key={registration.id}>
            <div className={styles.identityBlock}><span>{registration.participantType === "team" ? "TEAM ENTRY" : "INDIVIDUAL ENTRY"}</span><h3>{entrant}</h3><p>{registration.team ? `${registration.team.members.length} 名成员 · 队长 ${registration.user.displayName}` : registration.user.githubLogin ? `@${registration.user.githubLogin}` : "GitHub 未公开"}</p></div>
            <dl className={styles.factList}>
              <div><dt>状态</dt><dd><StatusBadge tone={registration.status === "approved" ? "success" : "neutral"}>{registration.status}</StatusBadge></dd></div>
              <div><dt>审核</dt><dd>{registration.reviewedAt ? registration.reviewedAt.toLocaleString("zh-CN") : "尚未记录"}</dd></div>
              <div><dt>审核人</dt><dd>{registration.reviewedBy?.displayName ?? "—"}</dd></div>
              <div><dt>RaceProject</dt><dd>{registration.raceProject?.aggregateIngestionStatus ?? "未建立"}</dd></div>
              <div><dt>CA</dt><dd>{connections.filter((connection) => connection.handshakeAt && !connection.disabledAt).length}/{connections.length} verified</dd></div>
              <div><dt>Work</dt><dd>{registration.work ? `${registration.work.title} · ${registration.work.status}` : "尚未提交"}</dd></div>
            </dl>
            {registration.team ? <div className={styles.memberStrip}>{registration.team.members.map((member) => <span key={member.id}>{member.user.displayName}<small>{member.role}</small></span>)}</div> : null}
            <div className={styles.cardFooter}><span>{registration.reviewNote ? `审核说明：${registration.reviewNote}` : registration.status === "approved" ? "审核通过，已进入正式参赛名册" : "无审核说明"}</span><StatusBadge tone={registration.reviewFlags.length ? "warning" : "success"}>{registration.reviewFlags.length ? `${registration.reviewFlags.length} risks` : "No open risk"}</StatusBadge></div>
          </article>;
        }) : <div className={styles.emptyState}><strong>{query.q ? "没有匹配的参赛记录" : status === "approved" ? "尚无已通过参赛者" : "暂无历史记录"}</strong><p>{query.q ? "请调整搜索条件后重试。" : "处理报名后，记录会自动进入对应分区。"}</p></div>}
      </div>

      <DirectoryPagination pathname={destination} page={library.page} totalPages={library.totalPages} query={{ q: query.q, status: status === "history" ? "history" : undefined }} anchor="participants" ariaLabel="参赛选手库分页" />
    </section>
  </main>;
}
