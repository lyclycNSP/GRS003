import Link from "next/link";
import { updateProfileAction } from "@/app/actions";
import { AppIcon } from "@/app/components/AppIcon";
import { ProfileField, ProfilePageShell } from "@/app/components/AuthenticatedShells";
import { PendingSubmitButton } from "@/app/components/PendingSubmitButton";
import { DetailPanel, StatusBadge } from "@/app/components/ui";
import styles from "@/app/components/AuthenticatedUI.module.css";
import flowStyles from "@/app/onboarding/AuthFlow.module.css";
import { getAuthContext } from "@/lib/auth";
import { fromJson } from "@/lib/json";
import { getCurrentUserProfile } from "@/lib/queries";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const ctx = await getAuthContext();
  const user = ctx ? await getCurrentUserProfile(ctx.userId) : null;
  if (!ctx || !user) {
    return <section className={flowStyles.flowPage}><div className={flowStyles.flowBackdrop} aria-hidden="true" /><header className={flowStyles.flowHeader}><div className={flowStyles.flowHeaderCopy}><p className={flowStyles.eyebrow}>ARY account</p><h1>使用 GitHub <em>登录</em></h1><p className={flowStyles.flowHeaderDescription}>普通账号只使用 GitHub OAuth。完成身份验证并选择已验证邮箱后，才能补全账号资料和申请角色。</p><div className={flowStyles.cardActions}><Link className={flowStyles.primaryAction} href={`/login?next=${encodeURIComponent("/profile")}`}>继续使用 GitHub<AppIcon name="chevron" size={14} /></Link></div></div><div className={flowStyles.headerVisual} aria-hidden="true"><AppIcon name="identity" size={50} /></div></header></section>;
  }
  const verifiedEmails = fromJson<string[]>(user.verifiedEmailsJson, []);
  return (
    <ProfilePageShell
      role="account"
      title={user.profileCompleted ? <>管理 <em>账号</em> 资料</> : <>补全 <em>账号</em> 资料</>}
      description="确认你的 GitHub 身份、联系方式与服务偏好。账号资料仅用于身份和服务，不会进入公开 Rider API。"
    >
      {params.error ? <p className={`${styles.profileNotice} ${styles.profileNoticeError}`}>{params.error}</p> : null}
      <div className={styles.profileLayout}>
      <form className={styles.profileSurface} action={updateProfileAction} data-testid="profile-form">
        <header className={styles.profileSurfaceHeader}>
          <span><AppIcon name="identity" size={28} /></span>
          <div><h2>{user.profileCompleted ? "账号身份与服务偏好" : "完成账号初始化"}</h2><p>带 * 的项目为必填。GitHub ID、登录名和头像由 GitHub 管理。</p></div>
        </header>
        <div className={styles.profileFormGrid}>
          <div className={styles.githubIdentity}>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="GitHub avatar" width={58} height={58} /> : <span className={styles.githubAvatarFallback}><AppIcon name="user" size={28} /></span>}
            <div><strong>{user.displayName} · @{user.githubLogin}</strong><p>{user.profileCompleted ? "账号资料已完成，可继续维护展示信息。" : "完成下方信息后即可申请和使用角色资格。"}</p></div>
          </div>
          <ProfileField icon="identity" label="展示名" required hint="用于 ARY 内部协作和公开署名，长度 2–80 个字符。">
            <input name="displayName" minLength={2} maxLength={80} required defaultValue={user.displayName} />
          </ProfileField>
          <ProfileField icon="mail" label="联系邮箱" required hint="仅可选择 GitHub 已验证邮箱。">
            <select name="email" required defaultValue={user.email ?? verifiedEmails[0] ?? ""}>
              <option value="">选择 GitHub 已验证邮箱</option>
              {verifiedEmails.map((email) => <option value={email} key={email}>{email}</option>)}
            </select>
          </ProfileField>
          <ProfileField icon="globe" label="时区" hint="用于赛事时间、通知和截止时间展示。"><input name="timeZone" maxLength={100} defaultValue={user.timeZone ?? "Asia/Shanghai"} /></ProfileField>
          <ProfileField icon="globe" label="界面语言" hint="当前提供简体中文和英文界面偏好。"><select name="locale" defaultValue={user.locale ?? "zh-CN"}><option value="zh-CN">简体中文</option><option value="en">English</option></select></ProfileField>
          <div className={styles.profileConsentGroup}>
            <label className={styles.profileConsent}><input type="checkbox" name="confirmEmail" defaultChecked={Boolean(user.emailConfirmedAt)} />我确认使用该邮箱作为联系邮箱 *</label>
            <label className={styles.profileConsent}><input type="checkbox" name="acceptTerms" defaultChecked={Boolean(user.termsAcceptedAt)} />我同意当前版本服务条款 *</label>
            <label className={styles.profileConsent}><input type="checkbox" name="acceptPrivacy" defaultChecked={Boolean(user.privacyAcceptedAt)} />我同意当前版本隐私政策 *</label>
          </div>
        </div>
        <div className={styles.profileActions}><PendingSubmitButton label="保存账号资料" pendingLabel="正在保存…" /></div>
      </form>
      <DetailPanel className={styles.profileAside} title="账号状态" description="身份来源与资料完整度">
        <div className={styles.profileAsideStatus}><strong>资料状态</strong><StatusBadge tone={user.profileCompleted ? "success" : "warning"} dot>{user.profileCompleted ? "已完成" : "待补全"}</StatusBadge></div>
        <ul className={styles.profileAsideList}><li><span>1</span><div>GitHub 登录名和头像由身份提供方管理。</div></li><li><span>2</span><div>联系邮箱必须来自 GitHub 已验证邮箱列表。</div></li><li><span>3</span><div>账号资料不会自动进入公开 Rider Profile。</div></li></ul>
        <p className={styles.profileAsideNote}>保存账号资料后，可申请 Rider、Judge 或 Organizer；角色资格与当前会话角色彼此独立。</p>
      </DetailPanel>
      </div>
    </ProfilePageShell>
  );
}
