import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { RoleWorkspacePage } from "@/app/console/RoleWorkspace";
import { ActionOutcomePanel } from "@/app/components/ui";
import { getAuthContext } from "@/lib/auth";
import { getRiderPortfolio } from "@/lib/queries";
import styles from "./RiderRaceWorkspace.module.css";

function isLegacyActionError(message?: string) {
  return Boolean(message && /(失败|错误|拒绝|无权|不存在|必须|不能|已关闭|closed_|invalid|forbidden)/i.test(message));
}

export default async function RiderRaceWorkspacePage({ params, searchParams }: { params: Promise<{ raceId: string }>; searchParams?: Promise<{ actionMessage?: string; actionError?: string }> }) {
  const { raceId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(`/console/rider/races/${raceId}`)}`);
  if (ctx.activeRole !== "rider") redirect("/console");
  if (!(await getRiderPortfolio(ctx.userId)).some((entry) => entry.race.id === raceId)) notFound();
  const { actionMessage, actionError } = (await searchParams) ?? {};
  const legacyFailure = isLegacyActionError(actionMessage);
  const errorMessage = actionError ?? (legacyFailure ? actionMessage : undefined);
  const successMessage = legacyFailure ? undefined : actionMessage;
  return <>
    {successMessage || errorMessage ? <div className={styles.outcomeWrap}>
      <ActionOutcomePanel
        actionCode={errorMessage ? "rider-race-action-failed" : "rider-race-action-completed"}
        description={errorMessage ?? successMessage}
        entity={{ label: "当前赛事", value: raceId }}
        nextAction={<Link className={styles.outcomeAction} href={`/console/rider/races/${encodeURIComponent(raceId)}`}>查看刷新后的状态</Link>}
        outcome={errorMessage ? "error" : "success"}
        testId={errorMessage ? "console-action-error" : "rider-race-action-outcome"}
        title={errorMessage ? "操作未能完成" : "赛事空间已更新"}
      />
    </div> : null}
    <RoleWorkspacePage role="rider" searchParams={Promise.resolve({ raceId })} />
  </>;
}
