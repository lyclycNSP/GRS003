# ARY MVP PRD

版本：v0.2
产品名称：Agent Racing Yard，简称 ARY
产品阶段：MVP
文档类型：Product Requirements Document
核心原则：Gallery-first，先做标杆赛事，不先做大平台；CA 接入与大屏展示是核心能力，不从 MVP 中移除

本文是 ARY MVP 的产品语义入口，只定义产品目标、MVP 范围、角色路径、产品级能力、验收标准、成功指标和核心约束。页面结构、领域模型、资源权限、测试范围、研发任务、发布运维和 CA 接口契约不在本文重复详设。

| 主题 | 权威文档 | PRD 中保留内容 |
|---|---|---|
| 产品目标、MVP 范围、验收口径 | 本文 | 权威定义 |
| 领域概念、核心对象、不变量 | `ary-domain-analysis.v0.3.md` | 仅列产品必须识别的对象与边界 |
| 页面层级、导航、页面信息分区、URL | `ary-mvp.ia.md` | 仅列交付承载和产品能力 |
| 资源动作级权限 | `ary-permission-matrix.md` | 仅列角色原则 |
| CA 接口契约、幂等、失败状态细节 | `ary-ca-integration-spec.md` | 仅列产品接入与评审风险规则 |
| 测试覆盖、回归、测试类型 | `ary-qa-plan.md` | 仅列产品验收目标 |
| 研发任务与 Demo 节奏 | `ary.plan.md` | 仅列产品里程碑 |
| 发布、监控、备份、值守、回滚 | `ary-release-ops-plan.md` | 仅列工程就绪要求 |

---

# 1. 产品概述

## 1.1 产品定位

ARY 是面向 Agentic Development 时代的智能体骑行赛事平台。

它通过赛事组织、过程展示、成果提交、评审总结和骑手档案，将开发者与 Coding Agent 协同完成任务的过程变成可观看、可评审、可复盘、可沉淀的能力资产。

ARY MVP 的目标不是构建完整社区平台，而是支撑第一场可复制的 Agent Racing 标杆赛。

---

## 1.2 MVP 核心命题

传统 Hackathon 平台主要记录：

```text
报名 → 提交作品 → 评审 → 排名
```

ARY 需要额外记录和展示：

```text
谁在骑 Agent
如何骑
骑得是否有效
成本如何
进度如何
风险如何
如何纠偏
最终交付了什么
```

因此，ARY MVP 的核心命题是：

```text
通过一场标杆赛事，把 Agent Riding Skill 变成可观察、可展示、可评审、可证明的能力资产。
```

---

# 2. 产品目标

## 2.1 业务目标

ARY MVP 需要完成以下业务目标：

1. 支撑第一场 Agent Racing 标杆赛完整举办。
2. 让公众能够以最短路径看到赛事、赛况、作品、赛果和优秀骑手。
3. 让选手能够完成报名、接入 CA 数据、提交成果、查看报告。
4. 让评委能够查看作品、参考骑行过程、完成评分和评语。
5. 让主办方能够创建赛事、管理报名、发布赛果、生成总结。
6. 让赛事沉淀为案例资产、课程资产、能力资产和商业展示资产。

---

## 2.2 用户价值目标

### 对学生 / 开发者

* 获得真实 Agentic Development 实战机会。
* 通过赛事证明自己的 Agent Riding Skill。
* 获得作品展示、评审反馈、选手报告和能力背书。
* 形成可用于简历、作品集、课程评价和实习推荐的证据。

### 对老师 / 主办方

* 更低成本组织 Agentic Development 实训。
* 实时观察学生进度、成本、风险和问题。
* 通过赛事结果形成课程案例和教学复盘。
* 更容易评估学生是否真正掌握 Agent 协同开发能力。

### 对企业 / 赞助方

* 看到真实开发者供给。
* 观察开发者使用 Agent 完成任务的能力。
* 通过命题赛事发现人才、案例和潜在合作机会。

### 对公众 / 社区

* 观看正在发生的 Agent Racing。
* 浏览优秀作品、榜单和赛后复盘。
* 理解 Agent Riding Skill 的价值。

---

# 3. MVP 范围

## 3.1 MVP 包含

ARY MVP 包含五个交付承载：

```text
公开端 Public Site
赛事控制台 Race Console
账号与角色控制台 Admin Console
大屏控制台 Screen Console
底层 Riding Intelligence
```

### 公开端

