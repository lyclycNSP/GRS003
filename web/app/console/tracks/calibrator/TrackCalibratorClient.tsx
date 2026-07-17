"use client";

import { useEffect, useState } from "react";
import { publishTrackProfileVersionAction } from "@/app/actions";
import { PendingActionButton } from "@/app/components/ui";
import { CanvasEditor } from "@/components/track-calibrator/CanvasEditor";
import { CalibratorToolbar } from "@/components/track-calibrator/CalibratorToolbar";
import { ManualValidationPanel } from "@/components/track-calibrator/ManualValidationPanel";
import { ProfileInspector } from "@/components/track-calibrator/ProfileInspector";
import { PublishPanel } from "@/components/track-calibrator/PublishPanel";
import { PublishedVersionsPanel, type PublishedTrackVersionItem } from "@/components/track-calibrator/PublishedVersionsPanel";
import { TrackPreview } from "@/components/track-calibrator/TrackPreview";
import { ValidationPanel } from "@/components/track-calibrator/ValidationPanel";
import { createCalibratorDraftRepository } from "@/lib/track-calibrator/draft-repository";
import { createManualValidationState, type CalibratorDraft, type CalibratorValidationReport, type ManualValidationState } from "@/lib/track-calibrator/draft-types";
import { createEditorHistory, pushEditorChange, redoEditorChange, reverseTrackDirection, undoEditorChange } from "@/lib/track-calibrator/editor-history";
import { parseTrackProfile, validateTrackProfile, type TrackProfile } from "@/lib/track-profile";
import { compileTrack } from "@/lib/track-runtime";
import styles from "../TrackTools.module.css";

function editableProfile(input: unknown): TrackProfile {
  const source = parseTrackProfile(input);
  const { publishedAt: _publishedAt, ...profile } = source;
  const now = new Date().toISOString();
  return parseTrackProfile({ ...profile, trackId: `${source.trackId}-custom`, version: "1.0.0", status: "draft", createdAt: now, updatedAt: now, background: { ...source.background, assetId: `${source.trackId}-custom-background-1.0.0` } });
}

