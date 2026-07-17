import Link from "next/link";
import styles from "./CooperationPage.module.css";

const entries = [
  { label: "Rider", icon: "01", title: "报名参赛", body: "进入公开 Race Page，确认报名窗口与参赛规则，并以 Rider 身份完成报名。", href: "/" },
  { label: "Organizer", icon: "02", title: "发起赛事", body: "从 Workspace 创建 Race，管理报名、作品、评审、榜单和赛后报告。", href: "/console" },
  { label: "Sponsor", icon: "03", title: "赞助合作", body: "围绕赛题、现场大屏、奖项和复盘报告建立有明确资产出口的合作。", href: "/races/bay-area-happy-trip" },
  { label: "Partner", icon: "04", title: "联合办赛", body: "用 ARY 的 Race、Works、Results 和 Review 结构承载课程、训练营和主题活动。", href: "/console" }
];

export default function CooperationPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="cooperation-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>ARY Cooperation</p>
          <h1 id="cooperation-title">报名、办赛、赞助和合作</h1>
          <p>把一次 Agent Racing 变成可观看的过程、可传播的作品和可复用的能力资产。选择你的身份，进入对应的公开页面或 Workspace。</p>
        </div>
        <div className={styles.heroArt} aria-hidden="true"><span className={styles.orbit} /></div>
      </section>

      <section className={styles.grid} aria-label="合作入口">
        {entries.map((entry) => (
          <article className={styles.card} key={entry.label}>
            <span className={styles.icon}>{entry.icon}</span>
            <span className={styles.label}>{entry.label}</span>
            <h2>{entry.title}</h2>
            <p>{entry.body}</p>
            <Link href={entry.href}>进入</Link>
          </article>
        ))}
      </section>

      <section className={styles.story}>
        <article className={styles.storyCard}>
          <p className={styles.eyebrow}>Agent Riding Skill</p>
          <h2>让能力有证据</h2>
          <p>ARY 不只记录报名、提交与排名，还关注 Rider 如何使用 Agent、怎样控制进度与成本、如何识别风险并完成纠偏。</p>
        </article>
        <article className={styles.storyCard}>
          <p className={styles.eyebrow}>Co-build a Race</p>
          <h2>从赛题到复盘的完整资产链</h2>
          <p>合作方可以围绕真实问题发起 Race，并通过公开赛况、作品、Results 与 Review 看见完整成果。</p>
          <div className={styles.steps}>
            <div className={styles.step}><strong>01 · 定义赛题</strong><span>明确挑战、规则与公开范围。</span></div>
            <div className={styles.step}><strong>02 · 运行赛事</strong><span>通过 Live Hall 观看过程信号。</span></div>
            <div className={styles.step}><strong>03 · 沉淀资产</strong><span>发布 Works、Results 与 Review。</span></div>
          </div>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/">浏览公开 Race</Link>
            <Link className={styles.secondary} href="/console">进入 Workspace</Link>
          </div>
        </article>
      </section>
    </main>
  );
}