* 首页 / Race Gallery
* 赛事详情页 / Race Page
* 实况大厅 / Live Hall
* 作品列表 / Works
* 作品详情页 / Work Page
* 赛果榜单 / Results
* 评审总结基础页 / Review
* 骑手档案基础版 / Rider Profile
* Cooperation 基础页

### 管理端

* 基础账号能力：GitHub 登录、个人资料补全
* Race Console 赛事控制台基础版
  * Organizer View：创建赛事、管理报名、配置评审、发布赛果
  * Rider View：报名、接入 CA 数据、查看状态、提交成果
  * Judge View：查看作品、参考骑行摘要、评分和评语
* Admin Console 账号与角色控制台基础版
  * 用户列表
  * 用户资料补全状态
  * User.roles 维护
* Screen Console 大屏控制台基础版

### 底层能力

* CA 数据接入基础版（MVP 核心能力）
* 成本 / 进度 / 风险指标基础版
* 成果提交数据管理
* 评审数据管理
* 基础 Evidence 采集、引用和可见性控制
* 基础 Riding Skill 标签
* Projection 展示数据（支撑 Live Hall 和大屏过程展示）
* 基础选手报告、赛事报告和评审总结发布

---

## 3.2 MVP 不包含

MVP 阶段暂不做：

1. 完整开发者社区。
2. 复杂社交关系。
3. 公开认证体系。
4. 众包项目撮合。
5. 企业命题市场。
6. 课程包自动生成。
7. 多组织 / 多学校复杂租户体系。
8. 完整多 CA 标准化协议。
9. 高级 AI 自动评审。
10. 跨赛事长期能力图谱。
11. 独立 Data / Ops Console 和复杂数据运营工作流。

这些能力可以作为后续版本扩展。

---

# 4. 核心用户角色

本章只定义产品角色和主要诉求；角色是否建模为实体、是否新增独立 role、资源动作级权限和作用域规则以 `ary-domain-analysis.v0.3.md` 与 `ary-permission-matrix.md` 为准。

| 角色 / 职责 | 产品定位 | MVP 核心诉求 |
|---|---|---|
| Public Visitor 公众访客 | 未登录或未授权公众，面向赛事观看和传播 | 快速理解 ARY，浏览赛事、实况、作品、赛果和优秀骑手，并进入报名或合作路径 |
| Rider 参赛骑手 | 拥有 `rider` role 的个人参赛用户 | 报名赛事、接入 CA 数据、查看个人进度 / 成本 / 风险、提交作品、查看评审结果和选手报告 |
| Organizer 主办方 | 组织和运营赛事的用户 | 创建发布赛事、管理报名和选手名册、配置提交和评审、查看赛事进度、发布赛果和总结 |
| Judge 评委 | 完成作品评审和骑行能力评价的用户 | 查看分配作品、参考作品和骑行摘要、按 MVP 固定评分项打分并提交评语 |
| Admin 管理员 | 最小系统管理与身份维护用户 | 维护用户 `User.roles`，开通主办方、评委和必要内部维护人员身份，处理必要系统异常 |
| Screen Operator 大屏操作职责 | 现场、课堂或直播大屏操作职责，不新增独立 role | 切换大屏视图，展示实况、榜单、作品和公告，保障现场展示稳定 |
| Data Maintainer 数据维护职责 | 内部数据维护职责，不提供独立 Data / Ops Console | 查看 CA 接入、Session、Projection 和 Report 状态，执行必要重算、重跑和异常数据处理 |

MVP 固定约束：个人参赛、不支持 Team；身份通过 `User.roles` 集合表达，不建立独立 `RoleAssignment` 实体；Screen Operator 和 Data Maintainer 是操作职责，通常由 `organizer` 或 `admin` role 承担。

---

# 5. 核心用户路径

## 5.1 公众观看路径

```text
进入首页
→ 查看 Featured Races
→ 进入 Race Page
→ 查看 Live Hall / Works / Results
→ 查看优秀作品或骑手档案
→ 报名下一场 / 联系合作
```

---

## 5.2 选手参赛路径

```text
进入赛事详情页
→ 查看赛题、规则、赛程
→ 报名赛事
→ 进入 Race Console 的 Rider View
→ 接入 CA 数据
→ 开始骑行
→ 查看个人进度、成本、风险
→ 提交作品
→ 查看评审结果和选手报告
```

---

## 5.3 主办方办赛路径

```text
进入 Race Console 的 Organizer View
→ 创建赛事
→ 配置赛题、规则、时间、提交要求
→ 发布赛事
→ 管理报名
→ 开赛后查看 Live / 数据状态
→ 组织评审
→ 发布榜单
→ 生成评审总结和赛事报告
```

