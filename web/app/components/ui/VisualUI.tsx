import Link from "next/link";
import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from "react";
import styles from "./VisualUI.module.css";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "violet";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type BreadcrumbItem = {
  label: ReactNode;
  href?: string;
};

export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items, className, ...props }: BreadcrumbProps) {
  return (
    <nav aria-label="面包屑" className={classes(styles.breadcrumb, className)} {...props}>
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;
        return (
          <span key={`${index}-${String(item.href ?? item.label)}`}>
            {index > 0 ? <span aria-hidden="true" className={styles.breadcrumbSeparator}>/</span> : null}
            {item.href && !isCurrent
              ? <Link href={item.href}>{item.label}</Link>
              : <span aria-current={isCurrent ? "page" : undefined} className={isCurrent ? styles.breadcrumbCurrent : undefined}>{item.label}</span>}
          </span>
        );
      })}
    </nav>
  );
}

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  compact?: boolean;
}

export function PageHeader({ title, eyebrow, description, breadcrumbs, actions, compact = false, className, ...props }: PageHeaderProps) {
  return (
    <header className={classes(styles.pageHeader, compact && styles.compactHeader, className)} {...props}>
      <div className={styles.pageHeaderCopy}>
        {breadcrumbs?.length ? <Breadcrumb items={breadcrumbs} /> : null}
        <div className={styles.pageHeaderText}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1 className={styles.title}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className={styles.pageHeaderActions}>{actions}</div> : null}
    </header>
  );
}

export interface MetricCardProps extends HTMLAttributes<HTMLElement> {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}

export function MetricCard({ label, value, hint, icon, tone = "primary", className, ...props }: MetricCardProps) {
  const toneClass = {
    neutral: styles.metricNeutral,
    primary: styles.metricPrimary,
    success: styles.metricSuccess,
    warning: styles.metricWarning,
    danger: styles.metricDanger,
    violet: styles.metricViolet,
  }[tone];
  return (
    <article className={classes(styles.metricCard, toneClass, className)} {...props}>
      <div className={styles.metricTopline}>
        <span className={styles.metricLabel}>{label}</span>
        {icon ? <span aria-hidden="true" className={styles.metricIcon}>{icon}</span> : null}
      </div>
      <strong className={styles.metricValue}>{value}</strong>
      {hint ? <p className={styles.metricHint}>{hint}</p> : null}
    </article>
  );
}

export type StatRailItem = {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
};

export interface StatRailProps extends HTMLAttributes<HTMLElement> {
  items: StatRailItem[];
}

export function StatRail({ items, className, ...props }: StatRailProps) {
  return (
    <dl className={classes(styles.statRail, className)} data-testid="compact-stat-rail" {...props}>
      {items.map((item, index) => (
        <div className={classes(styles.statRailItem, item.tone && styles[`statRail${item.tone[0].toUpperCase()}${item.tone.slice(1)}` as keyof typeof styles])} key={`${index}-${String(item.label)}`}>
          {item.icon ? <span aria-hidden="true" className={styles.statRailIcon}>{item.icon}</span> : null}
          <div>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
            {item.hint ? <small>{item.hint}</small> : null}
          </div>
        </div>
      ))}
    </dl>
  );
}

export type LifecycleStep = {
  label: ReactNode;
  detail?: ReactNode;
  state: "complete" | "current" | "upcoming";
  testId?: string;
};

export interface LifecycleStepperProps extends HTMLAttributes<HTMLOListElement> {
  steps: LifecycleStep[];
}

export function LifecycleStepper({ steps, className, style, ...props }: LifecycleStepperProps) {
  return (
    <ol className={classes(styles.lifecycle, className)} data-testid="race-lifecycle" style={{ "--lifecycle-columns": steps.length, ...style } as CSSProperties} {...props}>
      {steps.map((step, index) => (
        <li aria-current={step.state === "current" ? "step" : undefined} className={styles[`lifecycle${step.state[0].toUpperCase()}${step.state.slice(1)}` as keyof typeof styles]} data-testid={step.testId} key={`${index}-${String(step.label)}`}>
          <span aria-hidden="true" className={styles.lifecycleMarker}>{step.state === "complete" ? "✓" : index + 1}</span>
          <strong>{step.label}</strong>
          {step.detail ? <small>{step.detail}</small> : null}
        </li>
      ))}
    </ol>
  );
}

export type KeyValueItem = {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
};

export interface KeyValueListProps extends HTMLAttributes<HTMLElement> {
  items: KeyValueItem[];
}

export function KeyValueList({ items, className, ...props }: KeyValueListProps) {
  return (
    <dl className={classes(styles.keyValueList, className)} data-testid="key-value-list" {...props}>
      {items.map((item, index) => <div key={`${index}-${String(item.label)}`}><dt>{item.label}</dt><dd className={item.tone ? styles[`keyValue${item.tone[0].toUpperCase()}${item.tone.slice(1)}` as keyof typeof styles] : undefined}>{item.value}{item.hint ? <small>{item.hint}</small> : null}</dd></div>)}
    </dl>
  );
}

