import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppIcon } from "@/app/components/AppIcon";
import { ActionCallout, KeyValueList, LifecycleStepper, StatRail, StatusBadge, type LifecycleStep } from "@/app/components/ui";
import { getAuthContext } from "@/lib/auth";
import { buildLoginPath } from "@/lib/login-redirect";
import { getRaceBySlug, getRaceParticipationForUser } from "@/lib/queries";
import { resolveVisualCover } from "@/lib/visual-covers";
import { prisma } from "@/lib/prisma";
import styles from "../PublicRace.module.css";
import { RacePublicNavigation } from "./RacePublicNavigation";
import { RaceRegistrationDialog } from "./RaceRegistrationDialog";

type RacePageSearchParams = {
  registrationMessage?: string;
  registrationError?: string;
};

function registrationIsOpen(status: string, scheduleValue?: string) {
  return status === "running" && ["open", "开放", "开放中"].includes(scheduleValue ?? "");
}

function raceStatusLabel(status: string) {
  if (status === "running") return "进行中";
  if (status === "completed") return "已结束";
  if (status === "published") return "已发布";
  return status;
}

function readableStage(value?: string) {
  const normalized = value?.toLowerCase() ?? "";
  if (["open", "开放", "开放中"].includes(normalized)) return "开放中";
  if (["running", "进行中"].includes(normalized)) return "进行中";
  if (["completed", "finished", "已完成", "已结束"].includes(normalized)) return "已完成";
  if (["locked", "closed", "已锁定", "已关闭"].includes(normalized)) return "已锁定";
  if (["published", "已发布"].includes(normalized)) return "已发布";
  if (["queue", "pending", "待评审", "待开席"].includes(normalized)) return "待开始";
  return value || "未配置";
}

function lifecycleSteps(status: string, values: string[], details: string[]): LifecycleStep[] {
  const completed = ["completed", "archived"].includes(status);
  const normalized = values.map((value) => value.toLowerCase());
  let current = status === "running" ? 1 : 0;
  if (normalized[2]?.match(/open|locked|closed|提交|锁定/)) current = 2;
  if (normalized[3]?.match(/review|judg|评审|queue/)) current = 3;
  if (normalized[4]?.match(/publish|发布|completed/)) current = 4;
  return ["报名", "比赛", "提交", "评审", "结果"].map((label, index) => ({
    label: `${label}${readableStage(values[index]) === "未配置" ? "" : ` · ${readableStage(values[index])}`}`,
    detail: details[index],
    state: completed || index < current ? "complete" : index === current ? "current" : "upcoming"
  }));
}

