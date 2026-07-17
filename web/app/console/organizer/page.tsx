import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppIcon } from "@/app/components/AppIcon";
import { ContentCard, EmptyState, PageHeader, StatRail, StatusBadge } from "@/app/components/ui";
import { getAuthContext } from "@/lib/auth";
import { getOrganizerPortfolio } from "@/lib/queries";
import { resolveVisualCover } from "@/lib/visual-covers";
import styles from "./OrganizerPortfolio.module.css";
import { CreateRaceSecureForm } from "./CreateRaceSecureForm";

type OrganizerSearchParams = {
  raceId?: string;
  actionMessage?: string;
  actionError?: string;
};

type RaceStatus = "draft" | "running" | "completed" | "archived" | string;

const raceStatusLabels: Record<string, string> = {
  draft: "草稿",
  running: "进行中",
  completed: "已完成",
  archived: "已归档"
};

function withMessage(path: string, params: OrganizerSearchParams) {
  const next = new URLSearchParams();
  if (params.actionMessage) next.set("actionMessage", params.actionMessage);
  if (params.actionError) next.set("actionError", params.actionError);
  return next.size ? `${path}?${next.toString()}` : path;
}

function formatCreatedAt(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(value);
}

function statusTone(status: RaceStatus): "neutral" | "success" | "warning" | "violet" {
  if (status === "running") return "success";
  if (status === "draft") return "warning";
  if (status === "completed") return "violet";
  return "neutral";
}

function publicationHint(status: RaceStatus, visibility: string) {
  if (status === "draft" && visibility !== "public") {
    return "当前为私有草稿，不会出现在公开赛事中心。进入 Race Workspace 完成配置并发布。";
  }
  if (status === "draft") return "当前仍是草稿，不会出现在公开赛事中心。发布后公众才可浏览。";
  if (visibility !== "public") return "当前 Race 为私有赛事，不会出现在公开赛事中心。";
  return null;
}

