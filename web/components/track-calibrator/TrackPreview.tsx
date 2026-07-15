"use client";

import { useMemo, useState } from "react";
import type { TrackProfile } from "@/lib/track-profile";
import { buildPreviewModel, type PreviewScenario } from "@/lib/track-calibrator/preview";

export function TrackPreview({ profile, backgroundUrl }: { profile: TrackProfile; backgroundUrl: string | null }) {
  const [horseCount, setHorseCount] = useState(8);
  const [scenario, setScenario] = useState<PreviewScenario>("clustered");
  const [progress, setProgress] = useState(0.5);
  const model = useMemo(() => buildPreviewModel({ profile, horseCount, progress, scenario, visualState: "running" }), [profile, horseCount, progress, scenario]);
  return <section className="form-card calibrator-preview-panel">
    <div className="panel-heading"><div><p className="section-kicker">Shared Runtime</p><h2>赛道运行预览</h2></div><span>{model.entries.length} racers</span></div>
    <div className="preview-controls">
      <label>Racer 数量<select data-testid="preview-horse-count" value={horseCount} onChange={(event) => setHorseCount(Number(event.target.value))}><option value="1">1</option><option value="4">4</option><option value="8">8</option></select></label>
      <label>场景<select data-testid="preview-scenario" value={scenario} onChange={(event) => setScenario(event.target.value as PreviewScenario)}><option value="uniform">均匀分布</option><option value="clustered">密集追逐</option><option value="start_cluster">起点集群</option><option value="finish_sprint">终点冲刺</option></select></label>
      <label>进度 {Math.round(progress * 100)}%<input data-testid="preview-progress" type="range" min="0" max="1" step="0.01" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label>
    </div>
    <div className="calibrator-preview" style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined} data-testid="track-preview">
      {model.entries.map((entry, index) => <span data-testid="track-preview-entry" className="calibrator-preview-entry" key={entry.entryId} style={{ left: `${entry.pose.x / profile.viewBox.width * 100}%`, top: `${entry.pose.y / profile.viewBox.height * 100}%`, zIndex: entry.pose.zIndex }}><img src="/race-live/horse-blue.png" alt="" /><b>{index + 1}</b></span>)}
      {model.error ? <p className="preview-error">{model.error}</p> : null}
    </div>
    <div className="calibrator-minimap" aria-label="小地图预览">
      {model.entries.map((entry, index) => <i key={entry.entryId} style={{ left: `${entry.miniMapPose.x / profile.viewBox.width * 100}%`, top: `${entry.miniMapPose.y / profile.viewBox.height * 100}%` }}>{index + 1}</i>)}
    </div>
  </section>;
}
