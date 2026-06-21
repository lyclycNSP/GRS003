import Link from "next/link";

const debugUsers = [
  {
    key: "organizer",
    title: "Organizer",
    href: "/api/debug/login?user=organizer",
    description: "Race 创建、报名审核、CA 管理、评审分配、Report 和 Projection。"
  },
  {
    key: "admin",
    title: "Admin",
    href: "/api/debug/login?user=admin",
    description: "User.roles 维护；本地 seed 中同时拥有 organizer、judge 和 rider 权限。"
  },
  {
    key: "rider",
    title: "Rider",
    href: "/api/debug/login?user=rider",
    description: "报名、RaceProject、CAConnection、CA Signal 和 Work 提交。"
  },
  {
    key: "judge",
    title: "Judge",
    href: "/api/debug/login?user=judge",
    description: "查看分配作品并进入 Judge View 提交评分和评语。"
  }
];

export default function DebugLoginPage() {
  return (
    <section className="route-page debug-login-page">
      <section className="hero-copy debug-login-hero">
        <p className="section-kicker">Local Development</p>
        <h1>Debug Role Login</h1>
        <p className="hero-subtitle">仅用于本地调试 seed 用户角色。需要设置 ENABLE_DEBUG_LOGIN=true。</p>
      </section>

      <section className="work-grid debug-login-grid">
        {debugUsers.map((user) => (
          <article className="work-card debug-role-card" key={user.key}>
            <span>debug user</span>
            <h2>{user.title}</h2>
            <p>{user.description}</p>
            <Link href={user.href}>以 {user.title} 登录</Link>
          </article>
        ))}
      </section>
    </section>
  );
}