export default async function RacePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<RacePageSearchParams>;
}) {
  const { slug } = await params;
  const query = (await searchParams) ?? {};
  const [race, ctx] = await Promise.all([getRaceBySlug(slug), getAuthContext()]);
  if (!race) notFound();
  const problemVersions = await prisma.raceProblemVersion.findMany({ where: { raceId: race.id, scanStatus: "clean", publishedAt: { not: null }, disabledAt: null }, orderBy: { revision: "desc" } });

  const participation = ctx ? await getRaceParticipationForUser(race.id, ctx.userId) : null;
  const submittedWorks = race.registrations.filter((registration) => registration.work);
  const publicReports = race.reports.filter((report) => report.visibility === "public");
  const activeRiders = Number(race.metrics.activeRiders ?? 0);
  const isRegistrationOpen = registrationIsOpen(race.status, race.schedule.registration);
  const stages = lifecycleSteps(race.status, [race.schedule.registration ?? "", race.schedule.race ?? race.status, race.schedule.submission ?? "", race.schedule.judging ?? "", race.schedule.results ?? ""], [
    `${race.registrationCount} 位 Rider`,
    race.status === "running" ? `${activeRiders} 位在线` : "赛事进程",
    `${submittedWorks.length} 件公开作品`,
    `${submittedWorks.length} 份材料`,
    `${race.awards.length} 个奖项`
  ]);
  const heroStats = race.status === "completed"
    ? [
        { label: "参赛者", value: race.registrationCount, hint: "Riders", icon: <AppIcon name="riders" size={28} /> },
        { label: "公开作品", value: submittedWorks.length, hint: "Works", icon: <AppIcon name="works" size={28} /> },
        { label: "奖项", value: race.awards.length, hint: "Awards", tone: "success" as const, icon: <AppIcon name="shield" size={28} /> },
        { label: "公开报告", value: publicReports.length, hint: "Reports", icon: <AppIcon name="briefcase" size={28} /> }
      ]
    : [
        { label: "参赛者", value: race.registrationCount, hint: "已报名 Rider", icon: <AppIcon name="riders" size={28} /> },
        { label: "当前在线", value: activeRiders ? activeRiders : "暂无在线", hint: race.status === "running" ? "Live" : "尚未开赛", tone: activeRiders ? "success" as const : "neutral" as const, icon: <AppIcon name="race" size={28} /> },
        { label: "公开作品", value: submittedWorks.length || "尚未发布", hint: "Works", icon: <AppIcon name="works" size={28} /> },
        { label: "赛事状态", value: raceStatusLabel(race.status), hint: readableStage(race.schedule.race), tone: race.status === "running" ? "success" as const : "neutral" as const, icon: <AppIcon name="dashboard" size={28} /> }
      ];

  return (
    <main className={styles.page}>
      <RacePublicNavigation active="overview" slug={race.slug} title={race.title} />

      <section className={styles.hero} aria-labelledby="race-title">
        <div className={styles.heroContent}>
          <div className={styles.eyebrowRow}>
            <p className={styles.eyebrow}>Race Overview</p>
            <StatusBadge dot tone={race.status === "running" ? "success" : "neutral"}>{raceStatusLabel(race.status)}</StatusBadge>
          </div>
          <h1 id="race-title">{race.title}</h1>
          <p className={styles.lead}>{race.challenge}</p>
          <StatRail className={styles.heroStatRail} items={heroStats} />
          {query.registrationMessage ? <p className={styles.feedback} role="status" data-testid="registration-message">{query.registrationMessage}</p> : null}
          {query.registrationError ? <p className={`${styles.feedback} ${styles.feedbackError}`} role="alert" data-testid="registration-error">{query.registrationError}</p> : null}
          <div className={styles.buttonRow}>
            <Link className={styles.primaryButton} href={race.status === "completed" ? `/races/${race.slug}/results` : `/races/${race.slug}/live`}>{race.status === "completed" ? "查看最终结果" : "进入 Live Hall"}</Link>
            {participation ? (
              <div className={styles.registrationState} data-testid="registration-state">
                <strong>{participation.participationState === "team_draft" ? "团队筹备中" : `已报名 · ${participation.status}`}</strong>
                <span>{participation.participantType === "team" ? participation.team?.name ?? "团队参赛" : "个人参赛"}</span>
                <Link href={`/console/rider?raceId=${race.id}`}>进入赛事空间</Link>
              </div>
            ) : !isRegistrationOpen ? (
              <span className={styles.closedState} data-testid="registration-closed">当前未开放报名</span>
            ) : !ctx ? (
              <Link className={styles.primaryButton} href={buildLoginPath(`/races/${race.slug}`)}>登录后报名</Link>
            ) : ctx.activeRole !== "rider" ? (
              <Link className={styles.primaryButton} href="/role-switch">切换到 Rider 后报名</Link>
            ) : (
              <RaceRegistrationDialog raceId={race.id} raceSlug={race.slug} />
            )}
          </div>
        </div>
        <div className={styles.heroMedia} aria-hidden="true">
          <Image alt="" height={640} priority src={resolveVisualCover("race", race.slug)} width={900} />
        </div>
      </section>

      <LifecycleStepper aria-label="赛事流程状态" steps={stages} />

      <section className={styles.section} aria-labelledby="race-about-title">
        <header className={styles.sectionHeading}>
          <div><span className={styles.sectionLabel}>Race Information</span><h2 id="race-about-title">本场赛事</h2></div>
          <p>公开页面展示核心事实与公开资产；实时过程来自 Projection，最终事实以 Results 和 Report 为准。</p>
        </header>
        <div className={styles.overviewLayout}>
          <article className={styles.aboutRace}>
            <span className={styles.miniLabel}>About this race</span>
            <h2>关于本赛事</h2>
            <p>{race.summary}</p>
            <h3>挑战目标</h3>
            <p>{race.challenge}</p>
            {problemVersions.length ? <div data-testid="public-race-problem-versions"><h3>赛题 PDF</h3>{problemVersions.map((version) => <p key={version.id}><a href={`/api/race-problems/${encodeURIComponent(version.id)}/download`}>下载修订 {version.revision} · {version.displayName}</a>{version.changeNote ? ` — ${version.changeNote}` : ""}</p>)}</div> : null}
          </article>
          <aside className={styles.raceFacts}>
            <h2>赛事信息</h2>
            <KeyValueList items={[
              { label: "状态", value: raceStatusLabel(race.status), tone: race.status === "running" ? "success" : "neutral" },
              { label: "报名", value: readableStage(race.schedule.registration) },
              { label: "比赛阶段", value: readableStage(race.schedule.race ?? race.status) },
              { label: "提交", value: readableStage(race.schedule.submission) },
              { label: "公开资产", value: submittedWorks.length ? `${submittedWorks.length} 件 Works` : "尚未发布" },
              { label: "赛果", value: race.awards.length ? `${race.awards.length} 个奖项` : "等待发布" }
            ]} />
          </aside>
        </div>
        <ActionCallout
          description={race.status === "completed" ? "获奖名单与公开赛后报告已经进入最终结果页面。" : "实时进度来自公开 Projection，最终结果仍以 Results 与 Report 为准。"}
          icon={<AppIcon name={race.status === "completed" ? "shield" : "screen"} size={38} />}
          primaryAction={<Link className={styles.primaryButton} href={race.status === "completed" ? `/races/${race.slug}/results` : `/races/${race.slug}/live`}>{race.status === "completed" ? "查看最终结果" : "观看 Live Hall"}</Link>}
          secondaryAction={<Link className={styles.textAction} href={`/races/${race.slug}/works`}>浏览公开作品 →</Link>}
          title={race.status === "completed" ? "最终结果已发布" : race.status === "running" ? "赛事正在进行" : "赛事公开信息"}
          tone={race.status === "completed" ? "success" : "primary"}
        />
      </section>
    </main>
  );
}
