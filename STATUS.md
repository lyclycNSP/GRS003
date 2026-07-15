# STATUS

本文是 ARY 任务瞬时看板，记录当前任务状态、证据和风险。不记录历史流水。

## 当前结论

* 项目处于MVP文档基线完成、DEV-1到OPS-1本地MVP交付完成阶段。
* 业务文档已集中到 `docs/` 下。
* 当前正式项目任务定义入口是 `docs/ary.plan.md`。
* `PRD-TEMP-1` 已完成并入，报名、RaceProject 自动生成、CAConnection 动态接入和评审前风险提示的新口径已进入 `PRD-1` 正式基线。
* `UX-1` 第一轮高保真原型已验收通过，可作为 `M2` 架构设计输入。
* `DEV-1`已输出聚合边界、数据模型草案和接口鉴权规则；`DEV-2`和`DEV-3`已补齐静态高保真可走查闭环。
* `DEV-4`到`DEV-7`、`REL-1`和`OPS-1`已迁入`web/`正式集成应用，覆盖报名、RaceProject、Work、Judge、CA、Projection、Screen、Report、Results、发布检查、备份、事故和归档闭环；根目录旧 `app/` 静态 MVP 已删除。
* `web/tests/domain.test.ts`已提供关键领域回归测试；当前已补充 CA 防伪 / 防篡改 attestation 用例，缺少 OCR Desktop App / connector 认证声明的信号会被隔离。
* `SEC-1` 代码级安全基线已完成：production Prisma datasource / migration 已切换 PostgreSQL；SQLite 仅保留本地和 E2E；会话、OAuth state、Public DTO、CA HMAC / 防重放、安全头和配置门禁已有自动化证据。本轮已封闭匿名 / 无关角色对 Ops 数据的读取，并将 Organizer 授权改为精确 ID 匹配。
* Racer 作品提交完整性代码基线已实现：只有 approved Registration 本人可提交不可变版本，服务端固定 GitHub Repo / commit SHA / canonical hash；窗口冻结后 JudgeAssignment、Work 发布和关联 Award 绑定明确版本。CA 证据安全与作品提交完整性是两套独立控制。
* Race Live 已迁入同一 ARY 应用：同一 Round 按每组最多 8 名 Racer 自动轮播，Organizer 控制、Admin 跨 Race 带原因、公开 allowlist DTO、稳定 Projection、Track Runtime 和控制审计均已实现；独立 16:9 页面包含 Header、TOP3、KPI、Mini Map、真实马匹赛道、风险 Ticker 和 Footer。Coach/Cockpit 不进入 ARY。
* Track Calibrator 核心工具链已迁入同一 ARY 应用：主 Console 可发现入口；浏览器 IndexedDB 保存未发布 Draft/背景/自动与人工校验，支持导入导出、撤销重做、反向、Inspector 和共享 Runtime 预览；服务端重新鉴权、校验 MIME/尺寸/checksum/几何并要求 8 项人工核验，发布幂等不可变版本。被 Round 引用的版本不能归档，只有未引用 archived 版本可删除。
* 当前尚未取得生产 TLS、托管 PostgreSQL、真实 OAuth App、正式 CA 凭证、备份恢复、WAF / 限流、监控和 staging 彩排证据；按真实赛事 go-live 口径仍为 no-go。
* 已新增`web/`正式集成应用入口：Next.js App Router、Prisma、SQLite、GitHub OAuth路由、服务端权限上下文、Public API和Console/Ops服务端动作；DEV-2/DEV-3高保真页面闭环已迁入正式应用。
* `web/` 已完成角色数据流修正：Console 按 Race 取数，Debug Login 可隔离 Organizer/Admin/Rider/Judge，Screen Console 对非管理者只读，非公开 Work 不再公开详情，Judge 提交后有保存反馈。
* `web/e2e/` 已新增 Judge、Public、Screen 三组 6 个 Playwright 场景并全部通过；E2E 使用独立 `prisma/e2e.db`，同时补齐 Judge 页面按 assignment 服务端授权。
* 全角色、Public、Security、Race Live 与 Track Calibrator E2E 已补齐并全量 20/20 通过；完整领域/契约测试、静态烟测、TypeScript 和 production build 同步通过。本次未改 Prisma schema，沿用既有 PostgreSQL migration deploy 证据。
* `DEV-8` 风险评审中心已在 `web/` 落地：ReviewFlag 新增处置说明 / 处理人 / 更新时间，风险按状态与严重度排序，提供优先级摘要和快速筛选；Organizer 可筛选并处理风险，Rider 只看本人整改项，Judge 可在评审上下文中看到未解决风险和处置记录。
* `docs/ary-risk-center.md` 已落盘，作为风险评审中心的专题说明和后续合并入口。
* 本阶段修改说明和 Riding Record 已落盘，分别承接工程变更事实与第一人称理解、引导、决策和指挥过程。
* `PLAN.md` 已从旧阶段完成清单收缩为正式工程化近期窗口；当前 P0 聚焦正式任务立项、真实 GitHub OAuth / 生产会话闭环和 Hosted CI 首次验证。
* `web/` 本轮已完成 Rider 团队参赛功能：Rider 可创建团队、用邀请码加入团队、由队长提交团队报名；团队报名审核后生成 RaceProject，团队成员可接入各自 CAConnection，团队 Work 由队长提交。

