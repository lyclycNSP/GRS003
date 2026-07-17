"use client";

import { FormEvent, useState } from "react";
import { AppIcon } from "@/app/components/AppIcon";
import { ActionOutcomePanel } from "@/app/components/ui";
import styles from "./OrganizerPortfolio.module.css";

const MAX_BYTES = 10 * 1024 * 1024;

const ROLE_DESTINATIONS = {
  admin: "/console/admin",
  judge: "/console/judge",
  organizer: "/console/organizer",
  rider: "/console/rider",
} as const;

type CreateError =
  | "validation"
  | "race-create-failed"
  | ProblemUploadFailure
  | "";

type ProblemUploadFailure =
  | "problem-active-content"
  | "problem-invalid-format"
  | "problem-scan-failed"
  | "problem-storage-failed"
  | "problem-too-large"
  | "problem-upload-failed";

interface JsonRecord {
  [key: string]: unknown;
}

class ProblemUploadError extends Error {
  constructor(readonly failure: ProblemUploadFailure) {
    super(failure);
  }
}

const problemFailureCopy: Record<ProblemUploadFailure, { title: string; description: string }> = {
  "problem-active-content": {
    title: "Race 草稿已保留，赛题 PDF 被安全策略拒绝",
    description: "该 PDF 包含脚本、附件或主动内容。请移除这些内容、重新导出安全 PDF 后再上传。",
  },
  "problem-invalid-format": {
    title: "Race 草稿已保留，赛题 PDF 格式无效",
    description: "文件不是受支持的 PDF，或 PDF 签名与结构检查未通过。请重新导出后再上传。",
  },
  "problem-scan-failed": {
    title: "Race 草稿已保留，安全扫描未完成",
    description: "安全扫描服务暂时不可用或检查失败。文件没有被放行，请稍后在 Race Workspace 重试。",
  },
  "problem-storage-failed": {
    title: "Race 草稿已保留，赛题文件未写入",
    description: "Organizer 的私有对象存储暂时不可用。文件没有被平台公开，请检查存储配置后重试。",
  },
  "problem-too-large": {
    title: "Race 草稿已保留，赛题 PDF 超出限制",
    description: "文件超过 10 MiB 或流式接收限制。请压缩文件后在 Race Workspace 重新上传。",
  },
  "problem-upload-failed": {
    title: "Race 草稿已保留，赛题 PDF 未完成",
    description: "赛题 PDF 未通过安全接收流程，文件没有被放行。请进入刚创建的 Race Workspace 重试。",
  },
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function canonicalRoleDestination(value: unknown) {
  if (typeof value !== "string") return null;
  const role = value.toLowerCase() as keyof typeof ROLE_DESTINATIONS;
  return ROLE_DESTINATIONS[role] ?? null;
}

function legacyCurrentRole(payload: JsonRecord) {
  const message = typeof payload.error === "string" ? payload.error : "";
  if (!message.includes("当前会话角色")) return null;
  const role = message.match(/\b(admin|judge|organizer|rider)\b/i)?.[1];
  return canonicalRoleDestination(role);
}

function activeRoleDestination(payload: JsonRecord) {
  const code = payload.code ?? payload.errorCode ?? payload.error;
  if (code === "ACTIVE_ROLE_MISMATCH") {
    return canonicalRoleDestination(payload.currentRole);
  }
  return legacyCurrentRole(payload);
}

function mapProblemUploadFailure(payload: unknown, status: number): ProblemUploadFailure {
  const record = asRecord(payload);
  const code = [record.code, record.errorCode]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  const message = typeof record.error === "string" ? record.error.toLowerCase() : "";
  const signal = `${code} ${message}`;

  if (/active|javascript|launch|xfa|embedded|attachment|主动|脚本|附件/.test(signal)) {
    return "problem-active-content";
  }
  if (status === 413 || /too[_ -]?large|size[_ -]?limit|10\s*mib|超限|过大|大小/.test(signal)) {
    return "problem-too-large";
  }
  if (/mime|magic|signature|structure|invalid[_ -]?pdf|format|格式|签名|结构/.test(signal)) {
    return "problem-invalid-format";
  }
  if (/clam|scanner|scan[_ -]?failed|scan[_ -]?unavailable|virus|malware|扫描|病毒/.test(signal)) {
    return "problem-scan-failed";
  }
  if (/storage|bucket|object[_ -]?store|s3|存储|对象/.test(signal)) {
    return "problem-storage-failed";
  }
  return "problem-upload-failed";
}

async function responseJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<JsonRecord>;
}

