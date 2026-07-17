# PLAN

本文是 ARY 近期任务窗口，只记录当前阶段、近期主线、后续队列和质量门。长期任务定义见 `docs/ary.plan.md`；当前事实、完成证据和风险见 `STATUS.md`。

## 当前阶段

ARY 已完成 PRD / UX / 领域模型 / 本地 MVP、WEB-1 全角色 E2E / CI，以及 SEC-1 代码级安全基线。Racer 作品提交完整性、Race Live 页面与 Track Calibrator 核心工具链已迁入同一 ARY 应用；一次性 PostgreSQL 16 已验证全新库和已有 Race Live 基线库升级，真实 staging / production 证据仍未取得。

2026-07-15 已完成 GRS003 多角色资格与独立工作台代码基线：`UserRole` 保存多个资格，`AuthSession.activeRole` 保证单会话只启用一个角色；GitHub OAuth、分类资料、角色申请/审核、会话切换、四类独立 Console、赛事冲突和公开 DTO 隔离均已落地。本地 SQLite、领域测试、类型检查、生产构建与 24 条 Playwright E2E 已通过。新增 PostgreSQL 迁移尚需在可用 PostgreSQL 的全新库和已有基线库执行，当前不得视为 staging 迁移验收完成。

2026-07-15 已完成 UX-1 认证区视觉完善：登录后角色控件始终可发现且只展示当前账号有效资格；账号资料、Rider/Judge/Organizer 分类资料与四角色 Console 首页已统一为蓝白轻玻璃视觉系统，保留全部服务端动作、字段契约和权限边界。桌面与 390px 移动端浏览器走查、无横向页面溢出检查及 24/24 Playwright 回归均通过。

2026-07-16 已修复 Organizer 创建 Race 的交互与会话问题：创建期间按钮禁用并显示 pending 状态，成功后直接进入新 Race 且展示确认提示；旧 Organizer 标签页若已在同一浏览器切换角色，服务端继续拒绝越权创建，但改为回到真实当前工作台并展示可恢复提示。正常创建与会话竞态均纳入定向 E2E。

2026-07-16 已完成 Organizer 账号首页与单场 Race Workspace 分层：`/console/organizer` 只展示本人创建或明确协作管理的赛事资产、账号级状态汇总和创建入口；Registration、CA、Projection、Work、Report、风险与运营动作统一迁入 `/console/organizer/races/{raceId}`。Owner / Collaborator、未授权 404、旧链接兼容、同名 Race 区分和创建后直达均已由 Playwright 回归覆盖。

2026-07-16 已补齐 Race 公开与报名反馈闭环：公开主页继续严格只展示 `visibility=public` 的已发布 Race，Organizer Portfolio 对 draft/private 明示“不会出现在公开主页”，发布成功后显示确认；Race Page 现在读取真实报名总数，并按未登录、角色不匹配、未开放、可报名、已报名分别呈现。报名 Server Action 成功或失败均回到原 Race Page 显示状态，全量 Playwright 28/28 通过。

2026-07-16 已完成 UX-1 PC 全站视觉重构与持久角色侧栏的本地质量门：未登录或尚无 `activeRole` 的流程继续使用公共顶栏；登录且存在 `activeRole` 后，Public、资料页、四角色 Console 与专业工具统一进入角色专属持久侧栏，导航时保留独立 URL、刷新和深链接。Public Site 新增 Rider 目录，Race / Work / Rider 卡片接入本地原创科技主题封面；`/screen/display` 仍为无站点导航的独立投屏输出，Track、Screen Console、Risk 与 Ops 只统一外壳，不改变专业工作区和领域动作。`check:static`（28 pages / 15 APIs）、隔离 `DATABASE_URL=file:./e2e.db` 的领域测试、typecheck、production build、33/33 Playwright E2E 和 `git diff --check` 均通过，3000 端口服务已恢复并返回 HTTP 200；PC 1280/1440/1920 由 E2E 覆盖。当前 Browser runtime 无可用实例，额外人工浏览器走查受阻；本地 `check:production-config` 因未配置生产变量按预期失败，不构成生产环境预检通过证据。