## 任务看板

| 任务 | 状态 | 当前判断 | 证据 / 下一入口 |
| --- | --- | --- | --- |
| `PRD-1` 文档基线与范围确认 | 进行中 | `PRD-TEMP-1`新口径已并入，当前基线已支撑`DEV-1`到`OPS-1`本地MVP交付；后续进入正式工程化时继续校验生产边界。 | `docs/README.md`、`docs/ary.plan.md`、`docs/registration-ca-rules-alignment.taskbook.md`、`docs/ary-dev-1-dev-3-delivery.md`、`docs/ary-dev-4-to-ops-delivery.md` |
| `PRD-TEMP-1` 报名 / RaceProject / CA 参赛语义整改 | 已并入 | Registration approved 自动生成 RaceProject、参赛中可新增 CAConnection、CA 接入异常进入评审前风险提示而非硬门禁的新口径已并入正式 `PRD-1` 基线。 | `docs/registration-ca-rules-alignment.taskbook.md`、`docs/ary-mvp.prd.md`、`docs/ary-domain-analysis.v0.3.md`、`design-prototype/` |
| `UX-1` UX/UI 高保真原型与设计基线 | 验收通过 | 高保真原型已按IA重构为1080P高密度蓝白竞赛风格页面，并接入样例赛事数据驱动主要页面；本轮继续补齐Work Page、Login/Profile和Console多角色视图，可支撑`DEV-2`/`DEV-3`静态演示。 | `docs/ux-hifi.taskbook.md`、`design-prototype/index.html`、`design-prototype/README.md` |
| `DEV-1` 领域模型 + 权限 + 数据模型 | 已交付 | 已输出聚合边界、数据模型草案、接口鉴权规则、关键领域事件和验收记录；ReviewFlag采用本轮实现命名，ReviewReadinessCheck作为检查流程命名。 | `docs/ary-dev-1-dev-3-delivery.md`、`docs/ary-domain-analysis.v0.3.md`、`docs/ary-permission-matrix.md`、`docs/ary-mvp.ia.md` |
| `DEV-2` Public Site 静态闭环 | 已交付 | 公开端已覆盖Home、Race Page、Live Hall、Works、Work Page、Results、Review、Rider Profile、Cooperation；公众浏览路径可用mock/样例数据走查。 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| `DEV-3` 登录 / 角色 / Race Console | 已交付 | 已补齐模拟GitHub登录、资料补全、Workspace入口、Organizer/Rider/Judge/Admin视图切换、Admin用户资料状态和`User.roles`维护演示。 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`docs/ary-dev-1-dev-3-delivery.md` |
| `DEV-4` 报名 / RaceProject / Work / Judge 结构流程 | 已交付并迁入 `web/` | `web/` 已实现Race发布、报名、审核、RaceProject幂等生成、Work提交、JudgeAssignment和JudgingRecord结构流程，并覆盖重复报名和幂等测试。 | `web/app/console/page.tsx`、`web/lib/domain.ts`、`web/tests/domain.test.ts`、`docs/ary-dev-4-to-ops-delivery.md` |
| `DEV-5` CA 接入 / Projection / Live Hall | 已交付并迁入 `web/` | `web/` 已实现CAConnection登记与握手、OCR Desktop App / connector attestation、防伪签名校验、伪造/篡改信号隔离、接入失败ReviewFlag、Projection生成和失败隔离；CA失败不阻断提交、评审和Award。 | `web/lib/domain.ts`、`web/tests/domain.test.ts`、`docs/ary-ca-integration-spec.md` |
| `DEV-6` Screen Console / 大屏联调 | 已交付并迁入 `web/` | `web/` 已实现live、leaderboard、works、announcement、fallback模式切换，fallback读取稳定Projection或静态展示。 | `web/app/screen/page.tsx`、`web/app/screen/display/page.tsx` |
| `DEV-7` Report / Review / Results | 已交付并迁入 `web/` | `web/` 已实现Award/Leaderboard发布、Report生成失败记录、重跑/编辑/发布，以及Public Results/Review/Works公开读取边界。 | `web/lib/domain.ts`、`web/tests/domain.test.ts`、`web/app/races/[slug]/results/page.tsx` |
| `REL-1` 赛事彩排 / 灰度发布 / 正式发布 | 已交付并迁入 `web/` | 已提供P0回归、发布检查项和go/no-go证据记录；真实staging/production灰度和正式发布待基础设施接入。 | `web/app/ops/page.tsx`、`web/tests/domain.test.ts`、`docs/ary-release-ops-plan.md` |
| `OPS-1` 赛事值守 / 回滚 / 赛后归档 | 已交付并迁入 `web/` | 已提供备份记录、事故记录、fallback记录和赛后归档入口；真实值守、回滚和生产归档待部署环境接入。 | `web/app/ops/page.tsx`、`web/lib/domain.ts`、`docs/ary-release-ops-plan.md` |
| `WEB-1` 高保真前端 + 服务端领域动作正式集成 | DEV-2/DEV-3已迁入 | `web/`已建立Next.js全栈工程，迁入Public Home/Race/Live/Works/Work/Results/Review/Rider/Cooperation、Profile Completion、Organizer/Rider/Judge/Admin Console入口，并接入Prisma/SQLite、OAuth fallback、服务端领域动作、Public API和领域测试。 | `web/README.md`、`web/app/`、`web/lib/queries.ts`、`web/lib/domain.ts`、`web/tests/domain.test.ts` |
| `WEB-1 角色数据流与角色隔离修正` | 已完成 | Playwright 审计发现的 Race 数据串流、角色隔离、Screen 控制台未授权入口、非公开 Work 详情暴露、Judge 提交无反馈和 seed 跨 Race Award 已修正。 | `docs/ary-role-flow-playwright-audit.md`、`web/app/console/page.tsx`、`web/lib/queries.ts`、`web/lib/domain.ts`、`web/tests/domain.test.ts` |
| `WEB-1 Judge / Public / Screen E2E` | 已完成 | 6 个 Playwright 场景覆盖 Judge 未授权 404、分配作品评审与持久化、Public Gallery/Live/Works/Results/Review、review-only 页面/API 隔离、Screen 只读权限、模式同步和 fallback。 | `web/playwright.config.ts`、`web/e2e/`、`web/scripts/e2e-prepare.mjs`、`web/README.md` |
| `WEB-1 Rider / Organizer / Admin E2E + CI` | 已完成 | Rider 验证 CA Signal 与 Work 持久化，Organizer 验证 Race 创建/切换/发布及公共 API，Admin 验证 User.roles 持久化并恢复 Seed；CI 双 Job 已落盘。 | `web/e2e/rider.spec.ts`、`web/e2e/organizer.spec.ts`、`web/e2e/admin.spec.ts`、`.github/workflows/web-ci.yml` |
| `WEB-1 E2E / CI 阶段总结与 Riding Record` | 已完成 | 修改说明覆盖内容、范围、意义、验证和未完成边界；Riding Record 展示第一人称项目理解、引导、关键决策和 Agent 指挥。 | `docs/ary-web-e2e-ci-change-summary.md`、`riding_records/ARY_WEB_E2E_CI_Riding_Record_2026-07-13.md` |
| `SEC-1` 真实赛事安全与生产就绪基线 | 代码完成 / 环境待验收 | 已修复 OAuth fallback / state、裸 userId Cookie、公开 API 过量披露、Ops 未授权读取、Organizer 子串授权和 dev-signature；新增 PostgreSQL baseline migration、HMAC 防重放 CA API、安全响应头、production preflight 和 Security E2E。真实赛事需完成外部硬门禁后才能 go-live。 | `docs/ary-production-security-baseline.md`、`web/lib/auth.ts`、`web/app/ops/page.tsx`、`web/e2e/security.spec.ts` |
| `SEC-WORK-1` Racer 作品提交完整性基线 | 本地完成 / staging 待验收 | 不可变 v1/v2、输入/URL 策略、UTC 窗口、全场冻结/Admin 受限重开、审计事件、Judge/Award/Public 版本绑定及 legacy 兼容已实现；本地完整质量门与 PostgreSQL 16 全新库/已有基线升级已验证。 | `web/lib/work-submission.ts`、`web/lib/domain.ts`、`web/prisma/migrations/20260714_work_submission_integrity/`、`web/tests/work-submission*.test.ts`、`web/e2e/rider.spec.ts` |
| `WEB-2 Rider 团队参赛功能` | 已完成 | 新增 Team / TeamMember / participantType / CAConnection.ownerUserId 数据口径；Rider View 支持创建团队、邀请码加入、提交团队报名和团队状态查看；团队成员可登记 CAConnection，队长统一提交团队 Work；领域测试已覆盖完整团队参赛链路。 | `web/prisma/schema.prisma`、`web/app/console/page.tsx`、`web/lib/domain.ts`、`web/lib/queries.ts`、`web/tests/domain.test.ts` |
| `RACE-LIVE-1` GRS002 大屏能力迁入 | 已完成 | Race Live 使用 ARY Projection 和 TrackProfileVersion，同一 Round 自动分组轮播；公开 DTO、fallback、控制状态和独立 16:9 五层信息输出均已完成。 | `web/lib/race-live/`、`web/app/screen/`、`web/e2e/screen-race-live.spec.ts` |
| `TRACK-CAL-1` Track Calibrator 迁入 | 已完成 | Console 入口、IndexedDB Draft 导入导出、编辑历史、共享 Runtime 预览、自动/人工核验、服务端不可变发布、Round 绑定和引用保护生命周期均已完成。 | `web/lib/track-calibrator/`、`web/lib/track-assets/`、`web/app/console/tracks/`、`web/e2e/track-calibrator.spec.ts` |
| `DEV-8 风险评审中心` | 已完成 | ReviewFlag 已形成可处置对象，具备优先级摘要、快速筛选、时间/来源上下文和 Judge 只读风险回流；当前包含 Organizer 处置席、Rider 整改席、Judge 风险上下文、状态机和审计字段，并已形成专题文档承接后续合并。 | `web/app/console/risk-center/page.tsx`、`web/lib/domain.ts`、`web/lib/queries.ts`、`web/tests/domain.test.ts`、`docs/ary.plan.md`、`docs/ary-risk-center.md` |