---

## 5.4 评委评审路径

```text
进入 Race Console 的 Judge View
→ 查看待评审作品
→ 打开作品详情
→ 查看 Demo、说明、代码链接、骑行摘要
→ 根据 MVP 固定评分项评分
→ 撰写评语
→ 提交评审
```

---

## 5.5 大屏展示路径

```text
进入 Screen Console
→ 选择赛事
→ 选择 Jumbotron / Billboard 视图
→ 配置主题和展示内容
→ 现场展示
→ 根据赛事阶段切换 Live / 榜单 / 作品 / 公告
```

---

## 5.6 Admin 账号与角色管理路径

```text
进入 Admin Console
→ 查看 GitHub 登录用户
→ 查看资料补全状态
→ 维护用户 User.roles
→ 确认主办方、评委、选手和管理员身份可用
```

---

# 6. 产品信息架构边界

ARY MVP 采用 Gallery-first 信息架构，但具体页面层级、导航结构、页面信息分区和 URL 结构由 `ary-mvp.ia.md` 负责。

本文只保留产品层面的承载边界：

* Public Site：公开展示赛事、实况、作品、赛果、评审总结、骑手档案和合作入口。
* Race Console：按 `organizer`、`rider`、`judge` role 展示办赛、参赛、评审视图。
* Admin Console：由 `admin` role 管理基础账号、个人资料状态和 `User.roles`。
* Screen Console：控制现场、课堂、直播大屏展示。
* Riding Intelligence：支撑 CA 接入、过程指标、Evidence、Projection 和 Report。

---

# 7. 产品能力需求

本章只定义产品级能力和验收口径。页面模块、字段、信息分区和 URL 由 `ary-mvp.ia.md` 负责；领域对象、字段和关系由 `ary-domain-analysis.v0.3.md` 负责；测试用例由 `ary-qa-plan.md` 负责。

## 7.1 Public Site 公开端

| 能力 | 产品要求 | 产品级验收 |
|---|---|---|
| 首页 / Race Gallery | 以赛事资产列表为主体，展示主推赛事组、进行中赛事、最新赛果、优秀作品和优秀骑手 | 公众可在首屏理解当前主推赛事组；2 次点击内进入 Live Hall、赛果或优秀作品；首页不暴露后台结构，也不设置独立 Leaderboards 模块 |
| 赛事详情页 / Race Page | 根据赛事生命周期提供报名、Live、Works、Results、Review 等入口 | 不同赛事状态展示匹配的主 CTA；报名中可报名，进行中可进入实况，已结束可进入赛果、作品和评审总结 |
| 实况大厅 / Live Hall | 展示进行中赛事状态、骑手活动、关键事件和成本 / 进度 / 风险摘要 | 使用 Projection，不直接读取或公开原始 CA Session；过程榜单不作为最终赛果 |
| 作品列表 / Works | 展示某场赛事已公开作品集合 | 公众可查看公开作品、筛选或进入作品详情；获奖或精选作品有明确标识 |
| 作品详情页 / Work Page | 沉淀作品资产、案例资产和评审资产 | 用户可理解作品、查看 Demo / 视频、代码入口、作者、所属赛事、奖项和骑行摘要 |
| 赛果榜单 / Results | 发布赛事最终结果，突出 Agent Riding Skill 榜单 | 最终榜单读取 Award 与 `leaderboard_read_model`；用户可区分作品结果榜和骑行能力榜 |
| 评审总结 / Review | 发布赛后总结和复盘 | 评审总结来自已发布 `review_summary` Report，且可关联赛果、作品和公开证据 |
| 骑手档案 / Rider Profile | 展示骑手参赛、作品、获奖和能力证据 | 骑手档案基于用户资料、报名、作品、奖项、能力标签和公开 Evidence 生成，不做复杂社交主页 |
| Cooperation | 解释 ARY 价值并承接合作转化 | 学生、老师、企业、赞助方和社区用户能理解参赛、办赛、赞助与合作路径 |

首场 MVP 默认 Award Setting：总成绩榜、最佳作品、最佳 Agent Rider、最佳纠偏、最佳成本控制、最佳复盘。

## 7.2 Console 管理端

MVP 管理端由 Race Console、Admin Console 和 Screen Console 组成，不把每个角色拆成独立后台产品。Console 的页面层级、视图结构和 URL 建议由 `ary-mvp.ia.md` 负责。

