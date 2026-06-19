# STATUS

本文是 ARY 任务瞬时看板，记录当前任务状态、证据和风险。不记录历史流水。

## 当前结论

* 项目处于MVP文档基线完成、DEV-1到OPS-1本地MVP交付完成阶段。
* 业务文档已集中到 `docs/` 下。
* 当前正式项目任务定义入口是 `docs/ary.plan.md`。
* `PRD-TEMP-1` 已完成并入，报名、RaceProject 自动生成、CAConnection 动态接入和评审前风险提示的新口径已进入 `PRD-1` 正式基线。
* `UX-1` 第一轮高保真原型已验收通过，可作为 `M2` 架构设计输入。
* `DEV-1`已输出聚合边界、数据模型草案和接口鉴权规则；`DEV-2`和`DEV-3`已补齐静态高保真可走查闭环。
* `DEV-4`到`DEV-7`、`REL-1`和`OPS-1`已新增`app/`本地MVP应用，覆盖报名、RaceProject、Work、Judge、CA、Projection、Screen、Report、Results、发布检查、备份、事故和归档闭环。
* `app/domain.test.js`已提供关键领域回归测试并通过本地Node验证。
* 下一步应进入正式工程化，补真实后端、数据库迁移、服务端鉴权、GitHub OAuth、真实CAConnector、浏览器自动化和部署流水线。
* 当前尚未建立生产级应用框架、后端、数据库迁移、真实OAuth、生产CA接入或部署配置；`app/`是无依赖本地MVP实现。
* 已新增`web/`正式集成应用入口：Next.js App Router、Prisma、SQLite、GitHub OAuth路由、服务端权限上下文、Public API和Console/Ops服务端动作；DEV-2/DEV-3高保真页面闭环已迁入正式应用。

## 任务看板

