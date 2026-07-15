import Link from "next/link";
import { redirect } from "next/navigation";
import { updateReviewFlagStatusAction } from "@/app/actions";
import { getAuthContext } from "@/lib/auth";
import { getRiskCenterSnapshotForUser } from "@/lib/queries";

function toneFor(value?: string | null) {
  if (!value) return "muted";
  if (["resolved", "published", "active", "approved", "done"].includes(value)) return "good";
  if (["high", "failed", "risk"].some((item) => value.includes(item))) return "risk";
  if (["warning", "open", "in_review", "connected", "not_configured"].includes(value)) return "warn";
  return "muted";
}

function actionHint(type: string) {
  switch (type) {
    case "no_ca_data":
      return "先登记并握手至少一个 CAConnection，再接入一次合法 CA Signal。";
    case "empty_riding":
      return "补一条有效骑行会话，让评审能看到过程证据。";
    case "missing_required_material":
      return "补齐 Demo URL、Repo URL 和作品摘要。";
    case "ingestion_exception":
      return "检查 connector、握手状态和签名来源，确认信号是否被隔离。";
    case "cost_watch":
      return "补充成本解释和纠偏说明，让评审理解为什么仍可继续。";
    default:
      return "补充材料或说明后，再由 Organizer 复核。";
  }
}

function matchesFilter<T extends { status: string; severity: string; type: string; riderName: string }>(
  item: T,
  filters: { status: string; severity: string; type: string; rider: string }
) {
  return (filters.status === "all" || item.status === filters.status)
    && (filters.severity === "all" || item.severity === filters.severity)
    && (filters.type === "all" || item.type === filters.type)
    && (filters.rider === "all" || item.riderName === filters.rider);
}

function severityRank(value: string) {
  if (value === "high" || value === "danger") return 0;
  if (value === "warning" || value === "medium") return 1;
  if (value === "info" || value === "low") return 2;
  return 3;
}

function statusRank(value: string) {
  if (value === "open") return 0;
  if (value === "in_review") return 1;
  if (value === "resolved") return 2;
  return 3;
}

function sortFlags<T extends { status: string; severity: string; updatedAt: Date; createdAt: Date }>(items: T[]) {
  return [...items].sort((left, right) => {
    const statusDelta = statusRank(left.status) - statusRank(right.status);
    if (statusDelta !== 0) return statusDelta;
    const severityDelta = severityRank(left.severity) - severityRank(right.severity);
    if (severityDelta !== 0) return severityDelta;
    return right.updatedAt.getTime() - left.updatedAt.getTime() || right.createdAt.getTime() - left.createdAt.getTime();
  });
}