## 证据索引

| 结论 | 证据 |
| --- | --- |
| 文档集合存在且已集中到 `docs/` | `docs/*.md` |
| 长期任务定义入口为 `docs/ary.plan.md` | `docs/ary.plan.md` |
| 近期窗口入口为 `PLAN.md` | `PLAN.md` |
| CA 接入契约已形成原始骑行状态消息草案，仍需继续讨论完善 | `docs/ary-ca-integration-spec.md` |
| 报名 / RaceProject / CA 参赛语义整改已完成并入 | `docs/registration-ca-rules-alignment.taskbook.md` |
| 当前仓库包含设计原型 | `design-prototype/` |
| UX/UI 高保真原型已验收通过并作为 `M2` 架构设计输入 | `PLAN.md`、`docs/ary.plan.md`、`docs/ux-hifi.taskbook.md`、`design-prototype/README.md` |
| UX-1 高保真原型已按 IA 和 1080P 视口修订并通过本地截图验证 | `design-prototype/index.html`、`design-prototype/*.png` |
| UX-1 样例赛事数据已生成并接入原型渲染，用于支撑 IA 页面密度和状态差异 | `design-prototype/data/sample-races.json`、`design-prototype/data/sample-races.js`、`design-prototype/script.js` |
| UX-1 页面可见文案已去除 PRD、需求说明和实现术语口吻 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/data/sample-races.json`、`design-prototype/README.md` |
| UX-1 二级页面口号式大标题已降级为对象名和状态摘要 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 本轮 IA 整改已完成：公开导航边界、Home Gallery 模块、单场 Results、Works 筛选/详情入口、Race Riders 入口、Review 下一场、Rider 能力证据、Screen 输出/控制边界，且静态兜底与动态渲染一致 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 首页 IA 复审标准已落地：顶层导航不放 Race 子页面，CTA 依附具体 Race / 作品 / 合作场景，首页不设置独立 Leaderboards 模块 | `docs/ary-mvp.ia.md`、`design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/README.md` |
| UX-1 外审意见已落实：Hero 直接承载 Featured Race 信息，Latest Results / Past Races 去重，Next Entry 改为开放报名 / 合作入口，Header 按未登录态只显示 Login | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 首页 Leaderboards 已撤销：Live Skill Board 从首页移除，过程榜保留在 Live Hall，最终榜保留在 Results | `docs/ary-mvp.ia.md`、`docs/ary-mvp.prd.md`、`docs/ux-hifi.taskbook.md`、`design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 首页视觉复审已处理：右侧首卡从重复 Race Card 改为 Open Registration，首页 page-label 横线已隐藏，避免与 Public Header 分隔线冲突 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 首页 Live Now 结构已修正：独立 Live Now 框已撤销，Hero / Featured Races 直接支持 live Race 切换 | `docs/ary-mvp.ia.md`、`docs/ux-hifi.taskbook.md`、`design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/README.md` |
| UX-1 首页 title 层级已修正：不在顶部额外强调 Series / Gallery title，当前 Live Race title 居中成为首屏主标题，下划线式 Live Race 切换器位于标题下方，赛题位于切换器下方 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 品牌区 logo 已修正：使用 ico 原图展示，移除额外圆形套框、描边和外圈光晕 | `design-prototype/index.html`、`design-prototype/styles.css` |
| UX-1 首页布局节奏已调整：Header 更轻，Hero 信息组上移并压缩，赛道视觉下沉，作品 / Rider 卡缩高并落在赛道下缘，右侧信息栈与主 Hero 保持错落间距 | `design-prototype/styles.css` |
| UX-1 首页 Live Race 切换器已简化：取消重复赛事文字，只保留下划线式选择指示，并加入自动轮播切换 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 首页 Live Race 未激活切换线已增强为浅蓝可见状态，active 状态仍保持深蓝加长 | `design-prototype/styles.css` |
| UX-1 右侧信息卡头部状态标签已降噪：从高饱和蓝色实心 pill 改为浅蓝描边淡底标签，避免抢主 Hero 注意力 | `design-prototype/styles.css` |
| UX-1 首页赛道 Riding Signal 角标已移到赛道容器左上，避免与轨迹节点产生关系误读 | `design-prototype/script.js` |
| UX-1 首页右侧辅助信息已改为 Drawer：默认只露出窄 Rail，点击后从右侧滑出 Open Registration、Latest Results、Past Races 和 Cooperation 四个模块 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 首页 Live Title 已按 Drawer 默认收起态重新居中，Hero 信息组与赛道主画布中轴对齐 | `design-prototype/styles.css` |
| UX-1 品牌区 logo 已替换为马头罗盘 PNG，生成透明底裁切版并按竖向比例调整 Header 图标容器 | `design-prototype/assets/logo-horse-compass-transparent.png`、`design-prototype/index.html`、`design-prototype/styles.css` |
| UX-1 首页设计与交互短视频已录制，覆盖默认首页、Live Race 切换、右侧 Drawer 打开 / 收起，并内嵌字幕说明 | `design-prototype/recordings/ary-homepage-demo.mp4` |
| UX-1 首页整改经验已沉淀为通用高保真页面工作流 Skill，并在任务书和原型 README 中引用；后续页面需先审 IA、补领域样例数据、复用已通过页面视觉 / 交互惯例，再浏览器复审 | `.agents/skills/hifi-ui-page-workflow/SKILL.md`、`docs/ux-hifi.taskbook.md`、`design-prototype/README.md` |
| DEV-1到DEV-3交付记录已落盘，覆盖聚合边界、数据模型草案、接口鉴权规则、静态闭环演示和验收用例 | `docs/ary-dev-1-dev-3-delivery.md` |
| DEV-2公开端静态闭环已补齐Work Page，Works卡片可进入作品详情，Work Page展示Demo/Repo、Evidence摘要、Race回链和原始CA Session默认不公开边界 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| DEV-3登录/角色/Race Console静态演示已补齐，包含mock GitHub登录、资料补全、Console入口、Organizer/Rider/Judge/Admin视图切换和Admin角色chip维护 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| DEV-2/DEV-3原型脚本通过Node语法检查 | `node --check design-prototype/script.js` |
| DEV-4到OPS-1本地MVP应用已新增，覆盖后续任务的可运行闭环 | `app/index.html`、`app/domain.js`、`app/app.js`、`app/styles.css`、`app/README.md` |
| DEV-4到OPS-1交付记录已落盘，包含实现范围、验收测试、未完成项和后续工程化判断 | `docs/ary-dev-4-to-ops-delivery.md` |
| DEV-4报名/RaceProject/Work/Judge关键不变量通过领域测试 | `node app/domain.test.js` |
| DEV-5 CA合法/非法接入、防伪 attestation 隔离、失败不阻断、Projection失败隔离通过领域测试 | `node app/domain.test.js` |
| DEV-7 Report公开边界和REL/OPS P0回归通过领域测试 | `node app/domain.test.js` |
| 本地MVP应用脚本通过Node语法检查 | `node --check app/domain.js`、`node --check app/app.js` |
| `app/domain.test.js` 10 个用例 ↔ 任务 ↔ 代码动作 ↔ 文档证据 映射清晰 | 见下方"领域测试映射表" |
| UX-1 收尾 v2 已完成：Race Page in_progress 详情态（leaderboard + event-stream 两张 glass-card 子面板）、Work Page Judge 视角评审态（5 work-judge hooks + renderWorkJudge() + .assigned-work-card span 副作用修复）、`app/` 移动端 UX 静态审计（0 P0 + 5 P1 + 4 P2）三件事一并交付 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/ary-v0.4-race-detail.png`、`design-prototype/ary-v0.4-work-judge.png`、`docs/ary-mobile-ux-review.md` |
| UX-1 收尾 v2 Race Page in_progress 详情态通过 Node 语法检查 | `node --check design-prototype/script.js`（绝对路径） |
| UX-1 收尾 v2 Work Page Judge 视角通过 Node 语法检查 | `node --check design-prototype/script.js`（绝对路径） |
| UX-1 收尾 v2 移动端 UX 静态审计未修改任何 `app/` 或 `design-prototype/` 源代码 | `docs/ary-mobile-ux-review.md`、`app/` `git diff` 为空、`design-prototype/` 仅 t2a/t2b 任务相关改动 |
| WEB-1 已继承 DEV-2/DEV-3 页面闭环：Public Home/Race/Live/Works/Work/Results/Review/Rider/Cooperation、Profile Completion、Organizer/Rider/Judge/Admin Console入口均在 Next.js 应用中渲染并接入服务端数据/动作 | `web/app/`、`web/lib/queries.ts`、`web/lib/domain.ts`、`web/tests/domain.test.ts`、`web/README.md` |
| WEB-1 验证通过：TypeScript、9个领域测试、Next build、本地浏览器烟测均通过 | `cd web && tsc --noEmit`、`python scripts/init-sqlite.py`、`tsx prisma/seed.ts`、`tsx tests/domain.test.ts`、`next build`、`http://127.0.0.1:3000` |
| WEB-1 角色数据流修正已验证：新增领域回归、静态烟测、TypeScript、Next build 和 Playwright 角色流检查均通过；`pnpm test` 在本机触发 pnpm build-script approval，改用本地 `tsx.cmd` 直接执行测试入口 | `web/tests/domain.test.ts`、`web/scripts/static-smoke.mjs`、`web/app/console/page.tsx`、`web/app/screen/page.tsx`、`web/app/works/[slug]/judge/page.tsx` |
| WEB-2 Rider 团队参赛已验证：团队创建、邀请码加入、阻止重复个人报名、队长提交团队报名、审核生成 RaceProject、队员登记 CAConnection、队员不能提交团队 Work、队长可提交团队 Work | `DATABASE_URL=file:./dev.db npm run test`、`web/tests/domain.test.ts` |
| WEB-1 Work Detail 视觉修正已完成：作品详情页补齐按钮入口，统一链接按钮样式，收紧中英文混排和长 URL 换行，并通过桌面/移动 Playwright 截图验证无重叠 | `web/app/works/[slug]/page.tsx`、`web/app/globals.css` |
| WEB-1 全站前端页面视觉审计已完成：17 个页面桌面/移动截图、4 个角色 Console 移动截图已走查；修复全局移动横向溢出、Race/Live/Rider 等二级页响应式栅格、入口按钮和卡片排布 | `web/app/globals.css` |
| WEB-1 Judge / Public / Screen E2E 已固化并验证：6/6 通过；同时通过 20 个领域测试、静态烟测、TypeScript 和 Next build | `web/e2e/judge.spec.ts`、`web/e2e/public.spec.ts`、`web/e2e/screen.spec.ts`、`web/playwright.config.ts`、`npm run test:e2e` |
| WEB-1 全角色 / Public / Screen E2E 与 CI 已完成：Playwright 9/9、领域测试 20/20、静态烟测、TypeScript、Next build 通过；实际浏览器抽查三角色隔离通过 | `web/e2e/`、`.github/workflows/web-ci.yml`、`web/scripts/static-smoke.mjs`、`web/README.md` |
| SEC-1 安全与生产基线验证通过：Playwright 14/14、领域测试 23/23、静态烟测、TypeScript、PostgreSQL client / production build、production config preflight 通过 | `web/e2e/security.spec.ts`、`web/tests/domain.test.ts`、`web/prisma/schema.prisma`、`web/scripts/check-production-config.mjs`、`docs/ary-production-security-baseline.md` |
| SEC-WORK-1 本地代码质量门通过：37 条领域/契约测试、Playwright 14/14、静态烟测、TypeScript、PostgreSQL client / production build、独立 SQLite db:init + seed 和 production config preflight 通过 | `web/tests/work-submission.test.ts`、`web/tests/work-submission-domain.test.ts`、`web/e2e/`、`web/prisma/seed.ts` |
| DEV-8 风险评审中心已验证：ReviewFlag 新增处置字段，Organizer 可 resolve / in_review，Rider 可 reopen，Judge 只读处置摘要；静态烟测、领域测试和构建口径应覆盖新页面和动作 | `web/app/console/risk-center/page.tsx`、`web/lib/domain.ts`、`web/tests/domain.test.ts`、`web/scripts/static-smoke.mjs` |