2026-07-16 已完成登录、跳转与工作台滚动稳定性修复：新增统一 `/login`，公共入口和受保护入口均携带经过站内路径校验的 `next`，GitHub OAuth 与 Debug Login 统一提供友好错误反馈。OAuth callback 将 User、AuthAccount 与 AuthSession 写入收敛到事务中，支持幂等恢复和有限重试，只有事务成功后才写 Cookie，外部错误不向页面泄露内部细节；未修改 Prisma Schema、角色资格或权限边界。Debug Login 按可信当前 Host / forwarded origin 跳转，避免 `localhost` 与 `127.0.0.1` 间跨 Host 丢失 Cookie；认证 API 入口使用原生链接触发完整导航，确保 RootLayout 重新读取会话。AppShell 的 main 成为唯一纵向滚动容器，侧栏和 topbar 保持固定。静态检查（28 pages / 15 APIs）、隔离 `e2e.db` 的领域测试、typecheck、production build、定向 10/10 与完整 40/40 Playwright E2E 均通过；3000 端口返回 HTTP 200，验证前后 `dev.db` SHA-256 未变化。

2026-07-16 已完成 Agent 协作与测试流程提速里程碑：日常开发改按 L0/L1/L2/L3/发布分级选择实施和验证范围，低风险修改可由主 Agent 直接完成，只有真实可并行或高风险任务才委派子 Agent；新增 `check:quick`、认证纯函数快速测试和不重复 prepare 的定向 E2E 入口。完整 build、完整领域测试和完整 E2E 保留为 L3 稳定后、里程碑、发布和 CI 门禁，不再对每个小修复重复执行。普通 L0/L1 不逐项更新计划与状态文档，产品边界、重要风险和里程碑仍集中同步。

2026-07-16 已完成公共站点与角色工作台分层、团队报名升级及赛事大屏隔离：公共路由登录后仅提供工作台/退出，角色侧栏不再混入公共导航；Rider 工作台仅查询本人个人报名或团队成员赛事。Race Page 报名弹窗支持个人、建队、入队，Team 增加可选简介和 2–10 人上限，队长/队员操作与提交后锁定已明确。Screen Console 和 Display 必须显式携带 Race，状态、轮询与权限按 Race 隔离，旧 Display 不再读取默认赛事。本轮完成隔离领域测试、`check:quick` 和定向 E2E；production build 与完整 E2E 留待独立 L3 验收集中执行。

2026-07-16 已完成多赛事工作台、首页精选、OAuth 并发 state 与风险中心分层修复：Rider Portfolio 展示全部参赛资产并使用独立 Race 路由；首页按真实热度自动补齐最多六场并支持 Admin 置顶/排序/隐藏；Display 无 Projection 时提供可轮询静态兜底；OAuth 规范化 Origin 并支持四个并发 state；风险中心收敛为 Organizer 处置、Rider 团队整改、Judge 分配只读、Admin 全局只读。`check:quick`、production build、隔离领域测试通过；完整 Playwright 首轮 45/46，通过修复唯一兼容提示后定向复跑 1/1。浏览器走查确认首页、Rider Portfolio、静态大屏和四角色风险边界无横向溢出；真实 GitHub 授权完成仍需 staging OAuth App 外部验收。

2026-07-16 已完成公共目录分页、动态轮播与 Race Live 大屏复原：首页 Hero 改为具有明确横向位移、首尾无缝衔接、暂停与 reduced-motion 兼容的赛事轮播；首页 Race、全站 Works 与 Riders 目录统一使用 URL 搜索/筛选和每页 9 条分页。首页下方保留但收敛为最多 3 项精选 Works、动态最新赛果和窄版合作 CTA，分别承担作品发现、赛事结果信任和合作转化，不替代完整目录。Race Live 的 live、leaderboard、works、announcement 四模式共享暗色赛事框架，`live` 为默认输出，P0 彩排结束恢复 `live`；没有有效 Projection 时只展示真实赛事与等待配置信息。四角色工作台侧栏新增显式“返回公共主页”入口。上述实现不改变 Prisma Schema、外部 API、权限矩阵或上传流程。独立复验中 `check:quick`、分页与 screen-p0 领域测试、本轮新增定向 E2E 10/10 均通过；production build 首次且唯一一次通过，仅输出 autoprefixer `flex-end` 与多 lockfile 警告。首次且唯一一次完整 E2E 为 49 pass / 6 fail / 1 未运行，暴露测试隔离与 Projection 选择问题；修复后仅复跑相关 5 个 spec，结果 15/15、0 失败、0 未运行，未重复完整 E2E 或 build，因此不得表述为完整 E2E 全绿。验证前后 `dev.db` 哈希一致，开发服务已恢复至 `127.0.0.1:3000` 并返回 HTTP 200；Screen 两视口与轮播由 Playwright 覆盖，人工 Browser 走查因无可用实例未完成。

