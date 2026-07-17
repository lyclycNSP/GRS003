"use client";

import { PendingActionButton } from "./ui/PendingActionButton";

export function PendingSubmitButton({ label, pendingLabel, testId }: {
  label: string;
  pendingLabel: string;
  testId?: string;
}) {
  return <PendingActionButton label={label} pendingLabel={pendingLabel} testId={testId} variant="inherit" />;
}
