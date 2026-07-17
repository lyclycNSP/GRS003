"use client";

import { DragEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon } from "@/app/components/AppIcon";
import styles from "./RaceProblemManager.module.css";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CHANGE_NOTE = 500;

type Version = {
  id: string;
  revision: number;
  displayName: string;
  sizeBytes: number;
  sha256: string;
  scanStatus: string;
  scanDetail: string | null;
  changeNote: string | null;
  storageProvider: string;
  isCurrent: boolean;
};

type UploadPhase = "idle" | "selected" | "uploading" | "scanning" | "success" | "error";

type UploadResult = { error?: string };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function scanLabel(status: string) {
  const labels: Record<string, string> = {
    clean: "安全检查通过",
    quarantined: "等待安全检查",
    rejected: "已被安全策略拒绝",
    scan_failed: "安全检查失败",
    disabled: "已安全停用"
  };
  return labels[status] ?? status;
}

function storageLabel(provider: string) {
  const labels: Record<string, string> = {
    organizer_s3: "Organizer 私有存储",
    ephemeral_memory: "开发环境临时存储",
    platform_legacy: "平台旧存储",
    discarded: "未保留文件正文"
  };
  return labels[provider] ?? provider;
}

function validateFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "仅支持 .pdf 格式的赛题文件。";
  if (file.type && file.type !== "application/pdf") return "文件类型与 PDF 不一致，请重新选择。";
  if (file.size === 0) return "所选文件为空，请重新选择。";
  if (file.size > MAX_FILE_BYTES) return "文件不能超过 10 MiB。";
  return null;
}

function readJsonResponse(xhr: XMLHttpRequest): UploadResult {
  try {
    return JSON.parse(xhr.responseText || "{}") as UploadResult;
  } catch {
    return {};
  }
}