本轮验证期间误执行了会重建开发库的初始化流程，`web/prisma/dev.db` 已回到 Seed 基线；未发现可用备份，原手工开发数据无法恢复。后续领域和 E2E 验证必须使用隔离的 `e2e.db`，未经用户明确确认不得对 `dev.db` 执行 `init-sqlite` 或 `db:init`。在 `dev.db` 上重复执行 `npm test` 还可能受到测试残留数据影响，不应据此判定代码失败。

当前从“代码级正式工程化”进入“真实环境验收”。Race Live 与 Track Calibrator 已并入同一 ARY Next.js 应用，本地草稿使用浏览器 IndexedDB，服务端发布形成不可变 TrackProfileVersion；GRS002 不再作为运行时服务或数据源。仓库尚未取得生产 TLS、托管 PostgreSQL、真实 OAuth App、正式 CA 凭据、备份恢复、WAF / 限流、监控和 staging 彩排证据，真实赛事继续保持 no-go。

## 当前主线

Race Live 的独立 16:9 五层信息大屏、同 Round 每组最多 8 人自动轮播，以及 Track Calibrator 的可发现入口、浏览器 Draft、完整编辑/预览/人工核验和版本生命周期已迁入；GRS003 是唯一事实源。本轮未引入独立 GRS002 服务、Coach/Cockpit 或在线仓库抓取。

本轮 UX-1 PC 验收窗口采用以下口径：

* 1280、1440、1920 宽度下验证固定角色侧栏、右侧内容滚动、当前导航态、RoleSwitcher 和无横向溢出。
* Rider、Organizer、Judge、Admin 使用各自独立菜单；Organizer 的 Race 工具链接必须携带当前 `raceId`，未进入单场 Race 时不伪造赛事上下文。
* 公共浏览始终使用公共顶栏；登录后显示工作台/退出但不显示角色侧栏。登录、Debug Login、无角色选择/审核状态保持专注流程；`Screen Display` 保持独立。
* 游客访问受保护页面统一进入 `/login?next=...`；认证完成后只允许回到安全站内地址，Debug Login 保持当前浏览器 Host，正式 OAuth callback 仍以 `NEXT_PUBLIC_APP_URL` 为准。
* 角色工作台由 AppShell main 独立纵向滚动，侧栏和 topbar 固定；认证 API 跳转必须触发 RootLayout 重新读取 Cookie 会话。
* Team 简介与报名/Screen 权限口径已按本轮产品决定更新；不修改 GitHub OAuth、角色资格、CA 模型或作品版本规则，本轮不承担手机和平板适配。

| 优先级 | 工作项 | 目标 | 完成口径 | 下一入口 |
| --- | --- | --- | --- | --- |
| P0 | Hosted CI 首次验证 | 确认安全、角色会话、作品提交、Race Live 与 Track Calibrator 基线在远端环境可重复执行 | 静态检查、完整领域/契约测试、类型检查、PostgreSQL migration + production build、生产配置预检和完整 E2E（当前本地 40 项）均通过 | `.github/workflows/web-ci.yml`、`web/e2e/`、`web/prisma/migrations/` |
| P0 | Staging 基础设施 | 建立托管 PostgreSQL、TLS ingress、secret manager、WAF / 限流、集中日志和监控 | `docs/ary-production-security-baseline.md` 的部署门禁在 staging 有可追溯证据 | `docs/ary-production-security-baseline.md` |
| P0 | 真实 GitHub OAuth 验收 | 使用真实 OAuth App 验证身份与会话闭环 | 本地 callback 事务、幂等恢复、有限重试和错误脱敏已完成；仍需在 staging 验证 state、真实登录、过期、Logout、角色变化和跨会话策略 | `web/lib/auth.ts`、`web/app/api/auth/`、`docs/ary-permission-matrix.md` |
| P1 | DEV-8 风险评审中心 | 建立 Organizer 处置、Rider 整改、Judge 上下文三端风险闭环 | `web/` 中具备风险筛选、状态流转、处置记录和评审回流；长期任务与权限口径同步落盘 | `docs/ary.plan.md`、`docs/ary-permission-matrix.md`、`web/app/console/risk-center/page.tsx` |

