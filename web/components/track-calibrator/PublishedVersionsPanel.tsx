"use client";

import { useState } from "react";
import { archiveTrackProfileVersionAction, deleteArchivedTrackProfileVersionAction } from "@/app/actions";

export type PublishedTrackVersionItem = {
  id: string;
  trackId: string;
  trackName: string;
  version: string;
  status: string;
  scope: string;
  manageable: boolean;
  profileHash: string | null;
  backgroundHash: string | null;
  publishedAt: string | null;
  raceRounds: Array<{ id: string; name: string; raceId: string }>;
};

export function PublishedVersionsPanel({ versions, onCopy }: { versions: PublishedTrackVersionItem[]; onCopy(item: PublishedTrackVersionItem): void }) {
  const [message, setMessage] = useState("");
  async function perform(item: PublishedTrackVersionItem, operation: "archive" | "delete") {
    const form = new FormData();
    form.set("versionId", item.id);
    const result = operation === "archive" ? await archiveTrackProfileVersionAction(form) : await deleteArchivedTrackProfileVersionAction(form);
    setMessage(result.message);
  }
  return <section className="form-card published-versions-panel">
    <div className="panel-heading"><div><p className="section-kicker">Immutable History</p><h2>已发布版本</h2></div><span>{versions.length}</span></div>
    {message ? <p className="status-pill">{message}</p> : null}
    <div className="published-version-list">
      {versions.map((item) => {
        const referenced = item.raceRounds.length > 0;
        const reason = !item.manageable ? "system Track 仅 Admin 可管理" : referenced ? `已被 ${item.raceRounds.map((round) => round.name).join("、")} 引用` : null;
        return <article key={item.id}>
          <div><strong>{item.trackName} {item.version}</strong><small>{item.status} · {item.scope} · {item.publishedAt ?? "legacy"}</small></div>
          <p className="hash-line">{item.profileHash ?? "legacy profile hash"}</p>
          {reason ? <p>{reason}</p> : null}
          <div className="button-row"><button type="button" onClick={() => onCopy(item)}>复制信息</button>
            {item.status === "published" ? <button type="button" disabled={Boolean(reason)} onClick={() => void perform(item, "archive")}>归档</button> : null}
            {item.status === "archived" ? <button type="button" disabled={Boolean(reason)} onClick={() => void perform(item, "delete")}>删除</button> : null}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