export function TrackCalibratorClient({ raceId, initialProfile, initialBackgroundAssetRef, versions }: { raceId: string; initialProfile: unknown; initialBackgroundAssetRef: string; versions: PublishedTrackVersionItem[] }) {
  const draftId = `race:${raceId}:current`;
  const [editor, setEditor] = useState(() => createEditorHistory(editableProfile(initialProfile)));
  const profile = editor.present;
  const [background, setBackground] = useState<Blob | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [report, setReport] = useState<CalibratorValidationReport | null>(null);
  const [status, setStatus] = useState("editing");
  const [message, setMessage] = useState("加载本地 Draft…");
  const [publishRequestId, setPublishRequestId] = useState("");
  const [publishedHashes, setPublishedHashes] = useState<{ profileHash: string; backgroundHash: string } | null>(null);
  const [manualValidation, setManualValidation] = useState<ManualValidationState>(() => createManualValidationState());
  const [localAction, setLocalAction] = useState<"background" | "save" | "import" | "export" | "delete" | null>(null);

  useEffect(() => {
    const repository = createCalibratorDraftRepository();
    void (async () => {
      const saved = await repository.getDraft(draftId);
      if (saved) {
        setEditor(createEditorHistory(saved.profile));
        setReport(saved.validationReport);
        setManualValidation(saved.manualValidation);
        const blob = await repository.getBackground(saved.backgroundAssetId);
        if (blob) setBackground(blob);
        else {
          const response = await fetch(initialBackgroundAssetRef);
          if (response.ok) setBackground(await response.blob());
        }
        setPublishRequestId(saved.publishRequestId ?? crypto.randomUUID());
        setMessage("已恢复浏览器本地 Draft");
        return;
      }
      setPublishRequestId(crypto.randomUUID());
      const response = await fetch(initialBackgroundAssetRef);
      if (response.ok) setBackground(await response.blob());
      setMessage("尚未保存本地 Draft");
    })().catch(() => setMessage("本地 Draft 读取失败"));
  }, [draftId]);

  useEffect(() => {
    if (!background) { setBackgroundUrl(null); return; }
    const url = URL.createObjectURL(background);
    setBackgroundUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [background]);

  function invalidateValidation() {
    setReport(null);
    setManualValidation(createManualValidationState());
    setStatus("editing");
    setPublishedHashes(null);
    setPublishRequestId(crypto.randomUUID());
  }

  const dirty = (next: TrackProfile) => {
    setEditor((current) => pushEditorChange(current, { ...next, updatedAt: new Date().toISOString() }));
    invalidateValidation();
  };
  const buildDraft = (): CalibratorDraft => ({ draftId, raceId, profile, backgroundAssetId: profile.background.assetId, validationReport: report, manualValidation, ...(publishRequestId ? { publishRequestId } : {}), savedAt: new Date().toISOString() });

  async function saveDraft(showProgress = true) {
    if (!background) { setMessage("背景尚未加载，不能保存 Draft"); return; }
    if (showProgress) {
      setLocalAction("save");
      setMessage("正在保存本地 Draft…");
    }
    try {
      await createCalibratorDraftRepository().saveDraft(buildDraft(), background ?? undefined);
      setMessage("本地 Draft 已保存");
      return true;
    } catch {
      setMessage("本地 Draft 保存失败，请检查浏览器存储权限后重试");
      return false;
    } finally {
      if (showProgress) setLocalAction(null);
    }
  }

  function validate() {
    setStatus("validating");
    const result = validateTrackProfile(profile);
    const issues = result.issues.map((issue) => ({ code: issue.code, message: issue.message, ...(issue.path ? { path: issue.path } : {}) }));
    if (result.valid) {
      try { compileTrack(profile); } catch { issues.push({ code: "RUNTIME_GEOMETRY", message: "Track运行时几何编译失败" }); }
    }
    const next = { generatedAt: new Date().toISOString(), valid: result.valid && issues.length === 0, issues };
    setReport(next);
    setStatus(next.valid ? "ready" : "failed");
  }

  async function publish() {
    if (!background || !report?.valid) return;
    setStatus("publishing");
    if (!await saveDraft(false)) { setStatus("failed"); return; }
    const form = new FormData();
    form.set("publishRequestId", publishRequestId);
    form.set("raceId", raceId);
    form.set("profileJson", JSON.stringify(profile));
    form.set("validationReportJson", JSON.stringify(report));
    form.set("manualValidationJson", JSON.stringify(manualValidation));
    form.set("background", new File([background], profile.background.fileName, { type: background.type || "image/webp" }));
    const result = await publishTrackProfileVersionAction(form);
    setStatus(result.ok ? "published" : "failed");
    setPublishedHashes(result.ok ? { profileHash: result.profileHash, backgroundHash: result.backgroundHash } : null);
    setMessage(result.message);
  }

  async function selectBackground(file: File) {
    if (!file.type.startsWith("image/")) { setMessage("背景文件类型无效"); return; }
    setLocalAction("background");
    setMessage("正在读取并校验背景图片…");
    try {
      const bitmap = await createImageBitmap(file);
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const checksum = `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      setBackground(file);
      dirty({ ...profile, background: { ...profile.background, fileName: file.name, width: bitmap.width, height: bitmap.height, checksum } });
      bitmap.close();
      setMessage(`背景已载入：${file.name}`);
    } catch {
      setMessage("背景读取失败，请重新选择有效图片");
    } finally {
      setLocalAction(null);
    }
  }

  function copyAsNewDraft() {
    const parts = profile.version.split(".").map(Number);
    const version = parts.length === 3 && parts.every(Number.isInteger) ? `${parts[0]}.${parts[1]}.${parts[2] + 1}` : "1.0.1";
    dirty({ ...profile, version, status: "draft", background: { ...profile.background, assetId: `${profile.trackId}-background-${version}` } });
    setPublishRequestId(crypto.randomUUID());
    setMessage("已复制为新版本 Draft");
  }

  function applyHistory(next: typeof editor) {
    if (next === editor) return;
    setEditor(next);
    invalidateValidation();
  }

  async function importDraft(file: File) {
    setLocalAction("import");
    setMessage("正在导入 Draft…");
    try {
      const repository = createCalibratorDraftRepository();
      const imported = await repository.importDraftBundle(file);
      if (imported.draft.raceId && imported.draft.raceId !== raceId) {
        setMessage("Draft 属于其他赛事，不能导入当前赛事");
        return;
      }
      setEditor(createEditorHistory(imported.draft.profile));
      setReport(imported.draft.validationReport);
      setManualValidation(imported.draft.manualValidation);
      setPublishRequestId(imported.draft.publishRequestId ?? crypto.randomUUID());
      setPublishedHashes(null);
      setStatus(imported.draft.validationReport?.valid ? "ready" : "editing");
      if (imported.background) setBackground(imported.background);
      await repository.saveDraft({ ...imported.draft, draftId, raceId, savedAt: new Date().toISOString() }, imported.background ?? undefined);
      setMessage("Draft 已导入并保存到浏览器");
    } catch (error) {
      setMessage(error instanceof Error ? `Draft 导入失败：${error.message}` : "Draft 导入失败");
    } finally {
      setLocalAction(null);
    }
  }

  async function exportDraft() {
    setLocalAction("export");
    setMessage("正在生成 Draft 导出文件…");
    try {
      const blob = await createCalibratorDraftRepository().exportDraftBundle(draftId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${profile.trackId}-${profile.version}.ary-track-draft.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Draft 导出已开始");
    } catch {
      setMessage("Draft 导出失败，请先保存本地 Draft");
    } finally {
      setLocalAction(null);
    }
  }

  async function deleteDraft() {
    setLocalAction("delete");
    setMessage("正在删除本地 Draft…");
    try {
      await createCalibratorDraftRepository().deleteDraft(draftId);
      setMessage("本地 Draft 已删除");
    } catch {
      setMessage("本地 Draft 删除失败，请重试");
    } finally {
      setLocalAction(null);
    }
  }

  return <section aria-busy={localAction !== null || status === "publishing"} className={`${styles.calibratorPage} calibrator-shell`}>
    <header className={`${styles.calibratorHero} module-title`}><div><p className="section-kicker">ARY Track Calibrator · Local IndexedDB Draft</p><h1>赛道标定工具</h1><p>编辑状态只保存在当前浏览器；发布时由服务端重新校验并生成不可变 TrackProfileVersion。</p></div><span className={styles.draftMessage} data-testid="draft-message">{message}</span></header>
    <CalibratorToolbar canUndo={editor.past.length > 0} canRedo={editor.future.length > 0} onUndo={() => applyHistory(undoEditorChange(editor))} onRedo={() => applyHistory(redoEditorChange(editor))} onReverse={() => dirty(reverseTrackDirection(profile))} onImport={(file) => void importDraft(file)} />
    <div className="calibrator-grid">
      <CanvasEditor profile={profile} backgroundUrl={backgroundUrl} onAddPoint={(point) => dirty({ ...profile, centerline: { ...profile.centerline, points: [...profile.centerline.points, point] } })} onMovePoint={(index, point) => dirty({ ...profile, centerline: { ...profile.centerline, points: profile.centerline.points.map((item, itemIndex) => itemIndex === index ? point : item) } })} onDeletePoint={(index) => dirty({ ...profile, centerline: { ...profile.centerline, points: profile.centerline.points.filter((_, itemIndex) => itemIndex !== index) } })} />
      <ProfileInspector profile={profile} onChange={dirty} />
      <TrackPreview profile={profile} backgroundUrl={backgroundUrl} />
      <ValidationPanel report={report} onValidate={validate} />
      <ManualValidationPanel value={manualValidation} onChange={setManualValidation} />
      <PublishPanel state={status} hashes={publishedHashes} canPublish={Boolean(report?.valid && background && publishRequestId && manualValidation.confirmedAt && Object.values(manualValidation.confirmations).every(Boolean))} onPublish={() => void publish()} onCopy={copyAsNewDraft} />
      <PublishedVersionsPanel versions={versions} onCopy={(item) => void navigator.clipboard.writeText(`${item.trackId}@${item.version}\n${item.profileHash ?? ""}\n${item.backgroundHash ?? ""}`).then(() => setMessage("版本标识已复制"))} />
      <section className="form-card"><h2>Local Draft</h2><label aria-busy={localAction === "background"}>更换背景<input data-testid="background-file" disabled={localAction !== null} type="file" accept="image/webp,image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) void selectBackground(file); }} /></label><PendingActionButton disabled={!background || localAction !== null} isPending={localAction === "save"} label="保存到浏览器" onClick={() => void saveDraft()} pendingLabel="正在保存 Draft…" testId="save-draft" type="button" variant="inherit" /><PendingActionButton disabled={localAction !== null} isPending={localAction === "export"} label="导出 Draft" onClick={() => void exportDraft()} pendingLabel="正在生成导出文件…" testId="export-draft" type="button" variant="inherit" /><PendingActionButton disabled={localAction !== null} isPending={localAction === "delete"} label="删除本地 Draft" onClick={() => void deleteDraft()} pendingLabel="正在删除 Draft…" testId="delete-draft" type="button" variant="inherit" /></section>
    </div>
  </section>;
}
