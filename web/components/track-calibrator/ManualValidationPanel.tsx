"use client";

import { MANUAL_VALIDATION_ITEMS, type ManualValidationKey, type ManualValidationState } from "@/lib/track-calibrator/draft-types";

export function ManualValidationPanel({ value, onChange }: { value: ManualValidationState; onChange(value: ManualValidationState): void }) {
  const complete = Object.values(value.confirmations).every(Boolean);
  return <section className="form-card manual-validation-panel">
    <div className="panel-heading"><div><p className="section-kicker">Visual QA</p><h2>人工核验清单</h2></div><span className={`status-pill ${complete ? "success" : ""}`}>{complete ? "8 / 8" : `${Object.values(value.confirmations).filter(Boolean).length} / 8`}</span></div>
    <div className="manual-validation-list">
      {MANUAL_VALIDATION_ITEMS.map((item) => <label data-testid="manual-validation-item" key={item.id}>
        <input type="checkbox" checked={value.confirmations[item.id]} onChange={(event) => {
          const confirmations = { ...value.confirmations, [item.id]: event.target.checked } as Record<ManualValidationKey, boolean>;
          const completeNow = Object.values(confirmations).every(Boolean);
          const { confirmedAt: _confirmedAt, ...withoutConfirmation } = value;
          onChange(completeNow ? { ...withoutConfirmation, confirmations, confirmedAt: new Date().toISOString() } : { ...withoutConfirmation, confirmations });
        }} />
        <span>{item.label}</span>
      </label>)}
    </div>
    <label>核验备注<textarea value={value.notes} maxLength={4000} rows={3} onChange={(event) => onChange({ ...value, notes: event.target.value })} /></label>
  </section>;
}