| 任务 | 状态 | 当前判断 | 证据 / 下一入口 |
| --- | --- | --- | --- |
| `PRD-1` 文档基线与范围确认 | 进行中 | `PRD-TEMP-1`新口径已并入，当前基线已支撑`DEV-1`到`OPS-1`本地MVP交付；后续进入正式工程化时继续校验生产边界。 | `docs/README.md`、`docs/ary.plan.md`、`docs/registration-ca-rules-alignment.taskbook.md`、`docs/ary-dev-1-dev-3-delivery.md`、`docs/ary-dev-4-to-ops-delivery.md` |
| `PRD-TEMP-1` 报名 / RaceProject / CA 参赛语义整改 | 已并入 | Registration approved 自动生成 RaceProject、参赛中可新增 CAConnection、CA 接入异常进入评审前风险提示而非硬门禁的新口径已并入正式 `PRD-1` 基线。 | `docs/registration-ca-rules-alignment.taskbook.md`、`docs/ary-mvp.prd.md`、`docs/ary-domain-analysis.v0.3.md`、`design-prototype/` |
| `UX-1` UX/UI 高保真原型与设计基线 | 验收通过 | 高保真原型已按IA重构为1080P高密度蓝白竞赛风格页面，并接入样例赛事数据驱动主要页面；本轮继续补齐Work Page、Login/Profile和Console多角色视图，可支撑`DEV-2`/`DEV-3`静态演示。 | `docs/ux-hifi.taskbook.md`、`design-prototype/index.html`、`design-prototype/README.md` |
| `DEV-1` 领域模型 + 权限 + 数据模型 | 已交付 | 已输出聚合边界、数据模型草案、接口鉴权规则、关键领域事件和验收记录；ReviewFlag采用本轮实现命名，ReviewReadinessCheck作为检查流程命名。 | `docs/ary-dev-1-dev-3-delivery.md`、`docs/ary-domain-analysis.v0.3.md`、`docs/ary-permission-matrix.md`、`docs/ary-mvp.ia.md` |
| `DEV-2` Public Site 静态闭环 | 已交付 | 公开端已覆盖Home、Race Page、Live Hall、Works、Work Page、Results、Review、Rider Profile、Cooperation；公众浏览路径可用mock/样例数据走查。 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| `DEV-3` 登录 / 角色 / Race Console | 已交付 | 已补齐模拟GitHub登录、资料补全、Workspace入口、Organizer/Rider/Judge/Admin视图切换、Admin用户资料状态和`User.roles`维护演示。 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`docs/ary-dev-1-dev-3-delivery.md` |
| `DEV-4` 报名 / RaceProject / Work / Judge 结构流程 | 已交付 | 本地MVP已实现Race发布、报名、审核、RaceProject幂等生成、Work提交、JudgeAssignment和JudgingRecord结构流程，并覆盖重复报名和幂等测试。 | `app/index.html#race`、`app/domain.js`、`app/domain.test.js`、`docs/ary-dev-4-to-ops-delivery.md` |
| `DEV-5` CA 接入 / Projection / Live Hall | 已交付 | 本地MVP已实现CAConnection登记与握手、合法信号接入、非法信号隔离、接入失败ReviewFlag、Projection生成和失败隔离；CA失败不阻断提交、评审和Award。 | `app/index.html#ca`、`app/domain.js`、`app/domain.test.js`、`docs/ary-ca-integration-spec.md`、`docs/ary-dev-4-to-ops-delivery.md` |
| `DEV-6` Screen Console / 大屏联调 | 已交付 | 本地MVP已实现live、leaderboard、works、announcement、fallback模式切换，fallback读取稳定Projection或静态展示。 | `app/index.html#screen`、`app/app.js`、`docs/ary-dev-4-to-ops-delivery.md` |
| `DEV-7` Report / Review / Results | 已交付 | 本地MVP已实现Award/Leaderboard发布、Report生成失败记录、重跑/编辑/发布，以及Public Results/Review/Works公开读取边界。 | `app/index.html#reports`、`app/index.html#public`、`app/domain.test.js`、`docs/ary-dev-4-to-ops-delivery.md` |
| `REL-1` 赛事彩排 / 灰度发布 / 正式发布 | 本地MVP已交付 | 已提供P0回归按钮、发布检查项和go/no-go证据记录；真实staging/production灰度和正式发布待基础设施接入。 | `app/index.html#ops`、`app/domain.test.js`、`docs/ary-dev-4-to-ops-delivery.md` |
| `OPS-1` 赛事值守 / 回滚 / 赛后归档 | 本地MVP已交付 | 已提供备份记录、事故记录、fallback记录和赛后归档入口；真实值守、回滚和生产归档待部署环境接入。 | `app/index.html#ops`、`app/domain.js`、`docs/ary-dev-4-to-ops-delivery.md` |
| `WEB-1` 高保真前端 + 服务端领域动作正式集成 | DEV-2/DEV-3已迁入 | `web/`已建立Next.js全栈工程，迁入Public Home/Race/Live/Works/Work/Results/Review/Rider/Cooperation、Profile Completion、Organizer/Rider/Judge/Admin Console入口，并接入Prisma/SQLite、OAuth fallback、服务端领域动作、Public API和领域测试。 | `web/README.md`、`web/app/`、`web/lib/queries.ts`、`web/lib/domain.ts`、`web/tests/domain.test.ts` |

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
| DEV-5 CA合法/非法接入、失败不阻断、Projection失败隔离通过领域测试 | `node app/domain.test.js` |
| DEV-7 Report公开边界和REL/OPS P0回归通过领域测试 | `node app/domain.test.js` |
| 本地MVP应用脚本通过Node语法检查 | `node --check app/domain.js`、`node --check app/app.js` |
| `app/domain.test.js` 9 个用例 ↔ 任务 ↔ 代码动作 ↔ 文档证据 映射清晰 | 见下方"领域测试映射表" |
| UX-1 收尾 v2 已完成：Race Page in_progress 详情态（leaderboard + event-stream 两张 glass-card 子面板）、Work Page Judge 视角评审态（5 work-judge hooks + renderWorkJudge() + .assigned-work-card span 副作用修复）、`app/` 移动端 UX 静态审计（0 P0 + 5 P1 + 4 P2）三件事一并交付 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/ary-v0.4-race-detail.png`、`design-prototype/ary-v0.4-work-judge.png`、`docs/ary-mobile-ux-review.md` |
| UX-1 收尾 v2 Race Page in_progress 详情态通过 Node 语法检查 | `node --check design-prototype/script.js`（绝对路径） |
| UX-1 收尾 v2 Work Page Judge 视角通过 Node 语法检查 | `node --check design-prototype/script.js`（绝对路径） |
| UX-1 收尾 v2 移动端 UX 静态审计未修改任何 `app/` 或 `design-prototype/` 源代码 | `docs/ary-mobile-ux-review.md`、`app/` `git diff` 为空、`design-prototype/` 仅 t2a/t2b 任务相关改动 |
| WEB-1 已继承 DEV-2/DEV-3 页面闭环：Public Home/Race/Live/Works/Work/Results/Review/Rider/Cooperation、Profile Completion、Organizer/Rider/Judge/Admin Console入口均在 Next.js 应用中渲染并接入服务端数据/动作 | `web/app/`、`web/lib/queries.ts`、`web/lib/domain.ts`、`web/tests/domain.test.ts`、`web/README.md` |
| WEB-1 验证通过：TypeScript、9个领域测试、Next build、本地浏览器烟测均通过 | `cd web && tsc --noEmit`、`python scripts/init-sqlite.py`、`tsx prisma/seed.ts`、`tsx tests/domain.test.ts`、`next build`、`http://127.0.0.1:3000` |

