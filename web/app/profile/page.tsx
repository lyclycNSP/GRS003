import Link from "next/link";
import { updateProfileAction } from "@/app/actions";
import { getAuthContext } from "@/lib/auth";
import { getCurrentUserProfile } from "@/lib/queries";

export default async function ProfilePage() {
  const ctx = await getAuthContext();
  const user = ctx ? await getCurrentUserProfile(ctx.userId) : null;

  if (!ctx || !user) {
    return (
      <section className="route-page">
        <section className="profile-form-panel route-hero">
          <div className="profile-form-head">
            <span>Login</span>
            <b>需要 GitHub 登录</b>
          </div>
          <p>登录后补全 Profile，再进入 Workspace。</p>
          <Link className="inline-action" href="/api/auth/github">GitHub 登录</Link>
        </section>
      </section>
    );
  }

  return (
    <section className="route-page">
      <section className="module-title route-hero">
        <p className="section-kicker">Profile Completion</p>
        <h1>{user.profileCompleted ? "Profile" : "补全资料"}</h1>
        <p className="module-summary">展示名、城市和 GitHub login 会出现在 Console、Works 和 Rider Profile 中。</p>
      </section>
      <section className="profile-form-panel">
        <div className="profile-form-head">
          <span>{user.profileCompleted ? "complete" : "required"}</span>
          <b>{user.displayName}</b>
        </div>
        <form className="profile-form-grid" action={updateProfileAction}>
          <label>展示名<input name="displayName" defaultValue={user.displayName} /></label>
          <label>城市<input name="city" defaultValue={user.city ?? ""} /></label>
          <label>GitHub<input name="githubLogin" defaultValue={user.githubLogin ?? ""} /></label>
          <button type="submit">保存并进入 Workspace</button>
        </form>
      </section>
    </section>
  );
}