| 能力 | 产品要求 | 产品级验收 |
|---|---|---|
| Race Console / Organizer View | 支持赛事创建、发布、报名管理、评审配置、榜单发布和总结生成 | 主办方可创建完整赛事、管理报名和选手名册、配置成果提交和评审、发布赛果和生成赛事总结 |
| Race Console / Rider View | 支持报名后查看赛程、进入 ARY 自动生成的 RaceProject、在参赛过程中配置一个或多个 CAConnection、查看接入健康度和提交作品 | 选手可在参赛过程中新增实时 CA 接入，查看个人进度 / 成本 / 风险和证据完整度，提交作品并查看评审结果和报告 |
| Race Console / Judge View | 支持评委查看分配作品、骑行摘要、评分和评语提交 | 评委可按 MVP 固定评分项提交 `scoreResult`、`scoreRiding` 和 `comments` |
| Screen Console | 支持现场、课堂和直播大屏展示 | 操作员可选择赛事、切换 Live / 榜单 / 作品 / 公告和全屏展示；大屏配置不影响公开网页数据 |
| Admin Console | 支持最小账号与角色管理 | Admin 可查看 GitHub 登录用户、资料补全状态并维护 `User.roles`；Admin Console 不承担赛事执行或数据运营 |
| Internal Data Maintenance | 支持 CA 接入、Projection、Report 的最低限度内部维护 | `organizer` 或 `admin` 可查看接入状态、手动重算 Projection、重跑 Report、标记影响公开展示的异常数据 |

MVP 固定评分项只作为评委填写说明，不建模为可配置 Score Rubric / Score Item。作品结果参考完成度、产品理解、技术实现、体验表达、创新性、可展示性；骑行能力参考目标拆解、Agent 协同、纠偏、技术路线判断、成本控制、风险处理和复盘表达。

## 7.3 Riding Intelligence 底层产品能力

| 能力 | 产品要求 | 产品级验收 |
|---|---|---|
| CA Data Ingestion | 参赛过程中登记报名对应 RaceProject 下一个或多个 CAConnection；接入已完成登记和握手的 CAConnection 实时 Session；可关联 GitHub Repo / 代码材料 | 每个已批准 Registration 由 ARY 自动生成 RaceProject；选手可动态注册多个 CA；实时 CA 数据作为骑行证据、Projection 输入和评审参考，不作为参赛资格硬门禁；GitHub 代码材料不能替代实时 CA 接入 |
| Riding Metrics | 生成成本、进度、风险和基础骑行能力摘要 | 指标可用于 Live Hall、过程榜单、评审参考和报告，但不直接替代人工评审 |
| Evidence Store | 保存能力评价背后的证据 | Evidence 可引用 Session Summary、Work、JudgingRecord、GitHub 代码材料等来源；公开端只展示可公开摘要 |
| Projection | 将原始数据转换为前台和后台可用的展示数据 | Live Hall、Race Console 过程区和 Screen Console 优先读取 Projection；Projection 可重算且不作为最终事实源 |
| Report Generator | 生成选手报告、赛事报告和评审总结草稿 | Report 可关联作品、JudgingRecord 或 Evidence；未发布 Report 不进入公开端；`rider_report` 默认不公开 |

## 7.4 产品级硬约束

* Registration 进入 approved 后，ARY 必须幂等生成且仅生成一个 RaceProject。
* 实时 CA 数据是骑行过程证据、Projection 输入和评审参考，不是参赛资格硬门禁；CA 接入失败、无 CA 数据或空骑行不自动取消 Registration 的提交、评审或 Award 资格。
* CAConnection 可在参赛过程中新增；每个 CAConnection 必须先完成登记和握手，之后产生的数据才可进入有效 Projection、Evidence 或 Report 输入。
* MVP 不接受事后手动上传 Session Summary 伪造实时 CA 证据；如作为说明材料引用，必须标记来源、时间和可信度。
* GitHub 只作为登录来源、作品代码入口或 Evidence 外部材料引用，不能替代实时 CA 接入。
* 系统应在评审前识别空骑行、无 CA 数据、空作品、缺必填材料、疑似违规和接入异常，并在 Organizer / Judge 工作流中提示。
* Projection 只服务过程展示和大屏，不作为最终结果事实源。
* 最终赛果读取 Award、Report 或 `leaderboard_read_model`。
* 原始 CA Session 默认不公开，公开端只读取摘要、Evidence、Projection、已公开 Work、已发布 Award、已发布且公开可见的 Report 或公开 Rider Profile。

---

# 8. 核心数据对象