export function RaceProblemManager({ raceId, raceStatus, versions }: { raceId: string; raceStatus: string; versions: Version[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [changeNoteLength, setChangeNoteLength] = useState(0);

  const isUploading = phase === "uploading" || phase === "scanning";

  function selectFile(nextFile: File | null) {
    if (!nextFile) return;
    const error = validateFile(nextFile);
    if (error) {
      setFile(null);
      setPhase("error");
      setMessage(error);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(nextFile);
    setProgress(0);
    setMessage("");
    setPhase("selected");
  }

  function resetSelection() {
    if (isUploading) return;
    setFile(null);
    setProgress(0);
    setMessage("");
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!isUploading) selectFile(event.dataTransfer.files.item(0));
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setPhase("error");
      setMessage("请选择 PDF");
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setPhase("error");
      setMessage(validationError);
      return;
    }

    const data = new FormData(event.currentTarget);
    const changeNote = String(data.get("changeNote") ?? "").trim();
    if (raceStatus !== "draft" && !changeNote) {
      setPhase("error");
      setMessage("已发布 Race 的新修订必须填写修改说明。");
      return;
    }

    setPhase("uploading");
    setProgress(0);
    setMessage("");

    try {
      const intentResponse = await fetch(`/api/console/races/${encodeURIComponent(raceId)}/problem-upload-intent`, { method: "POST" });
      const intent = await intentResponse.json() as { token?: string; error?: string };
      if (!intentResponse.ok || !intent.token) throw new Error(intent.error ?? "无法创建安全上传任务");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `/api/console/races/${encodeURIComponent(raceId)}/problem-versions`);
        xhr.setRequestHeader("Content-Type", "application/pdf");
        xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
        xhr.setRequestHeader("X-Change-Note", encodeURIComponent(changeNote));
        xhr.setRequestHeader("X-Upload-Token", intent.token as string);
        xhr.upload.onprogress = (progressEvent) => {
          if (progressEvent.lengthComputable) setProgress(Math.min(100, Math.round((progressEvent.loaded / progressEvent.total) * 100)));
        };
        xhr.upload.onload = () => {
          setProgress(100);
          setPhase("scanning");
        };
        xhr.onerror = () => reject(new Error("网络连接中断，请重试上传。"));
        xhr.onabort = () => reject(new Error("上传已取消。"));
        xhr.onload = () => {
          const result = readJsonResponse(xhr);
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(result.error ?? "赛题安全检查失败"));
        };
        xhr.send(file);
      });

      setPhase("success");
      setMessage("赛题已通过安全检查，新修订已保存。可在下方版本历史中下载或设为当前修订。");
      setFile(null);
      setProgress(100);
      setChangeNoteLength(0);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (cause) {
      setPhase("error");
      setMessage(cause instanceof Error ? cause.message : "上传失败，请重试。");
    }
  }

  async function publish(versionId: string) {
    setPublishingId(versionId);
    setMessage("");
    try {
      const response = await fetch(`/api/console/races/${encodeURIComponent(raceId)}/problem-versions/${encodeURIComponent(versionId)}/publish`, { method: "POST" });
      const body = await response.json() as UploadResult;
      if (!response.ok) throw new Error(body.error ?? "发布失败");
      setPhase("success");
      setMessage("当前赛题修订已切换，Rider 下载入口将使用这个安全版本。");
      router.refresh();
    } catch (cause) {
      setPhase("error");
      setMessage(cause instanceof Error ? cause.message : "发布失败，请重试。");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <section className={styles.problemWorkspace} data-testid="race-problem-manager">
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Race problem attachment</span>
          <div className={styles.heroTitle}><span><AppIcon name="works" size={28} /></span><h2>赛题 PDF</h2></div>
          <p>文件只有在格式校验和安全扫描通过后才能下载。已发布 Race 的新修订必须保留清晰的修改说明。</p>
          <div className={styles.heroFacts} aria-label="上传安全摘要">
            <span><AppIcon name="shield" size={15} />安全扫描</span>
            <span><AppIcon name="briefcase" size={15} />Organizer 自有存储</span>
            <span><AppIcon name="works" size={15} />不可变修订记录</span>
          </div>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <span className={styles.artSheet}><b>PDF</b><i /><i /><i /></span>
          <span className={styles.artFolder}><AppIcon name="briefcase" size={52} /></span>
          <span className={styles.artShield}><AppIcon name="shield" size={22} /></span>
        </div>
      </header>

      <div className={styles.workspaceGrid}>
        <div className={styles.mainColumn}>
          <form className={styles.uploadCard} onSubmit={upload}>
            <header className={styles.sectionHeading}>
              <span aria-hidden="true" />
              <div><h3>{versions.length ? "上传新修订" : "上传赛题文件"}</h3><p>选择文件后先核对信息，再开始安全上传。</p></div>
            </header>

            <label
              className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""} ${isUploading ? styles.dropzoneBusy : ""}`}
              htmlFor="race-problem-pdf"
              onDragEnter={(event) => { event.preventDefault(); if (!isUploading) setDragging(true); }}
              onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <input
                accept="application/pdf,.pdf"
                aria-label="赛题 PDF"
                disabled={isUploading}
                id="race-problem-pdf"
                name="problemPdf"
                onChange={(event) => selectFile(event.target.files?.item(0) ?? null)}
                ref={inputRef}
                required={!file}
                type="file"
              />
              <span className={styles.dropIcon}><AppIcon name="works" size={28} /></span>
              <span className={styles.dropCopy}><strong>{dragging ? "松开即可选择文件" : "点击选择文件"}</strong><em>或将 PDF 拖放到这里</em><small>仅支持 PDF，文件不超过 10 MiB</small></span>
            </label>

            {file ? <div className={styles.selectedFile} data-testid="race-problem-selected-file">
              <span className={styles.pdfBadge}>PDF</span>
              <div><strong>{file.name}</strong><span>{formatBytes(file.size)} · 等待安全上传</span></div>
              <button aria-label="重新选择文件" disabled={isUploading} onClick={resetSelection} type="button">重新选择</button>
            </div> : null}

            {raceStatus !== "draft" ? <label className={styles.noteField}>
              <span>修订说明 <b>*</b></span>
              <textarea
                aria-label="本次修订说明"
                disabled={isUploading}
                maxLength={MAX_CHANGE_NOTE}
                name="changeNote"
                onChange={(event) => setChangeNoteLength(event.target.value.length)}
                placeholder="本次修订说明（必填）"
                required
                rows={4}
              />
              <small><span>请说明修改内容、原因和主要影响。</span><span>{changeNoteLength} / {MAX_CHANGE_NOTE}</span></small>
            </label> : <div className={styles.draftHint}><AppIcon name="shield" size={17} /><span><strong>当前为私有草稿</strong>首次附件不要求修订说明；发布后每次更新都必须记录原因。</span></div>}

            {phase === "uploading" || phase === "scanning" ? <div className={styles.progressPanel} role="status" aria-live="polite">
              <div><strong>{phase === "uploading" ? "正在安全传输…" : "正在进行安全扫描…"}</strong><span>{phase === "uploading" ? `${progress}%` : "请勿关闭页面"}</span></div>
              <span className={`${styles.progressTrack} ${phase === "scanning" ? styles.progressScanning : ""}`}><i style={phase === "uploading" ? { width: `${progress}%` } : undefined} /></span>
              <p>{phase === "uploading" ? "文件正在发送到隔离检查流程。" : "正在检查文件结构、主动内容和恶意样本；扫描结果不会伪造百分比。"}</p>
            </div> : null}

            {message ? <div className={`${styles.outcome} ${phase === "success" ? styles.outcomeSuccess : styles.outcomeError}`} role={phase === "error" ? "alert" : "status"}>
              <span><AppIcon name={phase === "success" ? "shield" : "alert"} size={21} /></span>
              <div><strong>{phase === "success" ? "操作已完成" : "操作未完成"}</strong><p>{message}</p></div>
              {phase === "error" ? <button onClick={() => { setMessage(""); setPhase(file ? "selected" : "idle"); }} type="button">返回修改</button> : null}
            </div> : null}

            <div className={styles.formFooter}>
              <p><AppIcon name="shield" size={16} />安全检查失败的文件不会公开，也不会覆盖最后一个安全版本。</p>
              <button className={styles.primaryButton} disabled={isUploading || !file} type="submit">
                <AppIcon name="works" size={17} />
                {phase === "uploading" ? "正在上传…" : phase === "scanning" ? "安全扫描中…" : versions.length ? "上传新修订" : "上传赛题 PDF"}
              </button>
            </div>
          </form>

          <section className={styles.historyCard} aria-labelledby="problem-version-history">
            <header className={styles.historyHeading}><div><span>Version history</span><h3 id="problem-version-history">修订版本</h3></div><b>{versions.length} 个版本</b></header>
            {versions.length ? <ol className={styles.versionList}>{versions.map((version) => (
              <li className={`${styles.versionRow} ${version.isCurrent ? styles.currentVersion : ""}`} key={version.id}>
                <span className={styles.pdfBadge}>PDF</span>
                <div className={styles.versionBody}>
                  <div className={styles.versionTitle}><strong>修订 {version.revision}{version.isCurrent ? " · 当前" : ""}</strong><span className={version.scanStatus === "clean" ? styles.cleanBadge : styles.warningBadge}><AppIcon name={version.scanStatus === "clean" ? "shield" : "alert"} size={13} />{scanLabel(version.scanStatus)}</span></div>
                  <p>{version.displayName}</p>
                  <span>{formatBytes(version.sizeBytes)} · {storageLabel(version.storageProvider)} · SHA-256 {version.sha256.slice(0, 12)}…</span>
                  {version.changeNote ? <em>{version.changeNote}</em> : null}
                  {version.scanStatus !== "clean" && version.scanDetail ? <em className={styles.scanDetail}>{version.scanDetail}</em> : null}
                </div>
                <div className={styles.versionActions}>
                  {version.scanStatus === "clean" ? <a href={`/api/race-problems/${encodeURIComponent(version.id)}/download`}><AppIcon name="chevron" size={14} />下载</a> : null}
                  {!version.isCurrent && version.scanStatus === "clean" ? <button aria-busy={publishingId === version.id} disabled={publishingId !== null} onClick={() => publish(version.id)} type="button">{publishingId === version.id ? "正在切换…" : "设为当前修订"}</button> : null}
                </div>
              </li>
            ))}</ol> : <div className={styles.emptyHistory}><span><AppIcon name="works" size={28} /></span><div><strong>尚未上传赛题附件</strong><p>文字挑战说明仍然有效，PDF 是可选的补充材料。</p></div></div>}
          </section>
        </div>

        <aside className={styles.sideColumn} aria-label="上传须知">
          <section className={styles.guideCard}>
            <h3>上传须知</h3>
            <ul>
              <li><span><AppIcon name="works" size={17} /></span><div><strong>文件格式</strong><p>仅支持标准 PDF 格式</p></div></li>
              <li><span><AppIcon name="briefcase" size={17} /></span><div><strong>文件限制</strong><p>不超过 10 MiB、最多 200 页</p></div></li>
              <li><span><AppIcon name="shield" size={17} /></span><div><strong>安全检查</strong><p>主动内容、加密文件和恶意样本会被拒绝</p></div></li>
              <li><span><AppIcon name="identity" size={17} /></span><div><strong>修订留痕</strong><p>发布后的每次修改均需说明原因</p></div></li>
            </ul>
          </section>
          <section className={styles.storageCard}>
            <span><AppIcon name="shield" size={22} /></span>
            <div><h3>数据存储边界</h3><p>生产环境的赛题正文转存到 Organizer 自有私有对象存储；平台只保存校验元数据并提供受权下载渠道。</p></div>
          </section>
          {versions.some((version) => version.storageProvider === "platform_legacy") ? <section className={styles.legacyNotice} role="alert"><AppIcon name="alert" size={19} /><div><strong>发现旧存储附件</strong><p>请配置 Organizer 自有对象存储并完成校验迁移。</p></div></section> : null}
        </aside>
      </div>
    </section>
  );
}