## 后续队列

| 顺序 | 工作项 | 目标 |
| --- | --- | --- |
| 1 | 真实 CAConnector | 完成凭据交付、轮换 / 吊销、HTTP snapshot fetch，以及篡改、过期和重放演练 |
| 2 | 数据可靠性演练 | 完成 migration、备份恢复、回滚和本地 / E2E / staging 数据隔离验证 |
| 3 | 浏览器与非功能验收 | 在当前 40 个 E2E 基础上补人工截图走查、弱网、负载和更多权限负向路径；PC 1280/1440/1920 已由 E2E 覆盖，本轮额外人工走查因 Browser runtime 不可用受阻 |
| 4 | Production go/no-go | 完成 P0 回归、发布检查、回滚彩排、监控和事故响应；任一硬门禁缺失则保持 no-go |
| 5 | 仓库与 Demo 内容安全 | 在线证明 commit 属于声明仓库，补不可变归档、secret / 依赖扫描、文件杀毒和 Demo 沙箱；与当前格式校验/冻结基线分开立项 |

## 当前质量门

日常开发按 `AGENTS.md` 的风险等级执行：L0 做差异检查，L1 使用 `check:quick` 和定向测试，L2 增加相关领域测试与定向 E2E，L3 在实现稳定后集中执行一次 build 和完整 E2E。最终回复必须明确列出实际检查与主动跳过项，不得把未运行项目写成通过。

合并、发布、里程碑或用户明确要求完整验收时，仍必须确认：

* `npm.cmd run check:static`、完整领域测试、typecheck 和 production build 通过。
* `npm.cmd run check:production-config` 通过目标环境预检。
* `npm.cmd run test:e2e` 全角色 / Public / Screen / Security 路径通过；若环境缺少浏览器或外部服务，必须明确记录阻塞原因。
* 在一次性 PostgreSQL 上执行 `npm.cmd run prisma:migrate:deploy`，并保留全新库及既有基线库升级证据；无数据库环境时不得把该项标记完成。
* 服务端权限符合 `docs/ary-permission-matrix.md`；Debug Login 仅限显式开关的非生产环境，普通 OAuth 不存在本地账号 fallback。
* `.env`、数据库、Cookie、OAuth Secret、CA 密钥和 connector 凭据不进入 Git。
* 领域和 E2E 验证使用隔离 `DATABASE_URL=file:./e2e.db`；未经用户明确确认，不得运行会重建 `web/prisma/dev.db` 的 `init-sqlite` 或 `db:init`。

## 文档入口

* 产品基线：`docs/ary-mvp.prd.md`
* 长期任务定义：`docs/ary.plan.md`
* 当前状态与风险：`STATUS.md`
* 生产安全基线：`docs/ary-production-security-baseline.md`
* 权限基线：`docs/ary-permission-matrix.md`
* 风险中心专题：`docs/ary-risk-center.md`
* CA 契约：`docs/ary-ca-integration-spec.md`
* 工程运行：`web/README.md`
* WEB-1 E2E / CI 总结：`docs/ary-web-e2e-ci-change-summary.md`

## 执行纪律

* 开工前确认目标、产出、验收口径和不做事项。
* 新增正式任务 ID、依赖或长期验收口径时，先更新 `docs/ary.plan.md`，再同步本文和 `STATUS.md`。
* 普通 L0/L1 不逐项更新本文和 `STATUS.md`；改变近期窗口、产品边界、接口、权限、Schema、数据流、安全/发布风险或完成里程碑时集中同步一次。

## 2026-07-16 Race Live Web 接入

