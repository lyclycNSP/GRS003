"use client";

import { useEffect, useState } from "react";

export type StaticPayload = {
  kind: "static";
  race: { id: string; slug: string; title: string; status: string };
  screenState: { mode: string; fallbackEnabled: boolean };
  metrics: { riders: number; works: number };
  announcement: { title: string; body: string } | null;
  works: Array<{ id: string; title: string; summary: string; entrantDisplayName: string }>;
  leaderboard?: Array<{ name: string; detail: string }>;
  readiness?: { issues: Array<{ code: string; message: string }> };
};

export function StaticScreenClient({ raceSlug, initial, pollingEnabled = true }: { raceSlug: string; initial: StaticPayload; pollingEnabled?: boolean }) {
  const [data, setData] = useState(initial);
  useEffect(() => {
    if (!pollingEnabled) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/public/races/${encodeURIComponent(raceSlug)}/screen`, { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json() as StaticPayload | { kind: "race_live" };
        if (body.kind === "race_live") { window.location.reload(); return; }
        if (active) setData((current) => ({ ...body, leaderboard: current.leaderboard }));
      } catch { /* Preserve the last readable state during transient failures. */ }
    };
    const timer = window.setInterval(() => void poll(), 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [pollingEnabled, raceSlug]);

  const mode = data.screenState.mode;
  const title = mode === "announcement" ? data.announcement?.title || data.race.title : data.race.title;
  return <section className="static-screen" data-testid="static-screen-display">
    <header className="static-screen-header"><div><span>ARY RACE LIVE</span><h1>{title}</h1></div><div><strong>● {data.race.status.toUpperCase()}</strong><br /><em>{mode}</em></div></header>
    {mode === "announcement" ? <section className="static-screen-panel" data-testid="race-live-mode-content"><div><h2>{data.announcement?.body || "暂无公告"}</h2><p>现场信息会在发布后自动更新。</p></div></section> : null}
    {mode === "works" ? <section className="screen-board-list" data-testid="race-live-mode-content">{data.works.length ? data.works.map((work) => <article key={work.id}><b>{work.entrantDisplayName}</b><span>{work.title}</span><em>{work.summary}</em></article>) : <div className="race-live-empty">暂无公开作品</div>}</section> : null}
    {mode === "leaderboard" ? <section className="screen-board-list" data-testid="race-live-mode-content">{data.leaderboard?.length ? data.leaderboard.map((entry, index) => <article key={`${entry.name}-${index}`}><b>#{index + 1}</b><span>{entry.name}</span><em>{entry.detail}</em></article>) : <div className="race-live-empty">榜单尚未生成</div>}</section> : null}
    {mode === "live" ? <section className="static-screen-panel" data-testid="race-live-mode-content"><div><h2>赛事正在准备实时大屏</h2><p>{data.readiness?.issues[0]?.message ?? "等待 Round、Track 与稳定 Projection 配置；准备完成后此页面会自动切换。"}</p>{data.readiness?.issues.length ? <ul>{data.readiness.issues.map((issue) => <li key={issue.code}>{issue.message}</li>)}</ul> : null}<div className="static-screen-metrics"><span><b>{data.metrics.riders}</b>Riders</span><span><b>{data.metrics.works}</b>Works</span></div></div></section> : null}
    <footer className="static-screen-footer"><span>{mode}</span><span>{data.screenState.fallbackEnabled ? "static fallback" : data.race.status}</span></footer>
  </section>;
}