本章只列产品需求中必须识别的核心对象；对象定义、关系、不变量和 UML 以 `ary-domain-analysis.v0.3.md` 为准；数据库表结构后续单独设计。

| 对象 | PRD 保留的产品语义 | 细节权威 |
|---|---|---|
| Race | 一场 Agent Racing 活动，是公开展示、报名、过程展示、评审、赛果和报告的核心内容对象 | `ary-domain-analysis.v0.3.md` |
| User / Account | GitHub 登录并补全资料后的 ARY 用户，通过 `User.roles` 参与不同职责 | `ary-domain-analysis.v0.3.md`、`ary-permission-matrix.md` |
| Registration | User 参加某场 Race 的报名事实，是参赛流程、RaceProject、Work、Evidence、Award 和 rider_report 的追溯中枢 | `ary-domain-analysis.v0.3.md` |
| RaceProject | Registration 对应的本场比赛骑行工作区，由 approved Registration 自动生成，可关联 GitHub Repo 作为作品代码材料入口，承载多个 CAConnection 的聚合实时 CA 接入健康度 | `ary-domain-analysis.v0.3.md`、`ary-ca-integration-spec.md` |
| CAConnection | RaceProject 下的单个 CA / connector / 外部 CA Project 登记与运行接入实例，承载单个 CA 的实时接入状态 | `ary-domain-analysis.v0.3.md`、`ary-ca-integration-spec.md` |
| Session | CAConnection 下的一次实时 CA 协同过程，用于生成摘要、指标和 Evidence | `ary-domain-analysis.v0.3.md`、`ary-ca-integration-spec.md` |
| Work | Registration 产生的作品资产，进入展示、评审、榜单和 Evidence | `ary-domain-analysis.v0.3.md` |
| JudgeAssignment / JudgingRecord | 评审分配和评审事实，支撑评分、评语、榜单草稿和报告 | `ary-domain-analysis.v0.3.md`、`ary-permission-matrix.md` |
| Award / Leaderboard | 奖项结果与最终榜单读取模型，表达赛后结果 | `ary-domain-analysis.v0.3.md` |
| Evidence | 支撑骑行能力评价、报告和公开摘要的证据事实 | `ary-domain-analysis.v0.3.md`、`ary-permission-matrix.md` |
| Review Flag / Review Readiness | 评审前风险提示和材料完整度检查，用于提示空骑行、无 CA 数据、空作品、缺材料、疑似违规和接入异常 | `ary-domain-analysis.v0.3.md`、`ary-mvp.ia.md` |
| Report | 评审后形成的选手报告、赛事报告和评审总结 | `ary-domain-analysis.v0.3.md` |
| Projection / Read Model | 过程展示和页面读取数据，可重算，不作为最终事实源 | `ary-domain-analysis.v0.3.md`、`ary-mvp.ia.md` |

---

# 9. 状态定义

状态枚举、状态语义和不变量以 `ary-domain-analysis.v0.3.md` 为准。PRD 仅保留产品验收必须关注的状态族：

| 状态族 | 产品用途 | 关键产品约束 |
|---|---|---|
| Race Status | 驱动 Race Page、Live Hall、提交、评审、赛果和归档体验 | 赛事应覆盖创建、发布、报名、进行、提交、评审、结束和归档闭环 |
| Registration Status | 驱动报名审核、参赛工作区生成和后续流程准入 | Registration approved 后由 ARY 自动生成 RaceProject；CA 接入状态不驱动 Registration withdrawn |
| RaceProject Aggregate Ingestion Status | 驱动聚合 CA 接入健康度展示、Projection 输入、证据完整度和异常处理 | 应覆盖 not_configured、connected、active、failed；failed / not_configured 进入评审前风险提示，不自动取消提交、评审或 Award 资格 |
| CAConnection Ingestion Status | 驱动单个 CA 接入状态展示、connector 异常定位和 Projection 输入 | 应覆盖 not_configured、connected、active、failed；单个 failed 只表达连接异常和证据缺口 |
| CAConnection Acceptance Window | 驱动参赛过程中 CAConnection 新增和数据接收边界 | Rider 可在参赛过程中新增 CAConnection；未登记、未握手、归属错误或被禁用的连接数据不得进入有效 Projection、Evidence 或 Report 输入 |
| Work Status | 驱动作草稿、提交、锁定和公开展示 | 获奖由 Award 推导，不在 Work Status 中重复保存 |
| Review Readiness / Review Flag | 驱动评审前风险提示、材料完整度提示和 Judge 评审上下文 | 空骑行、无 CA 数据、空作品、缺必填材料、疑似违规和接入异常应提示 Organizer / Judge，但不自动替代人工评审 |
| Report Status | 驱动报告生成、审核和公开发布 | 未发布 Report 不出现在 Public Site |

