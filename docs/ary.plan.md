# ARY MVP Plan

版本：v0.1
文档类型：Project Plan
状态：有效草案 / 项目任务定义入口
上游入口：`ary-mvp.prd.md`
领域基线：`ary-domain-analysis.v0.3.md`
近期任务窗口：`../PLAN.md`
任务瞬时看板：`../STATUS.md`

治理说明：

* 本文是 ARY MVP 的正式任务定义入口，承接 PRD、领域基线、权限矩阵、QA Plan 和 Release & Ops Plan。
* 本文定义长期任务、产出、验收和不做事项；不记录当前进度，也不强制任务与里程碑一一对应。
* 近期任务窗口和里程碑由根目录 `PLAN.md` 维护；任务瞬时状态由根目录 `STATUS.md` 维护。
* 稳定任务编号按工作域使用 `PRD`、`UX`、`DEV`、`REL`、`OPS` 前缀；每个前缀各自从 1 开始编号。

编号规则：

| 前缀 | 工作域 |
| --- | --- |
| `PRD` | 产品方向、需求基线、文档冻结和产品事实校正。 |
| `UX` | 用户体验、视觉设计、高保真原型、交互状态和设计验收。 |
| `DEV` | 架构、数据模型、接口、应用实现和技术交付。 |
| `REL` | 验收、彩排、灰度、发布和 go / no-go 判断。 |
| `OPS` | 监控、备份、值守、回滚、事故处理和赛后归档。 |

依赖关系：

| 任务 | 前置 / 依赖 | 说明 |
| --- | --- | --- |
| `PRD-1` | 无 | 产品、领域、权限、QA、发布和计划文档的基线入口。 |
| `UX-1` | `PRD-1` | 设计基线依赖 PRD、IA、领域和权限口径。 |
| `DEV-1` | `PRD-1` | 架构、领域模型、权限和数据模型依赖文档基线。 |
| `DEV-2` | `PRD-1`, `UX-1` | 公开端静态闭环依赖产品范围和高保真设计输入。 |
| `DEV-3` | `PRD-1`, `UX-1`, `DEV-1` | 登录、角色和 Console 入口依赖权限与数据边界。 |
| `DEV-4` | `DEV-1`, `DEV-3` | 报名、RaceProject、Work 和 Judge 结构流程依赖角色入口与领域边界。 |
| `DEV-5` | `DEV-1`, `DEV-4` | CA 接入、Projection 和 Live Hall 依赖 RaceProject 与 Work/Judge 结构流程。 |
| `DEV-6` | `DEV-5` | Screen Console 和大屏联调依赖 Projection / Live Hall 的稳定读取边界。 |
| `DEV-7` | `DEV-4`, `DEV-5` | Report、Review 和 Results 依赖提交、评审与 CA / Projection 输入。 |
| `DEV-8` | `DEV-4`, `DEV-5`, `DEV-7` | 风险评审中心依赖 ReviewFlag、提交/评审结构流程和 Report/Review 上下文。 |
| `REL-1` | `DEV-4`, `DEV-5`, `DEV-6`, `DEV-7` | 彩排、灰度和正式发布依赖本地 MVP 关键闭环。 |
| `OPS-1` | `REL-1` | 赛事值守、回滚和赛后归档依赖发布彩排与 go / no-go 证据。 |

---

# 1. 文档目的

本文把 PRD 中的产品目标初步转成研发任务定义。本文负责在架构设计前粗分任务、产出、验收、风险和 Demo 节奏。

本文不是正式开发排期或交付承诺。正式项目计划应在架构文档、数据模型、CA 接入方案、Projection / Report 生成链路、权限落地方式、部署方案和技术栈确认后重估并细化。

交付原则：

* 先跑通首场赛事闭环，再增强体验。
* 先保证事实源和权限，再做投影和大屏。
* 每个任务都应有可验收产物。

---

# 2. 任务定义

## PRD-1 文档基线与范围确认

交付范围：

* PRD、领域模型、IA、权限矩阵、QA Plan、Project Plan、Release & Ops Plan 形成首轮基线。
* CA Integration Spec 保留占位，后续架构阶段补齐。

不做什么：

* 不做代码实现。
* 不展开完整 CA 接口契约。

验收用例：

* 文档之间没有 Organization、RoleAssignment、手动 Session Summary 补交等冲突；Team 仅作为轻量团队参赛实体，不扩展为组织或多租户。
* PRD 能作为架构设计入口。

风险：

* CA 接入细节暂缺，后续可能影响技术排期。

是否可 demo：否。

## UX-1 UX/UI 高保真原型与设计基线

交付范围：

* 基于 PRD、IA、领域基线和权限矩阵输出 MVP 高保真 UX/UI 原型。
* 覆盖 Public Site、Race Console、Admin Console、Screen Console、Screen Display 的关键页面和关键状态。
* 明确 Gallery-first 首页、Race Page、Live Hall、Works、Results、Review、Rider Profile、Organizer / Rider / Judge View、Admin 用户与角色管理、大屏展示模式的视觉与交互基线。
* 输出桌面端和移动端关键视口设计，标注核心组件、页面状态、空态、错误态、权限差异和数据依赖。
* 明确哪些设计资产进入架构输入，哪些仍为视觉探索或后续增强。