export interface StatusSummaryProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: Tone;
}

export function StatusSummary({ eyebrow, title, description, action, tone = "primary", className, ...props }: StatusSummaryProps) {
  return <section className={classes(styles.statusSummary, styles[`summary${tone[0].toUpperCase()}${tone.slice(1)}` as keyof typeof styles], className)} data-testid="status-summary" {...props}>
    <div>{eyebrow ? <span>{eyebrow}</span> : null}<strong>{title}</strong>{description ? <p>{description}</p> : null}</div>
    {action ? <div className={styles.statusSummaryAction}>{action}</div> : null}
  </section>;
}

export interface ActionCalloutProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  tone?: Tone;
}

export function ActionCallout({ title, description, icon, primaryAction, secondaryAction, tone = "primary", className, ...props }: ActionCalloutProps) {
  return <aside className={classes(styles.actionCallout, styles[`callout${tone[0].toUpperCase()}${tone.slice(1)}` as keyof typeof styles], className)} {...props}>
    {icon ? <span aria-hidden="true" className={styles.actionCalloutIcon}>{icon}</span> : null}
    <div className={styles.actionCalloutCopy}><strong>{title}</strong>{description ? <p>{description}</p> : null}</div>
    <div className={styles.actionCalloutActions}>{primaryAction}{secondaryAction}</div>
  </aside>;
}

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Exclude<Tone, "primary"> | "info";
  dot?: boolean;
  children: ReactNode;
}

export function StatusBadge({ tone = "neutral", dot = false, className, children, ...props }: StatusBadgeProps) {
  const toneClass = {
    neutral: styles.statusNeutral,
    info: styles.statusInfo,
    success: styles.statusSuccess,
    warning: styles.statusWarning,
    danger: styles.statusDanger,
    violet: styles.statusViolet,
  }[tone];
  return <span className={classes(styles.statusBadge, toneClass, dot && styles.statusDot, className)} {...props}>{children}</span>;
}

export interface SearchToolbarProps extends HTMLAttributes<HTMLDivElement> {
  start?: ReactNode;
  end?: ReactNode;
  children?: ReactNode;
}

export function SearchToolbar({ start, end, children, className, ...props }: SearchToolbarProps) {
  return (
    <div className={classes(styles.toolbar, className)} {...props}>
      <div className={styles.toolbarStart}>{start ?? children}</div>
      {end ? <div className={styles.toolbarEnd}>{end}</div> : null}
    </div>
  );
}

export interface ContentCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  interactive?: boolean;
  variant?: "default" | "soft" | "accent";
}

export function ContentCard({ title, description, actions, children, interactive = false, variant = "default", className, ...props }: ContentCardProps) {
  return (
    <section className={classes(styles.card, interactive && styles.cardInteractive, variant === "soft" && styles.cardSoft, variant === "accent" && styles.cardAccent, className)} {...props}>
      {title || description || actions ? (
        <header className={styles.cardHeader}>
          <div className={styles.cardHeading}>{title ? <h2>{title}</h2> : null}{description ? <p>{description}</p> : null}</div>
          {actions ? <div className={styles.cardActions}>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export interface DetailPanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function DetailPanel({ title, description, actions, children, className, ...props }: DetailPanelProps) {
  return (
    <aside className={classes(styles.detailPanel, className)} {...props}>
      {title || description || actions ? (
        <header className={styles.detailHeader}>
          <div>{title ? <h2>{title}</h2> : null}{description ? <p>{description}</p> : null}</div>
          {actions ? <div className={styles.cardActions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={styles.detailBody}>{children}</div>
    </aside>
  );
}

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={classes(styles.emptyState, className)} {...props}>
      <div>
        {icon ? <span aria-hidden="true" className={styles.emptyStateIcon}>{icon}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {action ? <div className={styles.emptyStateAction}>{action}</div> : null}
      </div>
    </div>
  );
}

export interface FormSectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function FormSection({ title, description, actions, children, className, ...props }: FormSectionProps) {
  return (
    <section className={classes(styles.formSection, className)} {...props}>
      {title || description || actions ? (
        <header className={styles.formSectionHeader}>
          <div>{title ? <h2>{title}</h2> : null}{description ? <p>{description}</p> : null}</div>
          {actions ? <div className={styles.cardActions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={styles.formSectionBody}>{children}</div>
    </section>
  );
}

export interface FormGridProps extends HTMLAttributes<HTMLDivElement> {
  dense?: boolean;
}

export function FormGrid({ dense = false, className, ...props }: FormGridProps) {
  return <div className={classes(styles.formGrid, dense && styles.formGridDense, className)} {...props} />;
}

export interface ActionBarProps extends HTMLAttributes<HTMLDivElement> {
  message?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function ActionBar({ message, actions, children, className, ...props }: ActionBarProps) {
  return (
    <div className={classes(styles.actionBar, className)} {...props}>
      {message ? <div className={styles.actionBarMessage}>{message}</div> : null}
      <div className={styles.actionBarActions}>{actions ?? children}</div>
    </div>
  );
}