## 领域测试映射表

`app/domain.test.js` 当前 9 个 P0 用例与交付任务、领域动作和文档证据的对应关系如下，作为代码 ↔ 测试 ↔ 任务的统一口径：

| 测试用例 | 对应任务 | 主要代码动作 | 文档证据 |
|---|---|---|---|
| DEV-4 duplicate registration is idempotent per user and race | DEV-4 | `submitRegistration` | `docs/ary-dev-4-to-ops-delivery.md` §3.1 |
| DEV-4 approved Registration ensures exactly one RaceProject | DEV-4 | `approveRegistration` → `ensureRaceProject` | `docs/ary-dev-4-to-ops-delivery.md` §3.1 |
| DEV-5 invalid CA signal is quarantined and does not create evidence | DEV-5 | `ingestRidingSignal` 校验失败路径 | `docs/ary-dev-4-to-ops-delivery.md` §4.1 |
| DEV-5 accepted CA signal creates active projection input and duplicate is ignored | DEV-5 | `ingestRidingSignal` + `rebuildProjection` + `idempotencyKey` | `docs/ary-dev-4-to-ops-delivery.md` §4.1 §4.2 |
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
| 生产级应用框架、数据库迁移、后端接口、真实OAuth和部署配置尚未建立 | 本轮以`app/`本地MVP完成后续任务演示和领域测试；正式工程化仍需启动 |
| `web/` 真实OAuth和生产部署仍需外部配置 | 当前已提供GitHub OAuth路由；未配置OAuth环境变量时使用本地演示账号回调，真实生产需配置GitHub OAuth App和`AUTH_SECRET` |
| ReviewFlag处理状态、CAConnection新增截止窗口和违规作品处理仍需产品化 | 当前本地MVP已实现open/resolved基础状态和风险可见性，正式实现需补细粒度处理流 |
| `design-prototype/`和`app/`均不具备服务端权限控制 | 真实实现时必须按`docs/ary-dev-1-dev-3-delivery.md`、`docs/ary-dev-4-to-ops-delivery.md`和`docs/ary-permission-matrix.md`做服务端鉴权 |
| 浏览器自动化截图验收仍未完成 | 已完成内置浏览器烟测；后续仍需补正式E2E截图基线和CI化浏览器自动化 |