* Organizer 可在单场 Race 的 Screen Console 创建 Round、同步并调整 approved Registration 名单、绑定已发布 Track、启动/结束 Round，并通过“一键准备 Race Live”原子切换当前 Round、稳定 `ary_race_live` Projection 与 `live` 模式。
* CA 信号、风险状态和 Round 状态变化会刷新当前 running Round 的 Race Live Projection；无源数据变化时复用稳定版本，失败时保留上一稳定指针并记录 failed Projection。
* Display 每 3 秒在 `static` 与 `race_live` 间双向切换，并同步模式、分组、公告和 Projection；P0 彩排只允许在已准备大屏上运行，结束后回到 `live`。
* 本轮不新增 Schema，不删除旧 Round 或 Projection；验证必须继续使用隔离 `e2e.db`。

## 2026-07-17 赛题附件与作品安全

* Race 新增可选 PDF 赛题修订：私有隔离存储、内容与主动结构检查、ClamAV 失败关闭、不可变修订、受控下载和审计；文字 challenge 继续必填。
* Work 不新增文件上传；新版本改由最小权限 GitHub App 验证仓库与 Commit，Demo 使用站内风险提示页，历史版本保留并标记 `legacy_unverified`。
* 本轮为 L3 Schema/权限/生产配置变更，只能在隔离数据库验证 migration，禁止初始化或清空 `dev.db`。
* 赛题上传修订说明使用安全编码传输；有效 Rider/团队成员可在赛事空间下载当前安全修订。Organizer 维护赛事级 Judge 池；提交窗口关闭后，平台在 Serializable 事务中为每个版本化 Work 保留合法 Assignment 并补足至三个不同 Judge，失败以页面反馈返回且整批零写入。

## 2026-07-17 Registration 审核与三 Judge 自动评审

* Organizer Race Workspace 的报名区只展示 `pending` Registration；通过后记录审核人/时间，幂等创建唯一 RaceProject 和一条初始 CA 缺失风险，并进入受权参赛选手库。拒绝必须填写原因，历史状态不复制或移动原记录。
* Judge 分配改为赛事级 Judge 池和 `balanced-random-v1` 批次分配。每件 Work 通过 slot 1–3、`UNIQUE(workId, slot)` 与 `UNIQUE(workId, judgeUserId)` 固定为三个不同 Judge；候选不足、版本冲突或已有超过三条 Assignment 时整批阻止。
* 三份评审全部提交后生成维度均分与 overall；Organizer 可查看全场进度，对应 Judge 仅在本人已提交且三份完成后读取聚合分，Rider 仅在 Organizer 发布评审结果后读取本人作品聚合分。公共页面仍只展示正式 Award，Award 保持 Organizer 手工发布。
* 工作台状态动作已接入 pending 按钮、实体迁移和受控结果面板；赛题上传使用真实 XHR 传输进度，传输后进入不伪造百分比的安全扫描状态。
* 本轮已通过 Prisma generate/schema validate、`check:quick`、完整 `npm test` 与唯一一次 production build；唯一一次完整 Playwright E2E 为 58/62，修复后只定向复跑失败的 4 项并取得 4/4。该结果不得写成完整 E2E 62/62；1280/1440/1920/390 视口基线已由自动化覆盖，验证前后 `dev.db` SHA-256 一致。
* 所有数据库验证继续使用隔离数据库；未经用户明确确认禁止初始化、清空或迁移 `web/prisma/dev.db`。
* 赛题正文不再作为平台长期资产：生产环境仅在内存检查后转存 Organizer 自有对象存储，下载使用短期签名 URL；开发环境仅使用进程内 memory。旧 `platform_legacy` 文件必须经 SHA-256 迁移校验后删除。
* 数据库升级顺序固定为 `20260717_01_race_problem_and_repo_verification` → `20260717_02_organizer_owned_problem_storage` → `20260717_03_judge_pool_and_review_workflow`。SQLite 只能先复制到隔离文件，再以显式 `DATABASE_URL=file:...` 运行 `db:migrate:judge-workflow:sqlite`；helper 会拒绝直接迁移 `prisma/dev.db`。
* PostgreSQL 运行时 migration 尚未验证：当前环境的 Docker daemon 与 `psql` 均不可用。Next 开发服务退出时仍可能出现 `controller[kState].transformAlgorithm` 告警，作为后续运行时稳定性风险跟踪，不影响本轮已取得的构建与定向回归证据。