export default async function OrganizerConsolePage({ searchParams }: { searchParams?: Promise<OrganizerSearchParams> }) {
  const params = (await searchParams) ?? {};
  const ctx = await getAuthContext();
  if (!ctx) {
    const query = new URLSearchParams();
    if (params.raceId) query.set("raceId", params.raceId);
    const next = `/console/organizer${query.size ? `?${query.toString()}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!ctx.profileCompleted) redirect("/profile");
  if (ctx.activeRole !== "organizer") redirect("/console");

  if (params.raceId) {
    if (ctx.managedRaceIds.includes(params.raceId)) {
      redirect(withMessage(`/console/organizer/races/${encodeURIComponent(params.raceId)}`, params));
    }
    redirect("/console/organizer?actionError=赛事不存在或当前账号无权访问");
  }

  const races = await getOrganizerPortfolio(ctx.userId);
  const stats = [
    { label: "可管理赛事", value: races.length, hint: "本人创建与受邀协作", tone: "primary" as const, icon: "race" as const },
    { label: "草稿", value: races.filter((race) => race.status === "draft").length, hint: "等待配置或发布", tone: "warning" as const, icon: "works" as const },
    { label: "进行中", value: races.filter((race) => race.status === "running").length, hint: "当前公开运行", tone: "success" as const, icon: "dashboard" as const },
    { label: "完成 / 归档", value: races.filter((race) => ["completed", "archived"].includes(race.status)).length, hint: "沉淀为赛事资产", tone: "violet" as const, icon: "shield" as const }
  ];

  return (
    <section className={styles.page} data-testid="organizer-portfolio">
      <PageHeader
        actions={<a className={styles.headerAction} href="#create-race"><AppIcon name="race" size={17} />创建 Race</a>}
        breadcrumbs={[{ label: "Organizer Console", href: "/console/organizer" }, { label: "我的赛事" }]}
        description="管理由你创建或受邀协作的赛事资产。进入具体 Race 后，再处理报名、作品、评审、风险与现场运营。"
        eyebrow="Organizer Portfolio"
        title="我的赛事"
      />

      {params.actionMessage ? (
        <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status">
          <AppIcon name="shield" size={18} /><span>{params.actionMessage}</span>
        </div>
      ) : null}
      {params.actionError ? (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert" data-testid="console-action-error">
          <AppIcon name="alert" size={18} /><span>{params.actionError}</span>
        </div>
      ) : null}

      <StatRail aria-label="Organizer portfolio summary" items={stats.map((stat) => ({
        ...stat,
        icon: <AppIcon name={stat.icon} size={17} />,
      }))} />

      <div className={styles.layout}>
        <section className={styles.racesSection} aria-labelledby="managed-races-title">
          <header className={styles.sectionHeader}>
            <div>
              <p>Race assets</p>
              <h2 id="managed-races-title">可管理赛事</h2>
              <span>仅包含你拥有 managed Race 权限的赛事，单场运营数据不会在这里混合统计。</span>
            </div>
            <div className={styles.legend} aria-label="赛事管理关系图例">
              <StatusBadge tone="info">Owner</StatusBadge>
              <StatusBadge tone="violet">Collaborator</StatusBadge>
            </div>
          </header>

          {races.length ? (
            <div className={styles.raceGrid} data-testid="organizer-race-list">
              {races.map((race) => {
                const hint = publicationHint(race.status, race.visibility);
                return (
                  <ContentCard
                    className={styles.raceCard}
                    data-testid={`organizer-race-card-${race.id}`}
                    interactive
                    key={race.id}
                  >
                    <div className={styles.cover}>
                      <Image
                        alt=""
                        fill
                        sizes="(max-width: 1400px) 33vw, 390px"
                        src={resolveVisualCover("race", race.slug || race.id)}
                      />
                      <div className={styles.coverBadges}>
                        <StatusBadge tone={race.relationship === "owner" ? "info" : "violet"}>
                          {race.relationship === "owner" ? "Owner" : "Collaborator"}
                        </StatusBadge>
                        <StatusBadge dot tone={statusTone(race.status)}>{raceStatusLabels[race.status] ?? race.status}</StatusBadge>
                      </div>
                    </div>

                    <div className={styles.raceBody}>
                      <div className={styles.raceHeading}>
                        <div>
                          <h3>{race.title}</h3>
                          <code title={race.id}>#{race.id.slice(-8)}</code>
                        </div>
                        <StatusBadge tone={race.visibility === "public" ? "success" : "neutral"}>
                          {race.visibility === "public" ? "公开" : "私有"}
                        </StatusBadge>
                      </div>
                      <p className={styles.summary}>{race.summary || "尚未填写赛事摘要。进入 Race Workspace 补充赛事信息。"}</p>

                      <dl className={styles.raceMeta}>
                        <div><dt>身份</dt><dd>{race.relationship === "owner" ? "赛事所有者" : "协作 Organizer"}</dd></div>
                        <div><dt>创建时间</dt><dd>{formatCreatedAt(race.createdAt)}</dd></div>
                        <div><dt>状态</dt><dd>{raceStatusLabels[race.status] ?? race.status}</dd></div>
                        <div><dt>可见性</dt><dd>{race.visibility === "public" ? "Public" : "Private"}</dd></div>
                      </dl>

                      {hint ? <p className={styles.publicationHint}><AppIcon name="alert" size={15} />{hint}</p> : null}

                      <Link className={styles.raceAction} href={`/console/organizer/races/${encodeURIComponent(race.id)}`}>
                        <span>进入赛事</span><AppIcon name="chevron" size={16} />
                      </Link>
                    </div>
                  </ContentCard>
                );
              })}
            </div>
          ) : (
            <EmptyState
              action={<a className={styles.emptyAction} href="#create-race">创建第一场 Race</a>}
              description="从创建面板建立赛事资产。创建后会直接进入独立 Race Workspace。"
              icon={<AppIcon name="race" size={24} />}
              title="还没有可管理的 Race"
            />
          )}
        </section>

        <aside className={styles.createColumn} id="create-race">
          <ContentCard
            className={styles.createCard}
            description="创建后直接进入独立 Race Workspace，完成发布与运营配置。"
            title="创建一场 Race"
            variant="accent"
          >
            <CreateRaceSecureForm />
          </ContentCard>
        </aside>
      </div>
    </section>
  );
}