不做什么：

* 不做代码实现。
* 不替代领域模型、权限规则、接口契约或数据库设计。
* 不展开 P1 / P2 平台化体验。

验收用例：

* 高保真原型能支撑公众、Rider、Organizer、Judge、Admin、Screen Operator 的 P0 主路径走查。
* 关键页面状态、权限入口和信息密度足以反推前端路由、组件边界、接口读取模型和 Projection 消费方式。
* 设计输出与 Gallery-first、实时 CA 接入、Projection 不作为事实源、原始 CA Session 默认不公开等核心约束不冲突。
* 设计基线被明确记录为 `M2` 架构设计输入之一。

风险：

* 如果没有高保真原型，架构设计会缺少页面状态、权限入口、信息密度和大屏展示约束，后续实现和接口设计容易返工。

是否可 demo：是，以可点击原型、设计稿走查或高保真静态页面走查验收。

## DEV-1 领域模型 + 权限 + 数据模型

交付范围：

* 基于领域基线设计聚合边界和数据模型草案。
* 将 `ary-permission-matrix.md` 转成接口鉴权规则。
* 明确 Race、User、Registration、RaceProject、CAConnection、Session、Work、JudgeAssignment、JudgingRecord、Award、Evidence、Report、Projection 的存储边界。

不做什么：

* 不做完整 UI。
* 不做多组织、多租户或复杂团队治理；只支持当前 Race 下的轻量团队参赛。

验收用例：

* 一个 User 对同一 Race 最多一种参赛身份：个人报名或加入一个团队，二者不能并存。
* 一个 Registration 最多一个 RaceProject 和一个主 Work；Registration approved 后由 ARY 幂等生成 RaceProject；一个 RaceProject 可在参赛过程中登记多个 CAConnection。
* 只有已登记、已握手、归属正确且未禁用的 CAConnection 后续数据可以进入 Projection、Evidence 或 Report 输入。
* RaceProject 聚合 CA 接入 failed / not_configured 不阻断提交、评审和 Award 流程，但应生成评审前风险提示。

风险：

* 如果权限范围定义不清，后续 Console 会出现越权风险。

是否可 demo：可用数据模型和权限用例 demo。

## DEV-2 Public Site 静态闭环

交付范围：

* Home / Race Gallery。
* Race Page。
* Works / Work Page。
* Results。
* Cooperation。
* 使用 mock 或种子数据形成公开浏览路径。

不做什么：

* 不做真实登录和后台。
* 不做实时 Projection。

验收用例：

* 公众用户 2 次点击内进入当前主推赛事。
* 公众用户可以查看作品、赛果和评审总结 mock。

风险：

* 公开端容易过早做成营销页，需要保持 Gallery-first。

是否可 demo：是。

## DEV-3 登录 / 角色 / Race Console

交付范围：

* GitHub 登录。
* 资料补全。
* GitHub 已验证邮箱、公共账号资料与协议门禁。
* 规范化 `UserRole` 多角色资格、独立 RoleProfile 和 `RoleApplication` 审核。
* `AuthSession.activeRole` 单会话角色切换与 Rider / Judge / Organizer / Admin 独立 Console。
* Admin Console 角色申请和单个资格状态管理。

不做什么：

* 不做完整赛事执行。
* 不做 Screen Console。

验收用例：

* 用户可登录并补全资料。
* Rider 可自助开通，Judge / Organizer 经审核开通，Admin 只能由有效 Admin 授予。
* 多角色用户每个会话只激活一个角色；不同设备会话互不影响。
* 页面、API、Server Action 只接受 `activeRole`，跨角色直达被拒绝。
* 同一 Race 的 Rider 与 Organizer/Judge 冲突规则、Organizer+Judge 共存和自行分配均有领域测试。

风险：

* PostgreSQL 手写迁移必须在全新库与已有基线库分别部署验证；本地缺少可用 PostgreSQL 时不得把该环境项标记完成。

是否可 demo：是。

## DEV-4 报名 / RaceProject / Work / Judge 结构流程

交付范围：

* Race 创建、发布、报名、审核。
* Registration 管理。
* RaceProject 自动生成和状态查看入口。
* Work 创建和提交的结构流程。
* JudgeAssignment 和 JudgingRecord 基础结构流程。
* 使用 mock eligibility 验证提交和评审路径。

不做什么：

* 不做完整 CA 实时接入。
* 不启用生产级 CA 接入证据完整度检查。
* 不承诺真实评审前风险提示完整性。
* 不做 Report Generator。

验收用例：

* Organizer 可以发布 Race 并审核报名。
* Rider 可以在 mock eligibility 下验证 Work 提交流程。
* Organizer 可以在 mock eligibility 下给 Judge 分配 Work。
* Judge 可以在 mock eligibility 下验证评分和评语提交流程。

风险：

* 如果 RaceProject 自动生成和 CA 接入状态未明确，后续 CA 接入任务会返工。
* 本任务的提交和评审只验证结构流程，真实证据完整度和评审前风险提示必须在 CA 接入任务完成后重新验收。