function formatTime(value?: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function sourceLabel(sourceRefJson: string) {
  try {
    const source = JSON.parse(sourceRefJson) as Record<string, unknown>;
    const scope = typeof source.scope === "string" ? source.scope : null;
    const id = typeof source.id === "string" ? source.id : typeof source.workId === "string" ? source.workId : null;
    return [scope, id].filter(Boolean).join(" / ") || "system";
  } catch {
    return "system";
  }
}

function filterHref(params: { raceId: string; status?: string; severity?: string; type?: string; rider?: string }) {
  const search = new URLSearchParams();
  search.set("raceId", params.raceId);
  if (params.status) search.set("status", params.status);
  if (params.severity) search.set("severity", params.severity);
  if (params.type) search.set("type", params.type);
  if (params.rider) search.set("rider", params.rider);
  return `/console/risk-center?${search.toString()}`;
}

export default async function RiskCenterPage({
  searchParams
}: {
  searchParams?: Promise<{ raceId?: string; status?: string; severity?: string; type?: string; rider?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/api/auth/github");
  if (!ctx.profileCompleted) redirect("/profile");

  const { raceId, status = "all", severity = "all", type = "all", rider = "all" } = (await searchParams) ?? {};
  const { race, allFlags, ownFlags, judgeFlags, availableRaces } = await getRiskCenterSnapshotForUser(ctx.userId, raceId);
  if (!race) {
    return <section className="route-page"><h1>No race seeded</h1></section>;
  }

  const filters = { status, severity, type, rider };
  const canManage = ctx.roles.includes("admin") || ctx.managedRaceIds.includes(race.id);
  const visibleFlags = canManage
    ? allFlags
    : [...new Map([...ownFlags, ...judgeFlags].map((item) => [item.id, item])).values()];
  const organizerFlags = canManage ? sortFlags(allFlags.filter((item) => matchesFilter(item, filters))) : [];
  const riderVisibleFlags = sortFlags(ownFlags.filter((item) => matchesFilter(item, filters)));
  const judgeVisibleFlags = sortFlags(judgeFlags.filter((item) => matchesFilter(item, filters)));
  const riderNames = [...new Set(visibleFlags.map((item) => item.riderName))].sort((left, right) => left.localeCompare(right));
  const typeOptions = [...new Set(visibleFlags.map((item) => item.type))].sort();
  const severityOptions = [...new Set(visibleFlags.map((item) => item.severity))].sort();
  const statusOptions = [...new Set(visibleFlags.map((item) => item.status))].sort();
  const openCount = visibleFlags.filter((item) => item.status === "open").length;
  const inReviewCount = visibleFlags.filter((item) => item.status === "in_review").length;
  const resolvedCount = visibleFlags.filter((item) => item.status === "resolved").length;
  const highRiskCount = visibleFlags.filter((item) => ["high", "danger"].includes(item.severity) && item.status !== "resolved").length;
  const missingMaterialCount = visibleFlags.filter((item) => item.type === "missing_required_material" && item.status !== "resolved").length;
  const ingestionCount = visibleFlags.filter((item) => item.type === "ingestion_exception" && item.status !== "resolved").length;
  const topFlag = organizerFlags[0] ?? riderVisibleFlags[0] ?? judgeVisibleFlags[0] ?? null;

  return (
    <section className="route-page risk-center-page">
      <section className="hero-copy risk-center-hero">
        <p className="section-kicker">Risk Center / {race.title}</p>
        <h1>风险评审中心</h1>
        <p className="hero-subtitle">把评审前风险从“看到摘要”推进到“发现、处置、复核、回流评审上下文”的完整闭环。</p>
        <div className="work-detail-actions">
          <Link href="/console">返回 Console</Link>
          <Link href={`/races/${race.slug}`}>查看 Race</Link>
          <Link href="/screen">Screen Console</Link>
        </div>
      </section>

      <section className="console-signal-bar risk-center-overview">
        <article>
          <span>Current Race</span>
          <b>{race.status}</b>
          <p>{race.visibility} / {race.slug}</p>
        </article>
        <article>
          <span>Open Flags</span>
          <b>{openCount + inReviewCount}</b>
          <p>未解决风险会继续进入 Organizer 和 Judge 评审上下文。</p>
        </article>
        <article>
          <span>Resolved Flags</span>
          <b>{resolvedCount}</b>
          <p>已解决风险保留处置记录，不自动从审计链路中消失。</p>
        </article>
        <article>
          <span>Race switch</span>
          <b>{availableRaces.length} races</b>
          <p>
            {availableRaces.map((item) => (
              <Link className="inline-action" href={`/console/risk-center?raceId=${item.id}`} key={item.id}>{item.title}</Link>
            ))}
          </p>
        </article>
      </section>

      <section className="console-flow-strip risk-priority-strip" aria-label="Risk priorities">
        <article className={highRiskCount > 0 ? "active" : "done"}>
          <span>高优先级</span>
          <b>{highRiskCount}</b>
          <p>建议先处理高严重度且仍未解决的风险。</p>
        </article>
        <article className={missingMaterialCount > 0 ? "active" : "done"}>
          <span>缺材料</span>
          <b>{missingMaterialCount}</b>
          <p>作品材料缺口最容易拖慢评审，优先补齐。</p>
        </article>
        <article className={ingestionCount > 0 ? "active" : "done"}>
          <span>接入异常</span>
          <b>{ingestionCount}</b>
          <p>检查 connector、握手和签名来源，避免证据链断裂。</p>
        </article>
        <article className={topFlag ? "active" : "done"}>
          <span>当前焦点</span>
          <b>{topFlag?.type ?? "none"}</b>
          <p>{topFlag ? `${topFlag.riderName} / ${topFlag.workTitle ?? "未提交作品"}` : "当前没有待处理焦点。"}</p>
        </article>
      </section>

      <section className="form-card risk-filter-card">
        <h2>筛选</h2>
        <div className="risk-quick-filters">
          <Link className="inline-action" href={filterHref({ raceId: race.id, status: "open" })}>只看 open</Link>
          <Link className="inline-action" href={filterHref({ raceId: race.id, status: "in_review" })}>只看 in_review</Link>
          <Link className="inline-action" href={filterHref({ raceId: race.id, severity: "high" })}>只看 high</Link>
          <Link className="inline-action" href={filterHref({ raceId: race.id, type: "missing_required_material" })}>只看缺材料</Link>
          <Link className="inline-action" href={filterHref({ raceId: race.id })}>清空筛选</Link>
        </div>
        <form className="console-field-form risk-filter-form" action="/console/risk-center">
          <input type="hidden" name="raceId" value={race.id} />
          <label>
            <span>Status</span>
            <select name="status" defaultValue={status}>
              <option value="all">all</option>
              {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Severity</span>
            <select name="severity" defaultValue={severity}>
              <option value="all">all</option>
              {severityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select name="type" defaultValue={type}>
              <option value="all">all</option>
              {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Rider</span>
            <select name="rider" defaultValue={rider}>
              <option value="all">all</option>
              {riderNames.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button type="submit">应用筛选</button>
        </form>
      </section>

      {canManage ? (
        <section className="form-card risk-lane">
          <h2>Organizer 处置席</h2>
          <p className="form-hint">可以查看本场 Race 的全部风险、补充处理说明、标记为 in_review / resolved，或重新打开。</p>
          <div className="risk-flag-grid">
            {organizerFlags.length ? organizerFlags.map((flag) => (
              <article className="risk-flag-card" data-testid={`risk-flag-${flag.id}`} key={flag.id}>
                <div className="risk-flag-header">
                  <span className={`status-pill ${toneFor(flag.severity)}`}>{flag.severity}</span>
                  <b>{flag.type}</b>
                  <em className={`status-pill ${toneFor(flag.status)}`}>{flag.status}</em>
                </div>
                <p>{flag.judgeVisibleSummary}</p>
                <div className="risk-flag-meta">
                  <span>Rider: {flag.riderName}</span>
                  <span>Work: {flag.workTitle ?? "未提交"}</span>
                  <span>CA: {flag.projectStatus} / {flag.connectionHealth}</span>
                  <span>Connections: {flag.connectionCount}</span>
                  <span>Source: {sourceLabel(flag.sourceRefJson)}</span>
                  <span>Created: {formatTime(flag.createdAt)}</span>
                  <span>Updated: {formatTime(flag.updatedAt)}</span>
                </div>
                <div className="risk-card-actions">
                  {flag.workSlug ? <Link className="inline-action" href={`/works/${flag.workSlug}`}>查看 Work</Link> : null}
                  <Link className="inline-action" href="/console">返回 Console</Link>
                </div>
                <p className="form-hint">建议动作：{actionHint(flag.type)}</p>
                {flag.resolutionNote ? <p className="risk-note">处置记录：{flag.resolutionNote}</p> : null}
                {flag.resolvedByName ? <p className="risk-note">最近处理人：{flag.resolvedByName} / {formatTime(flag.resolvedAt)}</p> : null}
                <form className="console-field-form risk-disposition-form" action={updateReviewFlagStatusAction}>
                  <input type="hidden" name="flagId" value={flag.id} />
                  <label>
                    <span>处理状态</span>
                    <select name="status" defaultValue={flag.status}>
                      <option value="open">open</option>
                      <option value="in_review">in_review</option>
                      <option value="resolved">resolved</option>
                    </select>
                  </label>
                  <label>
                    <span>处理说明</span>
                    <textarea name="resolutionNote" defaultValue={flag.resolutionNote ?? ""} placeholder="记录为什么可继续、需要谁补什么、复核后结论是什么。" />
                  </label>
                  <button type="submit">保存处置</button>
                </form>
              </article>
            )) : <div className="empty-state">当前筛选下没有风险。</div>}
          </div>
        </section>
      ) : null}

      {ctx.roles.includes("rider") ? (
        <section className="form-card risk-lane">
          <h2>Rider 整改席</h2>
          <p className="form-hint">这里只显示与你相关的可整改风险和明确动作，不展示 Organizer 的内部判断。</p>
          <div className="risk-flag-grid">
            {riderVisibleFlags.length ? riderVisibleFlags.map((flag) => (
              <article className="risk-flag-card rider-risk-card" key={flag.id}>
                <div className="risk-flag-header">
                  <span className={`status-pill ${toneFor(flag.severity)}`}>{flag.severity}</span>
                  <b>{flag.type}</b>
                  <em className={`status-pill ${toneFor(flag.status)}`}>{flag.status}</em>
                </div>
                <p>{flag.judgeVisibleSummary}</p>
                <p className="form-hint">下一步：{actionHint(flag.type)}</p>
                <div className="risk-flag-meta">
                  <span>CA: {flag.projectStatus} / {flag.connectionHealth}</span>
                  <span>Work: {flag.workTitle ?? "未提交"}</span>
                  <span>Updated: {formatTime(flag.updatedAt)}</span>
                </div>
                <div className="risk-card-actions">
                  {flag.workSlug ? <Link className="inline-action" href={`/works/${flag.workSlug}`}>查看作品详情</Link> : null}
                  <Link className="inline-action" href="/console">回到 Rider View</Link>
                </div>
                {flag.status === "resolved" ? (
                  <p className="risk-note">已处理，必要时你可以重新打开这条风险继续补材料。{flag.resolvedByName ? `最近处理人：${flag.resolvedByName}。` : ""}</p>
                ) : null}
                <form className="console-action-row" action={updateReviewFlagStatusAction}>
                  <input type="hidden" name="flagId" value={flag.id} />
                  <input type="hidden" name="status" value="open" />
                  <input type="hidden" name="resolutionNote" value="" />
                  <button type="submit">重新打开</button>
                </form>
              </article>
            )) : <div className="empty-state">你在当前赛事下没有风险提示。</div>}
          </div>
        </section>
      ) : null}

      {ctx.roles.includes("judge") ? (
        <section className="form-card risk-lane">
          <h2>Judge 评审上下文</h2>
          <p className="form-hint">风险只作为评审参考，不自动替代人工评分。已解决风险会保留处置记录，未解决风险会继续提醒。</p>
          <div className="risk-flag-grid">
            {judgeVisibleFlags.length ? judgeVisibleFlags.map((flag) => (
              <article className="risk-flag-card judge-risk-card" key={`${flag.assignmentId}-${flag.id}`}>
                <div className="risk-flag-header">
                  <span className={`status-pill ${toneFor(flag.severity)}`}>{flag.severity}</span>
                  <b>{flag.type}</b>
                  <em className={`status-pill ${toneFor(flag.status)}`}>{flag.status}</em>
                </div>
                <p>{flag.judgeVisibleSummary}</p>
                <div className="risk-flag-meta">
                  <span>Rider: {flag.riderName}</span>
                  <span>Work: {flag.workTitle}</span>
                  <span>Assignment: {flag.assignmentStatus}</span>
                  <span>Updated: {formatTime(flag.updatedAt)}</span>
                </div>
                {flag.resolutionNote ? <p className="risk-note">Organizer 处置：{flag.resolutionNote}</p> : null}
                <div className="risk-card-actions">
                  <Link className="inline-action" href={`/works/${flag.workSlug}/judge`}>进入 Judge View</Link>
                  <Link className="inline-action" href={`/works/${flag.workSlug}`}>公开视角</Link>
                </div>
              </article>
            )) : <div className="empty-state">当前没有分配给你的风险上下文。</div>}
          </div>
        </section>
      ) : null}
    </section>
  );
}