export function CreateRaceSecureForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CreateError>("");
  const [status, setStatus] = useState("");
  const [createdRaceId, setCreatedRaceId] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setCreatedRaceId("");
    setBusy(true);

    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("problemPdf");
    if (file instanceof File && file.size) {
      if (file.size > MAX_BYTES || file.type !== "application/pdf" || !/\.pdf$/i.test(file.name)) {
        setError("validation");
        setBusy(false);
        return;
      }
    }

    let savedRaceId = "";
    try {
      setStatus("正在创建私有 Race 草稿…");
      const created = await fetch("/api/console/races", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          challenge: data.get("challenge"),
          summary: data.get("summary"),
        }),
      });
      const createdBody = await responseJson(created);

      if (created.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent("/console/organizer")}`);
        return;
      }
      if (created.status === 403) {
        const destination = activeRoleDestination(createdBody);
        if (destination) {
          window.location.assign(destination);
          return;
        }
        setError("race-create-failed");
        setBusy(false);
        return;
      }
      if (!created.ok || typeof createdBody.raceId !== "string") {
        throw new Error("RACE_CREATE_FAILED");
      }

      savedRaceId = createdBody.raceId;
      setCreatedRaceId(savedRaceId);

      if (file instanceof File && file.size) {
        setStatus("正在隔离并安全检查赛题 PDF…");
        const intentResponse = await fetch(
          `/api/console/races/${encodeURIComponent(savedRaceId)}/problem-upload-intent`,
          { method: "POST" },
        );
        const intent = await responseJson(intentResponse);
        if (!intentResponse.ok || typeof intent.token !== "string") {
          throw new ProblemUploadError(mapProblemUploadFailure(intent, intentResponse.status));
        }

        const upload = await fetch(
          `/api/console/races/${encodeURIComponent(savedRaceId)}/problem-versions`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/pdf",
              "X-File-Name": encodeURIComponent(file.name),
              "X-Upload-Token": intent.token,
            },
            body: file,
          },
        );
        const uploaded = await responseJson(upload);
        if (!upload.ok) {
          throw new ProblemUploadError(mapProblemUploadFailure(uploaded, upload.status));
        }
      }

      window.location.assign(
        `/console/organizer/races/${encodeURIComponent(savedRaceId)}?action=race-created&entityId=${encodeURIComponent(savedRaceId)}`,
      );
    } catch (cause) {
      if (savedRaceId) {
        setCreatedRaceId(savedRaceId);
        setError(cause instanceof ProblemUploadError ? cause.failure : "problem-upload-failed");
      } else {
        setError("race-create-failed");
      }
      setStatus("");
      setBusy(false);
    }
  }

  const uploadFailure = error.startsWith("problem-")
    ? problemFailureCopy[error as ProblemUploadFailure]
    : null;

  return (
    <form className={styles.createForm} data-testid="organizer-race-create-form" onSubmit={submit}>
      <label>
        <span>赛事名 <strong>*</strong></span>
        <input name="title" placeholder="例如：湾区 Agent 挑战赛" required />
        <small>用于赛事资产列表与公开 Race Page。</small>
      </label>
      <label>
        <span>挑战说明 <strong>*</strong></span>
        <input name="challenge" placeholder="描述参赛者需要完成的核心挑战" required />
        <small>文字赛题始终保留，可附加安全 PDF。</small>
      </label>
      <label>
        <span>赛事摘要</span>
        <textarea name="summary" placeholder="补充赛事背景、目标和范围" rows={4} />
      </label>
      <label>
        <span>赛题 PDF（可选）</span>
        <input accept="application/pdf,.pdf" data-testid="race-problem-file" name="problemPdf" type="file" />
        <small>仅 PDF，最大 10 MiB；通过隔离与安全检查后才可使用。</small>
      </label>
      <div className={styles.createNotice}>
        <AppIcon name="shield" size={17} />
        <p>
          <strong>默认保持私有草稿</strong>
          <span>PDF 上传失败不会公开文件，Race 草稿会保留以便重试。</span>
        </p>
      </div>
      {status ? <p role="status">{status}</p> : null}
      {error === "validation" ? (
        <p data-testid="race-problem-error" role="alert">赛题文件必须是 10 MiB 以内的 PDF</p>
      ) : null}
      {error === "race-create-failed" ? (
        <ActionOutcomePanel
          actionCode="race-create-failed"
          description="平台未写入新的赛事资产。请检查当前 Organizer 角色、必填字段和服务状态后重试。"
          outcome="error"
          testId="race-create-outcome"
          title="Race 未能创建"
        />
      ) : null}
      {uploadFailure ? (
        <ActionOutcomePanel
          actionCode={error}
          description={uploadFailure.description}
          entity={createdRaceId ? { label: "已保留 Race ID", value: createdRaceId } : undefined}
          nextAction={createdRaceId ? (
            <a href={`/console/organizer/races/${encodeURIComponent(createdRaceId)}`}>
              进入 Race Workspace 重新上传
            </a>
          ) : undefined}
          outcome="warning"
          testId="race-problem-error"
          title={uploadFailure.title}
        />
      ) : null}
      <button className={styles.raceAction} data-testid="create-race-submit" disabled={busy} type="submit">
        {busy ? "正在创建…" : "创建 Race"}
      </button>
    </form>
  );
}