---

# 10. 权限要求

本章只描述角色级访问原则；资源动作级权限矩阵、作用域和接口鉴权规则以 `ary-permission-matrix.md` 为准。

| 角色 / 职责 | 产品级访问原则 |
|---|---|
| Public | 只能访问已公开、已发布的赛事、实况、作品、赛果、评审总结、骑手档案和合作页 |
| Rider | 只能管理自己的报名、RaceProject、Work、报告和可见骑行摘要 |
| Organizer | 只能管理自己负责的 Race 及其报名、提交、评审、榜单、报告和展示 |
| Judge | 只能访问分配给自己的评审任务、相关作品和 Evidence 摘要 |
| Admin | 可以维护用户 `User.roles`，并进行必要系统管理和异常处理 |
| Internal Data Maintenance | 由 `organizer` 或 `admin` 承担，只处理接入状态、Projection、Report 和异常展示数据 |

MVP 权限硬约束：后台访问必须登录；多 role 用户按授权范围切换视图；原始 CA Session、未公开作品、未发布评分和未发布 Report 不得被公开端或未授权用户读取。

---

# 11. MVP 优先级

## 11.1 P0：第一场赛事必须具备

### 公开端

* 首页 / Race Gallery
* 赛事详情页
* 实况大厅基础版
* 作品列表
* 作品详情页
* 赛果榜单页
* 骑手档案基础版
* 评审总结基础页
* Cooperation 基础页

### 管理端

* 基础账号能力：GitHub 登录、资料补全
* Admin Console 基础版：用户列表、资料补全状态、Admin 维护 User.roles
* Race Console 基础版
  * Organizer View：创建赛事、报名管理、评审配置、榜单发布
  * Rider View：CA 接入、骑行状态、成果提交
  * Judge View：作品查看、骑行摘要、评分表单
* Screen Console 基础配置

### 底层

* 基础 CA 数据接入
* 基础成本 / 进度 / 风险指标
* 基础 Evidence 采集、引用和可见性控制
* 基础 Riding Skill 标签
* 基础 Projection
* 基础选手报告
* 基础赛事报告
* 基础评审总结发布

---

## 11.2 P1：体现 ARY 差异

### 公开端

* Featured Riders
* 骑手档案展示增强
* 骑行能力榜
* 评审总结页体验增强
* 优秀作品 Case Card

### 管理端

* 评审总结草稿生成与编辑增强
* Jumbotron / Billboard 高级配置
* 风险事件管理

### 底层

* Evidence Store 增强能力
* Riding Skill 标签增强
* Report Generator 增强能力

---

## 11.3 P2：后续平台化

### 公开端

* 多赛事专题
* 公开认证页
* 社区化骑手主页
* 课程案例库

### 管理端

* 多组织 / 多学校管理
* 赞助商后台
* 企业命题后台
* 课程包生成
* 众包项目撮合

### 底层

* 多 CA 标准化接入
* 高级能力画像
* 跨赛事 Rider Graph
* 推荐与匹配系统

---

# 12. 成功指标

## 12.1 首场赛事运行指标

* 报名人数
* 确认参赛人数
* 实际开赛人数
* 成功接入 CA 数据人数
* 提交作品数
* 完成评审作品数
* 公开作品数
* 生成选手报告数
* 生成赛事报告数
* 基础报告发布完成率
* 发布评审总结数

---

## 12.2 公开传播指标

* 首页访问量
* Race Page 访问量
* Live Hall 访问量
* 作品详情访问量
* 赛果页访问量
* 分享次数
* 合作咨询数
* 下一场报名转化数

---

## 12.3 教学与能力指标

* 有效骑行数据覆盖率
* 平均成本
* 平均进度
* 高风险选手比例
* 完成复盘比例
* 评委评分完成率
* 基础 Evidence 覆盖率
* 骑行能力标签生成率
* 选手报告阅读率

---

## 12.4 商业验证指标

* 企业 / 学校合作线索数
* 赞助咨询数
* 办赛咨询数
* 可转化案例数
* 可课程化案例数
* 优秀骑手候选数

---

# 13. 验收标准

ARY MVP 验收时，应满足以下条件。

## 13.1 赛事闭环验收

