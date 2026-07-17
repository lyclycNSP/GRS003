"use client";

import { useRef, useState } from "react";
import { createTeamAction, joinTeamAction, submitRegistrationAction } from "@/app/actions";
import { PendingSubmitButton } from "@/app/components/PendingSubmitButton";
import styles from "../PublicRace.module.css";

type Mode = "individual" | "create" | "join";

export function RaceRegistrationDialog({ raceId, raceSlug }: { raceId: string; raceSlug: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("individual");
  const hidden = <><input type="hidden" name="raceId" value={raceId} /><input type="hidden" name="raceSlug" value={raceSlug} /></>;

  return <>
    <button className={styles.primaryButton} data-testid="registration-open" type="button" onClick={() => dialogRef.current?.showModal()}>报名参赛</button>
    <dialog className={styles.registrationDialog} ref={dialogRef} aria-labelledby="registration-dialog-title" data-testid="registration-dialog">
      <div className={styles.dialogHeader}>
        <div><span>Rider Registration</span><h2 id="registration-dialog-title">选择参赛方式</h2></div>
        <button aria-label="关闭报名窗口" type="button" onClick={() => dialogRef.current?.close()}>×</button>
      </div>
      <div className={styles.registrationTabs} role="tablist" aria-label="参赛方式">
        <button aria-selected={mode === "individual"} role="tab" type="button" onClick={() => setMode("individual")}>个人报名</button>
        <button aria-selected={mode === "create"} role="tab" type="button" onClick={() => setMode("create")}>创建团队</button>
        <button aria-selected={mode === "join"} role="tab" type="button" onClick={() => setMode("join")}>加入团队</button>
      </div>
      {mode === "individual" ? <form className={styles.dialogForm} action={submitRegistrationAction}>
        {hidden}<p>以个人身份提交报名。确认后不能在同一 Race 中创建或加入团队。</p>
        <PendingSubmitButton label="确认个人报名" pendingLabel="正在提交…" testId="registration-submit" />
      </form> : null}
      {mode === "create" ? <form className={styles.dialogForm} action={createTeamAction}>
        {hidden}
        <label><span>团队名称 *</span><input name="name" required maxLength={80} autoComplete="off" /></label>
        <label><span>团队简介</span><textarea name="description" maxLength={500} placeholder="介绍团队方向与合作方式" /></label>
        <label><span>人数上限 *</span><input name="maxMembers" type="number" min={2} max={10} defaultValue={5} required /></label>
        <PendingSubmitButton label="创建团队" pendingLabel="正在创建…" testId="team-create-submit" />
      </form> : null}
      {mode === "join" ? <form className={styles.dialogForm} action={joinTeamAction}>
        {hidden}
        <label><span>团队邀请码 *</span><input name="inviteCode" required maxLength={32} autoComplete="off" placeholder="输入队长提供的邀请码" /></label>
        <p>邀请码必须属于当前 Race，且团队仍处于筹备状态并有剩余名额。</p>
        <PendingSubmitButton label="加入团队" pendingLabel="正在加入…" testId="team-join-submit" />
      </form> : null}
    </dialog>
  </>;
}
