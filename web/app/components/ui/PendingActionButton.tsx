"use client";

import React, { type ButtonHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import styles from "./ActionFeedback.module.css";

export type PendingActionButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "inherit";
export type PendingActionButtonSize = "standard" | "compact";

export interface PendingActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: ReactNode;
  pendingLabel?: ReactNode;
  icon?: ReactNode;
  testId?: string;
  variant?: PendingActionButtonVariant;
  size?: PendingActionButtonSize;
  fullWidth?: boolean;
  /** Use this for non-form async work; form submissions use useFormStatus automatically. */
  isPending?: boolean;
}

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PendingActionButton({
  label,
  pendingLabel = "正在处理…",
  icon,
  testId,
  variant = "primary",
  size = "standard",
  fullWidth = false,
  isPending,
  className,
  disabled,
  type = "submit",
  ...props
}: PendingActionButtonProps) {
  const formStatus = useFormStatus();
  const pending = isPending ?? formStatus.pending;

  return (
    <button
      {...props}
      aria-busy={pending}
      className={classes(
        variant !== "inherit" && styles.button,
        variant !== "inherit" && styles[variant],
        variant !== "inherit" && styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      data-testid={testId}
      disabled={disabled || pending}
      type={type}
    >
      {pending ? <span aria-hidden="true" className={styles.spinner} /> : icon ? <span aria-hidden="true" className={styles.buttonIcon}>{icon}</span> : null}
      <span>{pending ? pendingLabel : label}</span>
    </button>
  );
}
