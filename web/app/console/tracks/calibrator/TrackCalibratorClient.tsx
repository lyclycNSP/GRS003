"use client";

import { useEffect, useState } from "react";
import { publishTrackProfileVersionAction } from "@/app/actions";
import { CanvasEditor } from "@/components/track-calibrator/CanvasEditor";
import { ProfileInspector } from "@/components/track-calibrator/ProfileInspector";
import { PublishPanel } from "@/components/track-calibrator/PublishPanel";
import { TrackPreview } from "@/components/track-calibrator/TrackPreview";
import { ValidationPanel } from "@/components/track-calibrator/ValidationPanel";
import { createCalibratorDraftRepository } from "@/lib/track-calibrator/draft-repository";
import type { CalibratorDraft, CalibratorValidationReport } from "@/lib/track-calibrator/draft-types";
import { parseTrackProfile, validateTrackProfile, type TrackProfile } from "@/lib/track-profile";
import { compileTrack } from "@/lib/track-runtime";

function editableProfile(input: unknown): TrackProfile {
  const source = parseTrackProfile(input);
  const { publishedAt: _publishedAt, ...profile } = source;
  const now = new Date().toISOString();
  return parseTrackProfile({ ...profile, trackId: `${source.trackId}-custom`, version: "1.0.0", status: "draft", createdAt: now, updatedAt: now, background: { ...source.background, assetId: `${source.trackId}-custom-background-1.0.0` } });
}

export function TrackCalibratorClient({ raceId, initialProfile, initialBackgroundAssetRef }: { raceId: string; initialProfile: unknown; initialBackgroundAssetRef: string }) {
  const draftId = `race:${raceId}:current`;
  const [profile, setProfile] = useState(() => editableProfile(initialProfile));
  const [background, setBackground] = useState<Blob | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [report, setReport] = useState<CalibratorValidationReport | null>(null);
  const [status, setStatus] = useState("editing");
  const [message, setMessage] = useState("加载本地 Draft…");
  const [publishRequestId, setPublishRequestId] = useState("");
  const [publishedHashes, setPublishedHashes] = useState<{ profileHash: string; backgroundHash: string } | null>(null);

  useEffect(() => {
    const repository = createCalibratorDraftRepository();
    void (async () => {
      const saved = await repository.getDraft(draftId);
      if (saved) {
        setProfile(saved.profile);
        setReport(saved.validationReport);
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

  const dirty = (next: TrackProfile) => { setProfile({ ...next, updatedAt: new Date().toISOString() }); setReport(null); setStatus("editing"); setPublishedHashes(null); setPublishRequestId(crypto.randomUUID()); };
  const buildDraft = (): CalibratorDraft => ({ draftId, raceId, profile, backgroundAssetId: profile.background.assetId, validationReport: report, ...(publishRequestId ? { publishRequestId } : {}), savedAt: new Date().toISOString() });

  async function saveDraft() {
    if (!background) { setMessage("背景尚未加载，不能保存 Draft"); return; }
    await createCalibratorDraftRepository().saveDraft(buildDraft(), background ?? undefined);
    setMessage("本地 Draft 已保存");
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
    await saveDraft();
    const form = new FormData();
    form.set("publishRequestId", publishRequestId);
    form.set("raceId", raceId);
    form.set("profileJson", JSON.stringify(profile));
    form.set("background", new File([background], profile.background.fileName, { type: background.type || "image/webp" }));
    const result = await publishTrackProfileVersionAction(form);
    setStatus(result.ok ? "published" : "failed");
    setPublishedHashes(result.ok ? { profileHash: result.profileHash, backgroundHash: result.backgroundHash } : null);
    setMessage(result.message);
  }

  async function selectBackground(file: File) {
    if (!file.type.startsWith("image/")) { setMessage("背景文件类型无效"); return; }
    const bitmap = await createImageBitmap(file);
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const checksum = `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    setBackground(file);
    dirty({ ...profile, background: { ...profile.background, fileName: file.name, width: bitmap.width, height: bitmap.height, checksum } });
    bitmap.close();
  }

  function copyAsNewDraft() {
    const parts = profile.version.split(".").map(Number);
    const version = parts.length === 3 && parts.every(Number.isInteger) ? `${parts[0]}.${parts[1]}.${parts[2] + 1}` : "1.0.1";
    dirty({ ...profile, version, status: "draft", background: { ...profile.background, assetId: `${profile.trackId}-background-${version}` } });
    setPublishRequestId(crypto.randomUUID());
    setMessage("已复制为新版本 Draft");
  }

  return <section className="calibrator-shell">
    <header className="module-title"><p className="section-kicker">ARY Track Calibrator / local IndexedDB Draft</p><h1>赛道标定工具</h1><p data-testid="draft-message">{message}</p></header>
    <div className="calibrator-grid">
      <CanvasEditor profile={profile} backgroundUrl={backgroundUrl} onAddPoint={(point) => dirty({ ...profile, centerline: { ...profile.centerline, points: [...profile.centerline.points, point] } })} onMovePoint={(index, point) => dirty({ ...profile, centerline: { ...profile.centerline, points: profile.centerline.points.map((item, itemIndex) => itemIndex === index ? point : item) } })} onDeletePoint={(index) => dirty({ ...profile, centerline: { ...profile.centerline, points: profile.centerline.points.filter((_, itemIndex) => itemIndex !== index) } })} />
      <ProfileInspector profile={profile} onChange={dirty} />
      <TrackPreview profile={profile} backgroundUrl={backgroundUrl} />
      <ValidationPanel report={report} onValidate={validate} />
      <PublishPanel state={status} hashes={publishedHashes} canPublish={Boolean(report?.valid && background && publishRequestId)} onPublish={() => void publish()} onCopy={copyAsNewDraft} />
      <section className="form-card"><h2>Local Draft</h2><label>更换背景<input data-testid="background-file" type="file" accept="image/webp,image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) void selectBackground(file); }} /></label><button data-testid="save-draft" type="button" disabled={!background} onClick={() => void saveDraft()}>保存到浏览器</button><button data-testid="export-draft" type="button" onClick={() => void createCalibratorDraftRepository().exportDraftBundle(draftId).then((blob) => { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${profile.trackId}-${profile.version}.ary-track-draft.json`; link.click(); URL.revokeObjectURL(url); })}>导出 Draft</button><button data-testid="delete-draft" type="button" onClick={() => void createCalibratorDraftRepository().deleteDraft(draftId).then(() => setMessage("本地 Draft 已删除"))}>删除本地 Draft</button></section>
    </div>
  </section>;
}