## 领域测试映射表

`app/domain.test.js` 当前 10 个 P0 用例与交付任务、领域动作和文档证据的对应关系如下，作为代码 ↔ 测试 ↔ 任务的统一口径：

| 测试用例 | 对应任务 | 主要代码动作 | 文档证据 |
|---|---|---|---|
| DEV-4 duplicate registration is idempotent per user and race | DEV-4 | `submitRegistration` | `docs/ary-dev-4-to-ops-delivery.md` §3.1 |
| DEV-4 approved Registration ensures exactly one RaceProject | DEV-4 | `approveRegistration` → `ensureRaceProject` | `docs/ary-dev-4-to-ops-delivery.md` §3.1 |
| DEV-5 invalid CA signal is quarantined and does not create evidence | DEV-5 | `ingestRidingSignal` 校验失败路径 | `docs/ary-dev-4-to-ops-delivery.md` §4.1 |
| DEV-5 accepted CA signal creates active projection input and duplicate is ignored | DEV-5 | `ingestRidingSignal` + `rebuildProjection` + `idempotencyKey` | `docs/ary-dev-4-to-ops-delivery.md` §4.1 §4.2 |
| DEV-5 forged CA signal without attestation is quarantined | DEV-5 | `ingestRidingSignal` attestation 防伪校验 | `docs/ary-ca-integration-spec.md` §5.3、`docs/ary-dev-4-to-ops-delivery.md` §4.1 |
| DEV-5 CA failed does not block Work, Judge, or Award | DEV-5 | `disableCAConnection` / ReviewFlag `ingestion_exception` | `docs/ary-dev-4-to-ops-delivery.md` §4.1 |
| DEV-5 projection failure is isolated from facts and keeps stable fallback | DEV-5 | `rebuildProjection` 失败分支 | `docs/ary-dev-4-to-ops-delivery.md` §4.2 |
| DEV-7 report visibility keeps rider_report private and public review published | DEV-7 | `generateReport` / `publishReport` | `docs/ary-dev-4-to-ops-delivery.md` §6 |
| DEV-7 failed report generation preserves already published public report | DEV-7 | `generateReport` 失败分支 | `docs/ary-dev-4-to-ops-delivery.md` §6 |
| REL-1 and OPS-1 P0 regression reaches release and ops evidence | REL-1/OPS-1 | `runP0Regression` / `createBackup` / `releaseChecklist` | `docs/ary-dev-4-to-ops-delivery.md` §7 |

