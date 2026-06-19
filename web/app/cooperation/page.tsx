import Link from "next/link";

const entries = [
  ["Rider", "报名参赛", "进入 Race Page，选择正在开放的赛道并提交报名。", "/"],
  ["Organizer", "发起赛事", "从 Workspace 管理报名、作品、评审、榜单和报告。", "/console"],
  ["Sponsor", "赞助合作", "围绕赛题、现场大屏、奖项和复盘报告建立合作。", "/races/bay-area-happy-trip"],
  ["Partner", "联合办赛", "用 ARY 的 Race、Works、Results 和 Review 结构承载主题活动。", "/console"]
];

export default function CooperationPage() {
  return (
    <section className="route-page">
      <section className="module-title route-hero">
        <p className="section-kicker">Cooperation</p>
        <h1>报名、办赛、赞助和合作</h1>
        <p className="module-summary">公开转化入口保持简洁，具体执行进入 Race Page 或 Workspace。</p>
      </section>
      <section className="cooperation-grid">
        {entries.map(([label, title, body, href]) => (
          <article className="glass-card" key={label}>
            <span>{label}</span>
            <h2>{title}</h2>
            <p>{body}</p>
            <Link className="inline-action" href={href}>进入</Link>
          </article>
        ))}
      </section>
    </section>
  );
}