* 主办方可以通过 Race Console 创建并发布一场赛事。
* 用户可以通过 GitHub 登录并补全个人资料。
* Admin 可以维护用户的 `User.roles`。
* 用户可以在公开首页看到该赛事。
* 选手可以报名并进入 Race Console 的 Rider View。
* 选手可以完成实时 CA 数据接入。
* 选手可以提交成果。
* 评委可以评分并提交评语。
* 主办方可以发布榜单。
* Screen Console 可以展示赛事实况、榜单、作品或公告。
* 公众可以查看赛果、作品和评审总结。

---

## 13.2 Gallery-first 验收

* 首页以赛事展示为主体，不以后台功能为主体。
* 公众用户可以在 2 次点击内进入当前主推赛事。
* 公众用户可以在 2 次点击内进入 Live Hall。
* 公众用户可以在 2 次点击内查看优秀作品和赛果。
* Race Console、Admin Console 和 Screen Console 入口与公开端主内容分离。

---

## 13.3 Riding Intelligence 验收

* 系统可以在 Registration approved 后幂等生成 RaceProject，并在参赛过程中登记每个 RaceProject 下一个或多个 CAConnection，实时接入已登记且握手成功的 CAConnection 基础骑行数据。
* 系统可以在评审前识别空骑行、无 CA 数据、空作品、缺必填材料、疑似违规和接入异常，并向 Organizer / Judge 展示风险提示。
* 系统可以生成成本、进度、风险基础指标。
* 系统可以采集、引用和控制基础 Evidence 可见性。
* 系统可以生成基础 Riding Skill 标签。
* 系统可以展示赛事级 Projection。
* 系统可以为评审提供骑行摘要。
* 系统可以生成基础选手报告和赛事报告。
* 系统可以发布基础评审总结。

---

## 13.4 资产沉淀验收

* 每场赛事结束后有公开 Race Page。
* 每场赛事结束后有赛果页。
* 每个公开作品有 Work Page。
* 获奖或优秀骑手有 Rider Profile。
* 主办方可以导出或发布赛事总结。
* 至少部分作品可沉淀为案例资产。

---

# 14. 工程就绪要求 / Non-functional Requirements

本章定义 ARY MVP 进入架构设计、研发计划和上线准备前必须满足的产品级工程要求。具体技术方案、接口契约、重试策略、告警策略和部署运维流程由后续架构与运维文档展开。

## 14.1 可用性

* 赛事进行中，Public Site、Live Hall 和 Screen Console 不应因单个选手 RaceProject 聚合 CA 接入失败或无 CA 数据而整体不可用。
* 单个 Registration 的 CA 接入失败、无 CA 数据或空骑行应形成评审前风险提示，但不应影响其他选手、赛事公开展示、Projection 重建和大屏展示。
* Public Site、Live Hall、Screen Console、Race Console 的 P0 路径应支持首场赛事完整闭环。

---

## 14.2 性能

### 响应时间

* 公开页首屏目标响应时间：1s 内。
* Live Hall 数据刷新目标：3s 内。
* Screen Console 等页面切换加载首屏目标响应时间：1s 内。

### 负载

* MVP 应支持同时在线 200 用户访问公开端、Live Hall、Results、Works 和 Rider Profile 等公开页面。
* 赛事进行中的 Live Hall 和 Screen Console 应优先保证稳定展示，允许读取 Projection 或最近一次稳定展示数据。

---

## 14.3 安全

* MVP 使用 GitHub 登录作为账号入口。
* 后台访问必须经过登录和 `User.roles` 权限校验。
* Race Console、Admin Console、Screen Console 的访问边界必须隔离。
* 公开数据、内部数据、原始 CA Session、未发布评分、未发布 Report 必须隔离。
* 资源动作级权限以 `ary-permission-matrix.md` 为准。

---

## 14.4 隐私

* 原始 CA Session 默认不公开。
* 公开端只读取 Projection、Evidence 摘要、已公开 Work、已发布 Award、已发布且公开可见的 Report 或公开 Rider Profile。
* Evidence 必须支持可见性控制。
* 未公开作品、未发布评审结果、未发布报告不应出现在 Public Site。

---

## 14.5 可观测性

* CA 接入状态必须可追踪。
* Projection 生成、更新时间和失败状态必须可追踪。
* Report 生成、审核、发布状态必须可追踪。
* 主办方或内部维护人员应能识别影响 Live Hall、大屏或报告生成的关键异常。

---

## 14.6 可恢复