是否可 demo：是。

## DEV-5 CA 接入 / Projection / Live Hall

交付范围：

* CA 实时接入基础版。
* 参赛过程中 CAConnection 登记与握手校验。
* 已登记且握手成功 CAConnection 骑行信号接入。
* GitHub Repo / 代码材料绑定和引用。
* 多 CAConnection 接入状态追踪与 RaceProject 聚合状态。
* Riding Metrics 基础摘要。
* Projection 生成和重算。
* Live Hall 读取 Projection。

不做什么：

* 不接受事后上传 Session Summary 伪造实时 CA 证据。
* 不做完整多 CA 标准化协议。

验收用例：

* 接入成功的 Registration 可以形成骑行证据、Projection 和评审摘要。
* RaceProject 聚合接入 failed / not_configured 的 Registration 仍可进入提交、评审和 Award 流程，但必须生成评审前风险提示。
* 未登记、未握手、归属错误或被禁用的 CAConnection 数据不进入 Projection、Evidence 或 Report。
* 部分 CAConnection 接入失败不影响 Live Hall 整体展示。
* Projection 失败不污染事实数据。

风险：

* CA 来源数据格式不稳定。
* 实时性和稳定性可能影响赛事当天观感。

是否可 demo：是。

## DEV-6 Screen Console / 大屏联调

交付范围：

* Screen Console 基础版。
* Jumbotron / Billboard。
* Live / 榜单 / 作品 / 公告切换。
* 全屏展示。
* 大屏 fallback。

不做什么：

* 不做复杂主题系统。
* 不做独立 Data / Ops Console。

验收用例：

* 操作员可以选择 Race 并切换展示模式。
* 弱网或 Projection 异常时可 fallback 到稳定 Projection 或静态公告 / 榜单。

风险：

* 现场屏幕比例、浏览器环境和网络质量不可控。

是否可 demo：是，需现场或模拟大屏联调。

## DEV-7 Report / Review / Results

交付范围：

* Award / Leaderboard 发布。
* rider_report、race_report、review_summary。
* Report 生成、编辑、发布。
* Results / Review 与公开端联动。

不做什么：

* 不做高级 AI 自动评审。
* 不做奖项推荐。

验收用例：

* Organizer 可以发布榜单。
* Report 生成失败可手动重跑或人工编辑发布。
* 未发布 Report 不出现在 Public Site。

风险：

* Report 内容若缺少 Evidence 引用，会影响可信度。

是否可 demo：是。

## DEV-8 风险评审中心

交付范围：

* 将 `ReviewFlag` 从只读提示升级为可处置对象。
* 为 Organizer 提供按状态、严重度、类型和 Rider 的风险筛选、处置和 reopen 闭环。
* 为 Rider 提供仅包含本人可整改风险的整改视图和明确动作提示。
* 为 Judge 提供带处置结果的风险摘要，作为评审上下文而非自动判分。
* 为风险处置补齐最小审计字段：处理说明、处理人、更新时间。

不做什么：

* 不做复杂负责人分配、审批流、通知系统或自动处罚。
* 不把风险提示升级成参赛资格硬门禁。
* 不暴露原始 CA Session 或 Organizer 内部判断给 Rider。

验收用例：

* Organizer 可以查看当前 Race 全部风险并标记 `open / in_review / resolved`。
* Rider 只能看到自己的风险，并能在补料后重新打开相关风险。
* Judge 只看到分配作品相关的风险和处置摘要。
* 风险处理记录会回流到 Judge 评审上下文，但不自动替代人工评分。

风险：

* 若风险类型继续扩展而不抽象推荐动作，页面文案会逐步碎片化。
* 若未来引入真实通知和 SLA，需要重新设计状态机和责任分配。

是否可 demo：是。

## REL-1 赛事彩排 / 灰度发布 / 正式发布

交付范围：

* Staging 全流程彩排。
* 灰度发布。
* 生产环境发布。

不做什么：

* 开赛冻结窗口内不做非必要功能变更。
* 不临时改变 CA 数据接收和评审前风险规则。

验收用例：

* P0 回归一键跑通。
* 大屏、Live Hall、Report、Results 均完成彩排。
* go / no-go 判断有明确证据。

风险：

* 现场网络、CA 接入、投屏设备、突发数据异常。

是否可 demo：是，必须做完整彩排。

## OPS-1 赛事值守 / 回滚 / 赛后归档

交付范围：

* 赛事当天值守。
* 回滚方案和备份方案。
* 事故记录。
* 赛后归档和复盘。

不做什么：

* 不在冻结窗口内做非必要功能变更。
* 不临时改变已确认的赛事资格和发布规则。

验收用例：

* 值守表、回滚方案和备份方案已确认。
* 关键数据完成赛后归档。
* 事故和复盘有记录入口。

风险：

* 现场网络、CA 接入、投屏设备、突发数据异常。

是否可 demo：否，以演练和记录验收。

---

# 3. 任务完成标准

每个任务完成时必须输出：

* 可演示产物或可审查设计。
* 任务验收记录。
* 未完成项和风险列表。
* 是否进入后续任务或里程碑的判断。
