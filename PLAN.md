# PLAN

本文是 ARY 近期任务窗口，记录近期要推进的任务和里程碑。长期任务定义见 `docs/ary.plan.md`；任务瞬时状态见 `STATUS.md`。

## 近期窗口

| 窗口 | 目标 |
| --- | --- |
| DEV-1到OPS-1本地MVP交付收口 | 已输出DEV-1到DEV-3架构/原型交付；根目录旧 `app/` 静态 MVP 已删除，DEV-4到DEV-7、REL-1和OPS-1的当前可运行闭环由 `web/` 承接。 |
| 正式工程化准备 | 服务端鉴权、PostgreSQL migration、OAuth安全边界和CA签名接入代码已补齐；下一阶段以真实凭证、托管基础设施、部署流水线和赛事彩排证据为主。 |
| WEB-1正式集成应用 | `web/` 以 Next.js + Prisma 承接正式应用；production schema 已切换 PostgreSQL，SQLite 仅保留本地 / E2E；DEV-2/DEV-3高保真页面闭环已迁入，`design-prototype/` 保留归档。 |
| SEC-1真实赛事安全基线 | 代码级整改已完成：生产 PostgreSQL migration、可撤销随机会话、OAuth state、Public DTO、CA HMAC / 防重放、安全头与生产配置门禁；真实 go-live 仍需 TLS、托管数据库、备份恢复、WAF / 限流、监控和 staging 彩排证据。 |

## 近期任务

| 任务 | 目标 | 下一入口 |
| --- | --- | --- |
| `PRD-1` 文档基线与范围确认 | `PRD-TEMP-1` 已并入正式基线；报名、RaceProject、CAConnection 和评审前风险提示口径可作为架构输入。 | `docs/ary.plan.md` |
| `UX-1 收尾 v2` 设计原型细节态深化 + 移动端审计 | 已完成：Race Page in_progress 详情态（leaderboard + event-stream）+ Work Page Judge 视角评审态（5 hooks + renderWorkJudge）+ 旧静态 MVP 移动端审计 0 P0 + 5 P1 + 4 P2。 | `design-prototype/ary-v0.4-race-detail.png`、`design-prototype/ary-v0.4-work-judge.png`、`docs/ary-mobile-ux-review.md` |
| `PRD-TEMP-1` 报名 / RaceProject / CA 参赛语义整改 | 已完成并入：PRD、领域、CA 契约、IA、UX / 高保真原型、权限、QA、OPS 和计划文档已同步新口径。 | `docs/registration-ca-rules-alignment.taskbook.md` |
| `UX-1` UX/UI 高保真原型与设计基线 | 第一轮 IA 对齐版 1080P 高密度高保真原型已验收通过，作为 `M2` 架构设计输入；后续页面按高保真页面工作流继续深化。 | `docs/ux-hifi.taskbook.md`、`.agents/skills/hifi-ui-page-workflow/SKILL.md`、`design-prototype/index.html` |
| `DEV-1` 领域模型 + 权限 + 数据模型 | 已完成：输出聚合边界、逻辑数据模型草案、接口鉴权规则、领域事件和验收记录。 | `docs/ary-dev-1-dev-3-delivery.md` |
| `DEV-2` Public Site 静态闭环 | 已完成：Home、Race Page、Live Hall、Works、Work Page、Results、Review、Rider Profile、Cooperation可用样例数据走查。 | `design-prototype/index.html`、`design-prototype/README.md` |
| `DEV-3` 登录 / 角色 / Race Console | 已完成：模拟GitHub登录、资料补全、角色入口、Organizer/Rider/Judge/Admin视图和Admin角色维护演示。 | `design-prototype/index.html`、`docs/ary-dev-1-dev-3-delivery.md` |
| `DEV-4` 报名 / RaceProject / Work / Judge 结构流程 | 已完成并迁入 `web/`：Race发布、报名审核、RaceProject幂等生成、Work提交、JudgeAssignment和JudgingRecord可运行并有领域测试。 | `web/app/console/page.tsx`、`web/lib/domain.ts`、`web/tests/domain.test.ts`、`docs/ary-dev-4-to-ops-delivery.md` |
| `DEV-5` CA 接入 / Projection / Live Hall | 已完成并迁入 `web/`：CAConnection登记握手、OCR Desktop App / connector attestation、防伪签名校验、非法信号隔离、ReviewFlag、Projection生成和失败隔离、Live Hall稳定读取。 | `web/lib/domain.ts`、`web/tests/domain.test.ts`、`docs/ary-ca-integration-spec.md` |
| `DEV-6` Screen Console / 大屏联调 | 已完成并迁入 `web/`：live、leaderboard、works、announcement和fallback模式可切换。 | `web/app/screen/page.tsx`、`web/app/screen/display/page.tsx` |
| `DEV-7` Report / Review / Results | 已完成并迁入 `web/`：Award/Leaderboard发布、Report生成/失败/编辑/发布、Results/Review/Public Works联动。 | `web/lib/domain.ts`、`web/tests/domain.test.ts`、`web/app/races/[slug]/results/page.tsx` |
| `REL-1` 赛事彩排 / 灰度发布 / 正式发布 | 已完成本地演练入口并迁入 `web/`：P0回归、发布检查项和go/no-go证据记录；真实staging/production发布待正式工程化。 | `web/app/ops/page.tsx`、`web/tests/domain.test.ts`、`docs/ary-release-ops-plan.md` |
| `OPS-1` 赛事值守 / 回滚 / 赛后归档 | 已完成运维入口并迁入 `web/`：备份、事故、fallback、归档记录；真实值守和回滚待生产环境接入。 | `web/app/ops/page.tsx`、`web/lib/domain.ts`、`docs/ary-release-ops-plan.md` |
| `WEB-1` 高保真前端 + 服务端领域动作正式集成 | 已迁入DEV-2/DEV-3页面闭环：Public Home/Race/Live/Works/Work/Results/Review/Rider/Cooperation、Profile Completion、Organizer/Rider/Judge/Admin Console入口，并接入Prisma数据、安全OAuth / Debug Login边界、Server Actions和领域测试。 | `web/README.md`、`web/app/`、`web/lib/queries.ts`、`web/lib/domain.ts`、`web/tests/domain.test.ts` |
| `WEB-1 角色数据流与调试能力修正` | 已完成：Console 改为 Race-scoped，Debug Login 支持角色隔离，Award/Work/Results 公共边界和 Screen Console 权限已收口，Judge 提交有保存反馈。 | `docs/ary-role-flow-playwright-audit.md`、`web/app/console/page.tsx`、`web/lib/queries.ts`、`web/tests/domain.test.ts` |
| `WEB-1 Judge / Public / Screen E2E` | 已完成：新增 6 个可重复 Playwright 场景，覆盖 Judge 未授权隔离与评审持久化、Public 主路径与 review-only 边界、Screen 只读权限、模式同步和 fallback；使用独立 `prisma/e2e.db`。 | `web/playwright.config.ts`、`web/e2e/`、`web/scripts/e2e-prepare.mjs`、`web/README.md` |
| `WEB-1 Rider / Organizer / Admin E2E + CI` | 已完成：补齐 Rider CA/Work、Organizer Race 创建发布、Admin User.roles 持久化，Playwright 全量 9/9 通过；新增 GitHub Actions 静态/领域/构建与浏览器双 Job。 | `web/e2e/rider.spec.ts`、`web/e2e/organizer.spec.ts`、`web/e2e/admin.spec.ts`、`.github/workflows/web-ci.yml` |
| `WEB-1 E2E / CI 阶段总结与 Riding Record` | 已完成：形成修改范围、意义、验证与边界总结，并以第一人称记录项目理解、任务引导、关键决策和 Agent 指挥过程。 | `docs/ary-web-e2e-ci-change-summary.md`、`riding_records/ARY_WEB_E2E_CI_Riding_Record_2026-07-13.md` |
| `SEC-1` 真实赛事安全与生产就绪基线 | 已完成代码级安全整改和自动化证据；部署环境硬门禁待实际基础设施接入后验收，未满足前必须 no-go。 | `docs/ary-production-security-baseline.md`、`web/lib/auth.ts`、`web/lib/ca-attestation.ts`、`web/e2e/security.spec.ts` |

