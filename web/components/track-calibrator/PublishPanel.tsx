"use client";

export function PublishPanel({ state, hashes, canPublish, onPublish, onCopy }: { state: string; hashes: { profileHash: string; backgroundHash: string } | null; canPublish: boolean; onPublish(): void; onCopy(): void }) {
  return <section className="form-card"><h2>Server Publish</h2><p data-testid="publish-state">{state}</p>{hashes ? <p className="mono">Profile {hashes.profileHash}<br />Background {hashes.backgroundHash}</p> : null}<button data-testid="publish-track" type="button" disabled={!canPublish || state === "publishing"} onClick={onPublish}>发布不可变版本</button>{state === "published" ? <button data-testid="copy-track-draft" type="button" onClick={onCopy}>复制为新 Draft</button> : null}</section>;
}