新增领域动作或调整不变量时，必须同步在本表追加对应行，避免测试与文档漂移。

---

## 风险与阻塞

| 项目 | 状态 |
| --- | --- |
| 生产基础设施尚未建立 | PostgreSQL schema / migration 和配置门禁已入库；仍需实际托管 PostgreSQL、TLS、备份恢复、WAF / 限流、监控和部署流水线证据 |
| `web/` 真实OAuth仍需外部配置 | OAuth state、随机会话和禁止 fallback 已实现；仍需配置真实 GitHub OAuth App 并在 staging 验证 callback、过期和 Logout |
| Risk Center 仍需生产化 | 已具备 open / in_review / resolved 状态与角色视图；仍需补处置 SLA、通知、批量操作和违规作品升级策略 |
| 服务端权限仍需系统化审计 | `web/` 已具备服务端权限上下文，且本轮修复 Judge assignment 边界；仍需按权限矩阵覆盖剩余资源动作 |
| 浏览器自动化托管结果尚待首次推送确认 | 全角色 / Public / Screen / Security 14 个 E2E 和 CI 配置已在本地验证；推送后确认 GitHub-hosted Runner，并继续补截图基线、移动端和负载路径 |
| PostgreSQL migration 仅有一次性本地证据 | PostgreSQL 16 全新库和模拟已有 Race Live 基线升级均已通过；仍需在 Hosted CI / staging 执行并保留环境级证据 |
| Repo / Demo 内容安全不在本轮范围 | 当前只固定 GitHub HTTPS Repo 与 40 位 commit SHA 声明，并限制 Demo URL；未联网证明 commit 存在，未做仓库归档、secret / 依赖扫描、文件杀毒或 Demo 沙箱 |
# 2026-07-14 Race Live 接入状态

- 已实现 Track Profile/Runtime、两条内置赛道、RaceRound/RaceRoundEntry、TrackProfileVersion、严格公开快照、Projection Builder、每组最多 8 人、自动轮播和 Organizer/Admin 审计控制。
- 已通过静态检查、43 项领域/契约测试、类型检查、production build、Race Live 两尺寸 E2E、原 Screen E2E，以及修复后的 5 项 Security E2E。
- 一次全量 16 项 E2E 在第 14 项发现公共 Race API 暴露原始 Projection；改为显式 allowlist 后最终全量复跑 16/16 通过。
- PostgreSQL migration 已在既有一次性 PostgreSQL 16 全新库和模拟基线库执行；本次页面/生命周期补齐未修改 Prisma schema，无新增 migration。
- Track Calibrator 核心工具链已实现；仓库在线验证、资产垃圾回收和多人实时协同仍不在本轮范围。