* 关键核心事实数据不应依赖 Projection 作为唯一来源。
* Projection 失败不影响核心事实数据。
* Projection 必须可重建。
* Report 生成失败时，允许手动重跑或人工编辑发布。
* 大屏展示失败时，可切换到最近一次稳定 Projection 或静态榜单 / 公告。

---

# 15. 风险与约束

## 15.1 CA 数据接入不稳定

风险：

* 不同 CA 的 Session 数据格式不统一。
* 参赛过程中 CAConnection 登记、握手和实时接入可能受权限和平台限制影响。
* 部分选手无法完成接入。

应对：

* CA 接入状态不作为参赛资格硬门禁；接入失败、无 CA 数据或空骑行进入评审前风险提示。
* MVP 不接受事后上传 Session Summary 伪造实时 CA 证据；如作为说明材料引用，必须标记来源、时间和可信度。
* 优先接入少数主流 CA，并在参赛前提供清晰登记和握手校验路径，参赛过程中仍允许新增 CAConnection。
* 数据指标先做摘要，不依赖公开完整原始数据。

---

## 15.2 评审复杂度过高

风险：

* 如果评分参考项过多，评委负担过重。
* 如果自动评分过早介入，可信度不足。

应对：

* MVP 采用人工评分为主。
* 骑行指标作为评审参考，不直接替代评委。
* MVP 固定评分项控制在可完成范围内。
* 评审总结由系统生成草稿，主办方确认发布。

---

## 15.3 首页信息过载

风险：

* Gallery 首页可能堆叠过多模块。
* 新用户难以理解主线。

应对：

* 首页首屏可突出一组 Featured Races；首场赛事只有一场时按单场展示。
* Live、Works、Results、Riders 分层展示。
* 管理入口弱化，不干扰公众浏览。
* 保持最短路径进入当前赛事。

---

## 15.4 过早平台化

风险：

* 过早做社区、认证、众包、课程市场，导致 MVP 分散。
* 核心赛事闭环没有打磨好。

应对：

* MVP 聚焦第一场标杆赛。
* 所有功能优先服务赛事闭环。
* P2 能力暂不进入 MVP 交付范围。

---

# 16. 里程碑建议

## M1：公开端可展示

目标：

* 首页 / Race Gallery
* Race Page
* Works
* Results
* Cooperation

验收：

* 能展示一场赛事。
* 能展示作品和赛果 mock。
* 能完成公开浏览路径。

---

## M2：赛事管理可运行

目标：

* 基础账号能力
* Race Console 基础版
  * Organizer View
  * Rider View
  * Judge View
* Admin Console 基础版

验收：

* 可以创建赛事。
* 可以通过 GitHub 登录并补全个人资料。
* Admin 可以维护用户的 `User.roles`。
* 可以报名。
* 可以提交作品。
* 可以评审。
* 可以发布榜单。

---

## M3：实况与大屏可观看

目标：

* Live Hall
* Screen Console
* Jumbotron / Billboard 基础视图

验收：

* 可以展示赛事状态。
* 可以展示选手进度和事件流。
* 可以进行现场大屏展示。

---

## M4：骑行监测可用

目标：

* CA 数据接入基础版
* Riding Metrics
* 基础 Evidence 采集、引用和可见性控制
* Projection
* 基础风险提示

验收：

* 可以实时接入报名 / RaceProject 对应的骑行数据。
* 可以生成成本、进度、风险摘要。
* 可以采集、引用并控制基础 Evidence 可见性。
* 可以支撑 Live Hall 和评审摘要。

---

## M5：报告与资产沉淀

目标：

* Work Page 完整化
* Rider Profile 基础版收口
* 基础 Riding Skill 标签收口
* Evidence 引用收口
* Report Generator 基础能力收口
* 评审总结发布

验收：

* 可以生成选手报告。
* 可以生成赛事报告。
* 可以发布评审总结。
* 可以沉淀优秀作品和骑手档案。
* 骑手档案可以展示基础 Riding Skill 标签。
* 报告和骑手档案可以引用基础 Evidence。

---

# 17. 一句话总结

ARY MVP 要完成的不是一个普通 Hackathon 网站，而是一套以赛事 Gallery 为公开主体、以 Race Console 完成赛事执行、以 Admin Console 完成基础账号与角色管理、以 Screen Console 完成现场展示、以 Riding Intelligence 支撑 CA 接入和过程评审的 Agent Racing 最小闭环。

它的最终目标是：

```text
让赛事可观看，
让作品可传播，
让过程可评审，
让能力可证明，
让案例可沉淀，
让平台可转化。
```
