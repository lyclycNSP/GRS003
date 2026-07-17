import { notFound, redirect } from "next/navigation";
import { saveRoleProfileDraftAction, submitRoleProfileAction } from "@/app/actions";
import { AppIcon } from "@/app/components/AppIcon";
import { CharacterCountTextarea } from "@/app/components/CharacterCountTextarea";
import { PendingSubmitButton } from "@/app/components/PendingSubmitButton";
import { ProfileField, ProfilePageShell } from "@/app/components/AuthenticatedShells";
import { DetailPanel, StatusBadge } from "@/app/components/ui";
import styles from "@/app/components/AuthenticatedUI.module.css";
import { getAuthContext } from "@/lib/auth";
import { fromJson } from "@/lib/json";
import { getOnboardingState } from "@/lib/queries";
import { isSelectableRole } from "@/lib/role-profile";

export default async function RoleProfilePage({ params, searchParams }: { params: Promise<{ role: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { role } = await params;
  if (!isSelectableRole(role)) notFound();
  const ctx = await getAuthContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(`/onboarding/${role}`)}`);
  if (!ctx.profileCompleted) redirect("/profile");
  const state = await getOnboardingState(ctx.userId, role);
  if (!state) redirect("/profile");
  const grant = state.roles.find((item) => item.role === role && item.status === "active");
  if (!grant && !state.currentApplication) redirect("/onboarding/role");
  const query = await searchParams;
  const social = fromJson<{ linkedin?: string; x?: string }>(state.riderProfile?.socialLinksJson, {});
  const roleLabel = role[0].toUpperCase() + role.slice(1);
  const descriptions = {
    rider: "完善可公开展示的 Rider Profile，让其他参赛者、主办方和合作伙伴了解你的技能与作品。",
    judge: "补充评审专长、从业背景与利益冲突声明，资料仅用于资格审核和赛事协作。",
    organizer: "介绍你的机构、赛事经验和组织方向，资料仅用于资格审核和赛事协作。"
  } as const;
  const reviewNotes = {
    rider: ["资料将作为公开 Rider Profile 的基础信息。", "提交完整资料后 Rider 资格立即生效。", "公开链接仅接受完整的 http 或 https 地址。"],
    judge: ["评审资料只用于资格审核和赛事协作。", "利益冲突声明是提交资格资料的必要确认。", "Admin 审核通过前不能激活 Judge。"],
    organizer: ["组织资料只用于资格审核和赛事协作。", "审核通过后才能创建或协作管理 Race。", "Organizer 权限仅覆盖本人负责的赛事。"]
  } as const;
  return (
    <ProfilePageShell role={role} title={<>{grant ? "管理" : "补充"} <em>{roleLabel}</em> 资料</>} description={descriptions[role]}>
      {query.saved ? <p className={styles.profileNotice}>草稿已保存，可以继续完善后提交。</p> : null}
      {query.error ? <p className={`${styles.profileNotice} ${styles.profileNoticeError}`}>{query.error}</p> : null}
      <div className={styles.profileLayout}>
      <form className={styles.profileSurface} action={submitRoleProfileAction} data-testid="profile-form">
        <input type="hidden" name="role" value={role} />
        <header className={styles.profileSurfaceHeader}>
          <span><AppIcon name={role === "rider" ? "user" : role === "judge" ? "shield" : "building"} size={28} /></span>
          <div><h2>{role === "rider" ? "你的公开资料" : role === "judge" ? "评审资格资料" : "组织者资格资料"}</h2><p>带 * 的项目为必填。标签使用逗号分隔，链接需填写完整的 http 或 https 地址。</p></div>
        </header>
        <div className={styles.profileFormGrid}>
          {role === "rider" ? <>
            <ProfileField icon="identity" label="身份简介" required hint="用一句话介绍你的职业、方向或擅长领域，2–80 个字符。"><input name="headline" minLength={2} maxLength={80} required defaultValue={state.riderProfile?.headline ?? ""} placeholder="例如：全栈开发者 / Agent 产品设计师" /></ProfileField>
            <ProfileField icon="tag" label="技能标签" required hint="使用逗号分隔，可填写 1–20 个标签。"><input name="skills" required defaultValue={fromJson<string[]>(state.riderProfile?.skillsJson, []).join(", ")} placeholder="TypeScript, Agent UX, Product Design" /></ProfileField>
            <ProfileField icon="globe" label="国家/地区" hint="选填，用于公开资料中的地域信息。"><input name="countryCode" maxLength={80} defaultValue={state.riderProfile?.countryCode ?? ""} /></ProfileField>
            <ProfileField icon="building" label="城市" hint="选填，填写你长期工作或学习所在城市。"><input name="city" maxLength={80} defaultValue={state.riderProfile?.city ?? ""} /></ProfileField>
            <ProfileField icon="building" label="组织或学校" hint="选填，展示你的组织、团队或学校。"><input name="organization" maxLength={120} defaultValue={state.riderProfile?.organization ?? ""} /></ProfileField>
            <ProfileField icon="link" label="作品集网址" hint="选填，链接到个人网站或公开作品集。"><input type="url" name="websiteUrl" defaultValue={state.riderProfile?.websiteUrl ?? ""} placeholder="https://your-portfolio.example" /></ProfileField>
            <ProfileField icon="quote" label="个人简介" wide hint="介绍你的背景、创作理念或希望合作的方向，最多 160 个字符。"><CharacterCountTextarea name="bio" maxLength={160} defaultValue={state.riderProfile?.bio ?? ""} /></ProfileField>
            <ProfileField icon="link" label="LinkedIn" hint="选填，填写完整的 LinkedIn 个人主页地址。"><input type="url" name="linkedinUrl" defaultValue={social.linkedin ?? ""} /></ProfileField>
            <ProfileField icon="link" label="X（Twitter）" hint="选填，填写完整的 X 个人主页地址。"><input type="url" name="xUrl" defaultValue={social.x ?? ""} /></ProfileField>
          </> : null}
          {role === "judge" ? <>
            <ProfileField icon="building" label="组织" required hint="当前所在机构、公司或专业组织。"><input name="organization" minLength={2} maxLength={120} required defaultValue={state.judgeProfile?.organization ?? ""} /></ProfileField>
            <ProfileField icon="briefcase" label="职务" required hint="你在该机构中的职务或专业身份。"><input name="title" minLength={2} maxLength={80} required defaultValue={state.judgeProfile?.title ?? ""} /></ProfileField>
            <ProfileField icon="tag" label="专长标签" required hint="使用逗号分隔，可填写 1–20 个专长。"><input name="expertise" required defaultValue={fromJson<string[]>(state.judgeProfile?.expertiseJson, []).join(", ")} /></ProfileField>
            <ProfileField icon="calendar" label="从业年限" hint="选填，填写 0–60 的整数。"><input type="number" name="yearsExperience" min={0} max={60} defaultValue={state.judgeProfile?.yearsExperience ?? ""} /></ProfileField>
            <ProfileField icon="link" label="资质或作品链接" wide hint="选填，可提供专业主页、公开作品或资质说明。"><input type="url" name="credentialUrl" defaultValue={state.judgeProfile?.credentialUrl ?? ""} /></ProfileField>
            <ProfileField icon="quote" label="评审背景" required wide hint="说明你的评审经历、方法与关注领域，20–500 个字符。"><CharacterCountTextarea name="reviewBio" minLength={20} maxLength={500} required defaultValue={state.judgeProfile?.reviewBio ?? ""} /></ProfileField>
            <div className={styles.profileConsentGroup}><label className={styles.profileConsent}><input type="checkbox" name="conflictConfirmed" defaultChecked={Boolean(state.judgeProfile?.conflictConfirmedAt)} />我确认会主动披露与参赛者、作品或主办方之间的利益冲突 *</label></div>
          </> : null}
          {role === "organizer" ? <>
            <ProfileField icon="building" label="机构名称" required hint="用于赛事协作与资格审核，2–120 个字符。"><input name="organizationName" minLength={2} maxLength={120} required defaultValue={state.organizerProfile?.organizationName ?? ""} /></ProfileField>
            <ProfileField icon="briefcase" label="职位" required hint="你在机构中的职位或赛事职责。"><input name="position" minLength={2} maxLength={80} required defaultValue={state.organizerProfile?.position ?? ""} /></ProfileField>
            <ProfileField icon="tag" label="赛事类别" required hint="使用逗号分隔，可填写 1–10 个类别。"><input name="eventCategories" required defaultValue={fromJson<string[]>(state.organizerProfile?.eventCategoriesJson, []).join(", ")} /></ProfileField>
            <ProfileField icon="link" label="机构网站" hint="选填，填写机构官网或赛事主页。"><input type="url" name="organizationWebsite" defaultValue={state.organizerProfile?.organizationWebsite ?? ""} /></ProfileField>
            <ProfileField icon="quote" label="组织背景" required wide hint="介绍机构背景、办赛经验和关注方向，20–500 个字符。"><CharacterCountTextarea name="organizerBio" minLength={20} maxLength={500} required defaultValue={state.organizerProfile?.organizerBio ?? ""} /></ProfileField>
          </> : null}
        </div>
        <div className={styles.profileActions}><PendingSubmitButton label={grant ? "保存角色资料" : role === "rider" ? "提交并开通 Rider" : "提交 Admin 审核"} pendingLabel="正在提交…" />{!grant ? <button formAction={saveRoleProfileDraftAction} formNoValidate type="submit">保存草稿</button> : null}</div>
      </form>
      <DetailPanel className={styles.profileAside} title={`${roleLabel} 资格`} description={grant ? "已开通，可持续维护资料" : role === "rider" ? "提交后即时生效" : "提交后进入 Admin 审核"}>
        <div className={styles.profileAsideStatus}><strong>当前状态</strong><StatusBadge tone={grant ? "success" : state.currentApplication?.status === "rejected" ? "danger" : state.currentApplication?.status === "pending" ? "warning" : "info"} dot>{grant ? "有效资格" : state.currentApplication?.status === "rejected" ? "需修改" : state.currentApplication?.status === "pending" ? "审核中" : "填写中"}</StatusBadge></div>
        <ul className={styles.profileAsideList}>{reviewNotes[role].map((note, index) => <li key={note}><span>{index + 1}</span><div>{note}</div></li>)}</ul>
        <p className={styles.profileAsideNote}>保存草稿不会提交审核；正式提交后仍由服务端按照当前账号和角色资格规则处理。</p>
      </DetailPanel>
      </div>
    </ProfilePageShell>
  );
}