## 近期里程碑

| 里程碑 | 完成口径 |
| --- | --- |
| `M1` 文档基线可作为架构入口 | PRD、领域、IA、权限、QA、计划、OPS、CA 草案无高优先级冲突。 |
| `M2` 架构设计输入就绪 | DEV-1已输出领域边界、权限规则和数据模型草案；UX/UI原型已覆盖DEV-2/DEV-3关键页面状态；DEV-4到OPS-1本地MVP已提供可迁移的领域动作和验收测试。 |
| `M3` 本地MVP闭环可演示 | `web/` 可启动并运行领域回归与浏览器 E2E，覆盖报名、CA、Projection、大屏、报告、发布检查和运维归档；`web/tests/domain.test.ts` 与 `web/e2e/` 提供当前自动化证据。 |

## 下一步

1. 按 `docs/ary-production-security-baseline.md` 建立托管 PostgreSQL、TLS ingress、secret manager、WAF / 限流、集中日志和监控。
2. 配置真实 GitHub OAuth App，在 staging 验证 state、登录、过期、Logout 和角色变化后的会话策略。
3. 接入真实 CAConnector 凭证交付、轮换 / 吊销和 HTTP snapshot fetch，并完成篡改、过期与重放演练。
4. 在全角色 / Public / Screen / Security 13 个 E2E 基础上补负载、弱网、备份恢复、P0 和回滚彩排证据。
5. 所有真实赛事硬门禁通过后再执行 production go/no-go；任一缺失保持 no-go。

## 执行纪律

* 开工前读取对应任务在 `docs/ary.plan.md` 中的定义。
* 近期窗口变化时更新本文；任务状态变化时更新 `STATUS.md`。
