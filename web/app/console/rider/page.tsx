import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppIcon } from "@/app/components/AppIcon";
import { ActionOutcomePanel, ContentCard, EmptyState, PageHeader, StatRail, StatusBadge } from "@/app/components/ui";
import { getAuthContext } from "@/lib/auth";
import { getRiderPortfolio } from "@/lib/queries";
import { resolveVisualCover } from "@/lib/visual-covers";
import styles from "../organizer/OrganizerPortfolio.module.css";

const labels: Record<string, string> = { approved: "已通过", pending: "审核中", rejected: "未通过", withdrawn: "已撤回", team_draft: "团队筹备中" };

export default async function RiderConsolePage({ searchParams }: { searchParams?: Promise<{ raceId?: string; actionMessage?: string; actionError?: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent("/console/rider")}`);
  if (!ctx.profileCompleted) redirect("/profile");
  if (ctx.activeRole !== "rider") redirect("/console");
  const { raceId, actionMessage, actionError } = (await searchParams) ?? {};
  if (raceId) {
    const next = new URLSearchParams();
    if (actionMessage) next.set("actionMessage", actionMessage);
    if (actionError) next.set("actionError", actionError);
    redirect(`/console/rider/races/${encodeURIComponent(raceId)}${next.size ? `?${next.toString()}` : ""}`);
  }
  const entries = await getRiderPortfolio(ctx.userId);
  return <section className={styles.page} data-testid="rider-portfolio">
    {actionMessage ? <ActionOutcomePanel
      actionCode="rider-workspace-action-completed"
      description={actionMessage}
      entity={{ label: "参赛资产", value: "赛事状态与下一步操作已刷新" }}
      nextAction={<Link className={styles.headerAction} href="#rider-race-list">查看我的赛事</Link>}
      outcome="success"
      testId="rider-action-outcome"
      title="操作已完成"
    /> : null}
    {actionError ? <ActionOutcomePanel
      actionCode="rider-workspace-action-failed"
      description={actionError}
      nextAction={<Link className={styles.headerAction} href="#rider-race-list">返回赛事列表</Link>}
      outcome="error"
      testId="console-action-error"
      title="未能更新参赛状态"
    /> : null}
    <PageHeader breadcrumbs={[{ label: "Rider Console", href: "/console/rider" }, { label: "我的赛事" }]} eyebrow="Rider Portfolio" title="我的参赛空间" description="查看你已经个人报名或以团队成员身份参与的全部赛事，再进入对应赛事空间完成 CA、作品和整改。" />
    <StatRail aria-label="Rider portfolio summary" items={[
      { label: "全部赛事", value: entries.length, hint: "含历史记录", icon: <AppIcon name="race" size={17} /> },
      { label: "当前参与", value: entries.filter((entry) => ["approved", "pending", "team_draft"].includes(entry.participationStatus)).length, hint: "通过 / 审核 / 筹备", tone: "success", icon: <AppIcon name="dashboard" size={17} /> },
      { label: "团队赛事", value: entries.filter((entry) => entry.participantType === "team").length, hint: "队长与队员", icon: <AppIcon name="riders" size={17} /> },
      { label: "已有作品", value: entries.filter((entry) => entry.work).length, hint: "赛事作品", tone: "warning", icon: <AppIcon name="works" size={17} /> },
    ]} />
    <section className={styles.racesSection} id="rider-race-list"><header className={styles.sectionHeader}><div><p>Race spaces</p><h2>全部参赛赛事</h2><span>每场赛事保持独立报名、团队、CA、Work 与风险上下文。</span></div></header>
      {entries.length ? <div className={styles.raceGrid} data-testid="rider-race-list">{entries.map((entry) => <ContentCard className={styles.raceCard} data-testid={`rider-race-card-${entry.race.id}`} interactive key={`${entry.race.id}-${entry.registrationId ?? entry.teamName}`}>
        <div className={styles.cover}><Image alt="" fill sizes="500px" src={resolveVisualCover("race", entry.race.slug)} /><div className={styles.coverBadges}><StatusBadge tone={entry.participantType === "team" ? "violet" : "info"}>{entry.participantType === "team" ? (entry.teamRole === "captain" ? "团队队长" : "团队队员") : "个人参赛"}</StatusBadge><StatusBadge dot tone={entry.participationStatus === "approved" ? "success" : entry.participationStatus === "rejected" ? "danger" : "warning"}>{labels[entry.participationStatus] ?? entry.participationStatus}</StatusBadge></div></div>
        <div className={styles.raceBody}><div className={styles.raceHeading}><div><h3>{entry.race.title}</h3><code>#{entry.race.id.slice(-8)}</code></div><StatusBadge tone={entry.race.status === "running" ? "success" : "neutral"}>{entry.race.status}</StatusBadge></div><p className={styles.summary}>{entry.race.summary}</p><dl className={styles.raceMeta}><div><dt>报名</dt><dd>{labels[entry.participationStatus] ?? entry.participationStatus}</dd></div><div><dt>团队</dt><dd>{entry.teamName ?? "个人"}</dd></div><div><dt>CA</dt><dd>{entry.caStatus} · {entry.connectionCount}</dd></div><div><dt>Work</dt><dd>{entry.work?.status ?? "未提交"}</dd></div></dl><Link className={styles.raceAction} href={`/console/rider/races/${encodeURIComponent(entry.race.id)}`}><span>进入赛事空间</span><AppIcon name="chevron" size={16} /></Link></div>
      </ContentCard>)}</div> : <EmptyState title="还没有参赛赛事" description="前往公共赛事中心选择赛事并报名，成功后会出现在这里。" action={<Link className={styles.emptyAction} href="/">前往赛事中心</Link>} />}
    </section>
  </section>;
}
