"use client";

import type { CalibratorValidationReport } from "@/lib/track-calibrator/draft-types";

export function ValidationPanel({ report, onValidate }: { report: CalibratorValidationReport | null; onValidate(): void }) {
  return <section className="form-card"><h2>Validation</h2><p data-testid="validation-state">{report ? report.valid ? "ready" : "failed" : "dirty / not validated"}</p>
    {report?.issues.map((issue) => <p className="status-pill risk" key={`${issue.code}:${issue.path}`}>{issue.code}: {issue.message}</p>)}
    <button data-testid="validate-track" type="button" onClick={onValidate}>运行校验</button>
  </section>;
}
