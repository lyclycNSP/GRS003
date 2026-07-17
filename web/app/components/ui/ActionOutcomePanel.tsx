import React, { type HTMLAttributes, type ReactNode } from "react";
import styles from "./ActionFeedback.module.css";

export type ActionOutcome = "success" | "error" | "warning" | "info";

export interface ActionOutcomeEntity {
  label: ReactNode;
  value: ReactNode;
}

export interface ActionOutcomePanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  actionCode: string;
  outcome: ActionOutcome;
  title: ReactNode;
  description?: ReactNode;
  entity?: ActionOutcomeEntity;
  nextAction?: ReactNode;
  secondaryAction?: ReactNode;
  testId?: string;
}

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function OutcomeIcon({ outcome }: { outcome: ActionOutcome }) {
  const paths = {
    success: <path d="m7.5 12 3 3 6-7" />,
    error: <><path d="M8 8l8 8M16 8l-8 8" /></>,
    warning: <><path d="M12 7v6" /><path d="M12 17h.01" /></>,
    info: <><path d="M12 11v6" /><path d="M12 7h.01" /></>,
  }[outcome];

  return (
    <svg aria-hidden="true" fill="none" height="23" viewBox="0 0 24 24" width="23">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths}</g>
    </svg>
  );
}

const outcomeLabels: Record<ActionOutcome, string> = {
  success: "操作已完成",
  error: "操作未完成",
  warning: "需要继续处理",
  info: "状态已更新",
};

export function ActionOutcomePanel({
  actionCode,
  outcome,
  title,
  description,
  entity,
  nextAction,
  secondaryAction,
  testId = "action-outcome-panel",
  className,
  ...props
}: ActionOutcomePanelProps) {
  const isError = outcome === "error";

  return (
    <section
      {...props}
      aria-live={isError ? "assertive" : "polite"}
      className={classes(styles.outcomePanel, styles[outcome], className)}
      data-action-code={actionCode}
      data-outcome={outcome}
      data-testid={testId}
      role={isError ? "alert" : "status"}
    >
      <span className={styles.outcomeIcon}><OutcomeIcon outcome={outcome} /></span>
      <div className={styles.outcomeCopy}>
        <span className={styles.outcomeEyebrow}>{outcomeLabels[outcome]}</span>
        <h2 className={styles.outcomeTitle}>{title}</h2>
        {description ? <p className={styles.outcomeDescription}>{description}</p> : null}
        {entity ? <dl className={styles.outcomeEntity}><dt>{entity.label}</dt><dd>{entity.value}</dd></dl> : null}
      </div>
      {nextAction || secondaryAction ? <div className={styles.outcomeActions}>{nextAction}{secondaryAction}</div> : null}
    </section>
  );
}
