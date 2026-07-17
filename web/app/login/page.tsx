import Link from "next/link";
import { AppIcon } from "@/app/components/AppIcon";
import styles from "@/app/onboarding/AuthFlow.module.css";
import {
  resolveLoginErrorMessage,
  sanitizeInternalNext
} from "@/lib/login-redirect";
import { hasGithubOAuthConfig } from "@/lib/runtime-config";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  const next = sanitizeInternalNext(query?.next);
  const error = resolveLoginErrorMessage(query?.error);
  const githubEnabled = hasGithubOAuthConfig();
  const debugEnabled = process.env.ENABLE_DEBUG_LOGIN === "true" && process.env.NODE_ENV !== "production";

  return (
    <section className={styles.flowPage} data-testid="login-page">
      <div className={styles.flowBackdrop} aria-hidden="true" />
      <header className={styles.flowHeader}>
        <div className={styles.flowHeaderCopy}>
          <p className={styles.eyebrow}>ARY account · Secure sign in</p>
          <h1>登录 <em>Agent Racing Yard</em></h1>
          <p className={styles.flowHeaderDescription}>使用 GitHub 验证身份。登录完成后将返回你刚才访问的站内页面。</p>
          <div className={styles.cardActions}>
            {githubEnabled ? (
              <a
                className={styles.primaryAction}
                href={`/api/auth/github?next=${encodeURIComponent(next)}`}
                data-testid="github-login"
              >
                继续使用 GitHub<AppIcon name="chevron" size={14} />
              </a>
            ) : (
              <span className={styles.secondaryAction} aria-disabled="true">GitHub OAuth 尚未配置</span>
            )}
            {debugEnabled ? (
              <Link
                className={styles.secondaryAction}
                href={`/debug-login?next=${encodeURIComponent(next)}`}
                data-testid="debug-login-entry"
              >
                使用 Debug Login
              </Link>
            ) : null}
          </div>
        </div>
        <div className={styles.headerVisual} aria-hidden="true"><AppIcon name="identity" size={50} /></div>
      </header>
      {error ? <p className={`${styles.notice} ${styles.noticeError}`} data-testid="login-error">{error}</p> : null}
      <section className={styles.statusCard} aria-label="登录说明">
        <h2>登录后会发生什么？</h2>
        <p>系统会恢复你已有的角色资格与当前工作台，不会通过邮箱把不同 GitHub 身份自动合并。</p>
      </section>
    </section>
  );
}
