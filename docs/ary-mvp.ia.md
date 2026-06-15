# ARY MVP 信息架构文档

版本：v0.3
文档类型：Information Architecture
上游入口：`ary-mvp.prd.md`
领域基线：`ary-domain-analysis.v0.3.md`
权限矩阵：`ary-permission-matrix.md`

---

# 1. 文档目的

本文档是 `ary-mvp.prd.md` 的 IA 附件，定义 ARY MVP 阶段的信息架构，明确产品体验面、Race 上下文、页面 / 工作台层级、导航逻辑、页面状态和信息消费关系。

职责边界：

* `ary-mvp.prd.md` 是产品语义入口和权威来源。
* `ary-domain-analysis.v0.3.md` 是领域语义附件和概念基线。
* `ary-permission-matrix.md` 是页面访问、角色视图和信息可见性的权限附件。
* 本文只负责产品体验面、Race 上下文、页面层级、导航结构、页面信息分区、页面状态、信息消费关系和 URL 建议，不重复定义领域模型、功能验收或接口契约。

ARY MVP 的核心不是先构建完整社区平台，而是优先支撑第一场可复制、可传播、可沉淀的 Agent Racing 标杆赛。产品信息架构应服务于三个目标：

1. 让公众以最短路径理解赛事、观看赛事、查看作品与赛果。
2. 让选手、评委、主办方分别进入各自的工作台完成参赛、提交、评审和管理。
3. 让骑行监测能力沉淀为可展示、可评审、可复盘的 Agent Riding Skill 证据。

因此，ARY MVP 采用 **Gallery-first 信息架构**。本文按以下概念层级组织：

```text
产品体验面
→ Race 上下文
→ 页面 / 工作台视图
→ 页面模块与信息分区
→ 信息类型与消费关系
→ 状态 / 权限 / 可见性规则
```

其中：

* Public Site、Race Console、Admin Console、Screen Console、Screen Display 是用户可进入或可观看的产品体验面。
* Race 是 Public Site 和 Race Console 的核心上下文。
* Organizer / Rider / Judge / Admin 是访问视角和权限，不是独立业务实体。
* Projection、Evidence、Report、Read Model 是页面消费的信息类型，不是应用导航层。
* CA 接入与大屏展示是 ARY 核心能力，必须进入 MVP 闭环。

---

# 2. 核心信息架构原则

## 2.1 公开端以 Gallery 为主体

ARY 首页不是管理后台，也不是功能模块索引，而是一个面向公众的赛事展示入口。

公开端第一优先级是回答：

* 现在有哪些赛事？
* 哪场赛事正在进行？
* 谁参加了？
* 有哪些优秀作品？
* 谁赢了？
* 谁骑得好？
* 我如何报名下一场赛事？
* 我如何发起或赞助赛事？

公众用户的主路径应为：

```text
首页 Race Gallery
→ 进入某场 Race
→ 查看赛题 / 实况 / 作品 / 赛果 / 评审总结
→ 认识优秀 Rider
→ 报名下一场 / 联系办赛 / 赞助合作
```

---

## 2.2 管理信息另辟入口

赛事创建、报名管理、选手名册、成果提交、评审配置、数据接入、报告生成等管理信息，不进入公开首页主结构。

MVP 阶段不把每个角色都拆成独立后台产品，而是通过三个 Console 承载：

```text
Race Console
├─ Organizer View
├─ Rider View
└─ Judge View

Admin Console

Screen Console
```

公开端负责展示和转化，管理端负责组织和执行。

Admin Console 只承载基础账号、个人资料状态和 `User.roles` 管理，不承担赛事执行、CA 接入维护或数据运营职责。

Data / Ops Console 暂不进入 MVP 信息架构；CA 接入状态、Projection 重算和报告重跑先作为内部维护能力或 Race Console 的最小状态提示。

---

## 2.3 Race 是核心内容对象

ARY 的核心内容对象不是“功能模块”，而是一场场 Race。

每场 Race 根据生命周期状态呈现不同重点：

```text
报名中：赛事介绍、赛题、规则、赛程、报名入口
进行中：实况大厅、Jumbotron、选手动态、进度、风险
提交中：作品提交、已提交作品、提交提醒
评审中：已提交作品、评审进度、评委信息、结果公布时间
已结束：赛果、排行榜、优秀作品、评审总结、赛事复盘
```

这意味着 Race Page 是 ARY 公开端最重要的二级页面。

---

# 3. App-level IA 应用层级结构

本章定义 ARY MVP 的应用级信息层级。它回答“用户可以进入哪些体验面、在什么上下文中工作或观看”，而不是定义具体数据库结构或接口。

## 3.1 产品体验面

ARY MVP 对用户暴露五类体验面：

```text
ARY
├─ Public Site 公开端
│  ├─ Home / Race Gallery 首页
│  ├─ Race Page 赛事详情页
│  │  ├─ Live Hall 实况大厅
│  │  ├─ Works 作品列表
│  │  ├─ Results 赛果榜单
│  │  └─ Review 评审总结
│  ├─ Work Page 作品详情页
│  ├─ Rider Profile 骑手档案
│  ├─ Cooperation 介绍与合作
│  └─ Auth Entry 登录入口
│
├─ Race Console 赛事工作台
│  ├─ Console Home 管理入口
│  └─ Race Workspace 单场赛事工作空间
│     ├─ Organizer View 主办方视图
│     ├─ Rider View 选手视图
│     └─ Judge View 评委视图
│
├─ Admin Console 账号与角色控制台
│  ├─ Users 用户列表
│  ├─ Profile Completion 资料补全状态
│  └─ User.roles 角色维护
│
├─ Screen Console 大屏控制台
│  ├─ Race Selection 赛事选择
│  ├─ Display Mode 展示模式
│  ├─ Theme / Calibration 主题与校准
│  └─ Display Control 展示控制
│
└─ Screen Display 大屏展示视图
   ├─ Jumbotron 主大屏
   ├─ Billboard 信息看板
   ├─ Live Display 实况展示
   ├─ Leaderboard Display 榜单展示
   ├─ Works Display 作品展示
   └─ Announcement Display 公告展示
```

页面层级说明：

* Public Site 是公开信息消费与传播入口。
* Race Console 是赛事执行入口，以单场 Race Workspace 为核心上下文，按 `organizer`、`rider`、`judge` role 展示不同工作台。
* Admin Console 只处理账号、资料状态和 `User.roles`，不承载赛事执行。
* Screen Console 是大屏操作入口，不混入 Race Console。
* Screen Display 是展示输出面，受 Screen Console 控制，不承担配置工作台职责。
* Riding Intelligence 不作为应用体验面或页面导航层，而是通过 Projection、Evidence、Report 和 Read Model 被页面消费。

## 3.2 Race 上下文

Race 是 ARY MVP 的核心上下文。公开端、Race Console 和 Screen Console 都围绕同一场 Race 组织信息。

```text
Race Context
├─ Public Race Page
│  ├─ Overview
│  ├─ Rules / Schedule
│  ├─ Live
│  ├─ Riders
│  ├─ Works
│  ├─ Results
│  └─ Review
│
├─ Race Workspace
│  ├─ Organizer View
│  │  ├─ Overview
│  │  ├─ Settings
│  │  ├─ Registrations
│  │  ├─ Riders
│  │  ├─ CA Status
│  │  ├─ Works
│  │  ├─ Judges
│  │  ├─ Judging
│  │  ├─ Awards
│  │  ├─ Reports
│  │  └─ Maintenance
│  ├─ Rider View
│  │  ├─ Registration
│  │  ├─ CA Setup
│  │  ├─ Riding Status
│  │  ├─ Work Submission
│  │  ├─ Review Result
│  │  └─ Rider Report
│  └─ Judge View
│     ├─ Assigned Works
│     ├─ Reviewing
│     └─ Submitted Reviews
│
└─ Screen Context
   ├─ Selected Race
   ├─ Display Mode
   └─ Display Output
```

Race 上下文规则：

* Work Page 和 Rider Profile 可以作为独立传播页，但必须保留回到 Race 的上下文入口。
* Race Console 内部必须始终展示当前 Race，避免跨赛事误操作。
* Screen Console 必须显式展示当前 Race 和 Display Mode。
* Organizer / Rider / Judge 是同一 Race Workspace 下的访问视角，不是三个独立产品。

## 3.3 信息类型与消费关系

Riding Intelligence 属于信息能力层，不是导航层。IA 只关心页面消费哪些信息，以及这些信息在产品中以什么可见性出现。

```text
Information Layer
├─ Core Facts 事实源
│  ├─ Race
│  ├─ Registration
│  ├─ RaceProject
│  ├─ CAConnection
│  ├─ Session
│  ├─ Work
│  ├─ JudgingRecord
│  └─ Award
│
├─ Evidence 证据
│  ├─ Session Summary
│  ├─ Work
│  ├─ JudgingRecord 摘要
│  └─ sourceRef 外部材料引用
│
├─ Projection 过程投影
│  ├─ race_progress_projection
│  ├─ registration_status_projection
│  ├─ current_leaderboard_projection
│  └─ screen_feed_projection
│
├─ Report / Read Model 赛后读取模型
│  ├─ rider_report
│  ├─ race_report
│  ├─ review_summary
│  └─ leaderboard_read_model
│
└─ Page Consumers 页面消费出口
   ├─ Live Hall / Screen Display 读取 Projection
   ├─ Work Page / Rider Profile / Judge View 读取 Evidence 摘要
   ├─ Results 读取 Award / leaderboard_read_model / Report
   └─ Review 读取 review_summary / Award / 公开 Evidence
```

信息消费规则：

* Core Facts 是业务事实源；页面不应把 Projection 当作事实源。
* Projection 只服务过程展示，不作为最终结果。
* Evidence 通过 `sourceRef` 引用来源，公开端只展示可公开摘要。
* Session Summary 只能来自实时 CA Session 摘要，不接受事后手动上传伪造实时 CA 证据。
* GitHub 只作为登录来源、作品代码入口或外部材料引用，不替代实时 CA 接入。
* Report 表达评审后的总结和结果，不表达实时过程状态。

---

# 4. Navigation Model 导航模型

## 4.1 顶层导航

公开端顶层导航服务公众浏览和转化。

```text
Public Header
├─ Races / Home
├─ Works
├─ Riders
├─ Cooperation
└─ Login / Console Entry
```

导航规则：

* 未登录用户看到公开导航和登录入口。
* 已登录用户额外看到 Console Entry。
* Console Entry 不在公开页面中承担主视觉位置，避免干扰 Gallery-first。
* Home 即 Races 列表 / Race Gallery，不再与 Races 拆成两个顶层入口。
* Results 是单场 Race 的下级信息，只在 Race Page、Race Card 或赛后模块中作为上下文入口出现。
* Cooperation 合并 About 信息和合作转化，不再拆出独立 About 顶层入口。
* 当前主推赛事或主推赛事组的 Live、Works、Results 入口可在 Home / Race Page 中作为上下文入口出现。

---

## 4.2 Race Page 内部导航

Race Page 是单场赛事的公开承载页，内部导航应围绕赛事状态动态组织。

```text
Race Page Navigation
├─ Overview
├─ Rules / Schedule
├─ Live
├─ Riders
├─ Works
├─ Results
└─ Review
```

状态导航规则：

* 报名中：Overview、Rules / Schedule、报名 CTA 优先。
* 进行中：Live、Riders、Works、阶段公告优先。
* 提交中：Works、提交状态、截止提醒优先。
* 评审中：Works、评审进度、结果公布时间优先。
* 已结束：Results、Review、Winning Works、Rider Profile 优先。
* 未发布 Results / Review 不进入公开导航。

---

## 4.3 Console 导航

Console 使用独立入口，不进入公开端主导航主体。

```text
Console Shell
├─ Race Console
│  ├─ Console Home
│  └─ Race Workspace
│     ├─ Organizer View
│     ├─ Rider View
│     └─ Judge View
├─ Admin Console
└─ Screen Console
```

多角色导航规则：

* 用户可拥有多个 role。
* Console Home 根据 `User.roles` 展示可进入的视图。
* `rider` 进入 Rider View。
* `judge` 进入 Judge View。
* `organizer` 进入 Organizer View，并可进入 Screen Console。
* `admin` 进入 Admin Console，并可承担必要系统管理和 Screen Console 操作。
* 页面访问、资源动作和视图可见性以 `ary-permission-matrix.md` 为准。

---

## 4.4 Console 内部导航

### Race Console / Organizer View

```text
Organizer Sidebar
├─ Overview
├─ Settings
├─ Registrations
├─ Riders
├─ CA Status
├─ Works
├─ Judges
├─ Judging
├─ Awards
├─ Reports
└─ Maintenance
```

### Race Console / Rider View

```text
Rider Sidebar
├─ Registration
├─ CA Setup
├─ Riding Status
├─ Work Submission
├─ Review Result
└─ Rider Report
```

### Race Console / Judge View

```text
Judge Sidebar
├─ Assigned Works
├─ Reviewing
└─ Submitted Reviews
```

### Admin Console

```text
Admin Sidebar
├─ Users
├─ Profile Completion
└─ User.roles
```

### Screen Console

```text
Screen Sidebar
├─ Race Selection
├─ Jumbotron
├─ Billboard
├─ Live
├─ Leaderboard
├─ Works
├─ Announcement
├─ Theme / Calibration
└─ Fullscreen Output
```

---

## 4.5 面包屑与上下文导航

建议页面上下文导航：

```text
Race Context
Home / Races / {Race}

Work Context
Home / Races / {Race} / Works / {Work}

Console Context
Console / Race Console / {Race} / {View}

Screen Context
Console / Screen / {Race} / {Mode}
```

导航原则：

* 公开端优先使用赛事上下文，而不是后台模块上下文。
* Console 内部必须保留当前 Race 上下文，避免跨赛事误操作。
* Screen Console 必须清晰展示当前 Race 和当前 Display Mode。

---

# 5. Page-level IA 页面级信息架构

本章定义 UI / UX 设计时可直接使用的页面信息层级。产品语义以 PRD 为准；领域字段、权限可见性和最终视觉字段分别以领域基线、权限矩阵和后续设计稿为准。

## 5.1 Public Site 页面信息层级

| 页面 | 首屏主信息 | 主体信息 | 辅助信息 | 主 CTA |
|---|---|---|---|---|
| Home / Race Gallery | Featured Races、赛事状态、主 CTA、Live Race Switcher | Latest Results、Featured Works | Featured Riders、Past Races、合作入口 | 进入赛事 / Live / Results / 合作 |
| Race Page | Race title、状态、当前阶段、状态 CTA | Overview、Rules、Schedule、Riders、Works、Results、Review | 公告、下一场 CTA、合作入口 | 报名 / 进入 Live / 查看 Results |
| Live Hall | Race status、阶段进度、关键指标 | Rider Activity、Event Stream、Current Leaderboard、Risk | Screen Entry、公告 | 进入大屏 / 查看 Works |
| Works | Race context、筛选排序、作品列表 | Work Cards、Featured Works | 奖项 / 精选标识 | 进入 Work Page |
| Work Page | Work title、作者、Demo / 视频、奖项 | 作品说明、技术方案、骑行过程摘要、Evidence 摘要 | 评委点评、所属赛事、作者档案 | 查看 Demo / 查看作者 |
| Results | Race result summary、Award Leaderboards | Winning Works、Riding Skill Highlights | Review Entry、分享入口 | 查看 Review / Work |
| Review | Review Summary、获奖说明 | Featured Cases、Judge Comments、Evidence Highlights | Next Race Suggestion | 查看 Results / Works |
| Rider Profile | Rider 基础信息、代表作品、能力标签 | 参赛记录、作品记录、获奖记录、Evidence 摘要 | 成本 / 进度 / 风险表现 | 查看作品 / 查看赛事 |
| Cooperation | ARY 说明、价值主张 | 参赛、办赛、赞助、合作路径 | Contact | 联系合作 |

---

## 5.2 Console 页面信息层级

| 页面 / 视图 | 首屏主信息 | 主体信息 | 辅助信息 | 主 CTA |
|---|---|---|---|---|
| Console Home | 可用 role 入口、待处理事项 | 最近赛事、我的任务、系统提示 | 权限说明 | 进入对应 Console |
| Organizer Overview | Race 状态、报名 / 提交 / 评审概览 | 关键任务、风险、公告、最近活动 | Internal Maintenance 状态 | 编辑赛事 / 管理报名 |
| Race Settings | Race 基础信息、状态、可见性 | 赛题、规则、赛程、提交要求、奖项设置 | 发布状态、修改记录 | 保存 / 发布 |
| Registrations | 报名列表、审核状态 | 申请信息、资料状态、审核动作 | 筛选 / 批量处理 | 通过 / 拒绝 |
| Riders | 选手名册、CA 接入状态 | Registration、RaceProject、Work 状态 | 风险提示 | 查看选手 |
| CA Status | RaceProject 自动生成状态、多个 CAConnection 实时接入状态 | 聚合接入健康度、证据缺口、单个连接状态、最近 Session 摘要 | 作品代码材料绑定状态 | 查看状态 / 内部处理 |
| Works Management | 提交作品、公开状态 | Work 列表、锁定、隐藏、发布 | 缺失项提示 | 锁定 / 发布 |
| Judge Assignment | 评委列表、待分配作品 | 分配关系、评审状态 | assignedBy 审计信息 | 分配 / 调整 |
| Judging Progress | 评审完成率、待处理项 | JudgingRecord 摘要、评分状态 | 提醒 / 异常 | 查看评审 |
| Awards / Leaderboard | Award 草稿、发布状态 | 排名、奖项名称、关联 Work / Registration | decisionReason | 发布 / 撤回 |
| Reports | Report 状态 | rider_report、race_report、review_summary | Evidence / Award 引用 | 生成 / 编辑 / 发布 |
| Rider View | 当前 Race、报名状态、CA 状态 | 骑行状态、Work Submission、Review Result、Rider Report | 风险提示、截止时间 | 接入 CA / 提交作品 |
| Judge View | 分配作品、评审进度 | Work Detail、Evidence Summary、Score Form、Comments | 提交状态 | 提交评审 |
| Admin Console | 用户列表、资料状态 | User.roles 维护 | 最近登录 / 异常账号 | 更新 roles |
| Screen Console | 当前 Race、当前 Display Mode | Jumbotron、Billboard、Live、Leaderboard、Works、Announcement | Theme、Calibration、Fallback | 全屏展示 / 切换模式 |

---

## 5.3 Riding Intelligence 信息进入页面的方式

| 信息类型 | 页面入口 | 展示方式 |
|---|---|---|
| Projection | Live Hall、Screen Console、Organizer Overview | 指标、事件流、状态卡、过程榜单、大屏 feed |
| Evidence | Work Page、Rider Profile、Review、Judge View、Report | 摘要、引用、证据卡、评审参考 |
| Report | Review、Rider View、Organizer Reports、Results | 已发布总结、个人报告、赛事报告 |
| Award / Leaderboard | Results、Work Page、Rider Profile、Screen Console | 榜单、奖项标识、获奖说明 |
| CA Ingestion Status | Rider View、Organizer CA Status、Internal Maintenance | RaceProject 聚合接入健康度、单个 CAConnection 状态、失败状态、最近同步 |

---

# 6. State / Permission / Visibility Rules 状态、权限与可见性规则

## 6.1 页面状态规则

| 状态对象 | 状态 | IA 行为 |
|---|---|---|
| Race | draft | 不进入 Public Site；Organizer 可编辑 |
| Race | published / registration | Race Page 公开；报名 CTA 优先 |
| Race | running | Live Hall、Screen Console、过程 Projection 优先 |
| Race | submitting | Work Submission、提交提醒、已提交作品优先 |
| Race | judging | Works、评审进度、结果公布时间优先 |
| Race | completed | Results、Review、Winning Works、Rider Profile 优先 |
| Race | archived | 作为 Past Race 和案例资产展示 |
| Registration | submitted | Rider 可查看报名状态；Organizer 可审核 |
| Registration | approved | ARY 自动生成 RaceProject；Rider 可进入参赛工作区，并在参赛过程中配置一个或多个 CAConnection |
| Registration | rejected | Rider 显示未通过状态，不进入参赛流程 |
| Registration | withdrawn | Rider 显示退赛 / 取消参赛状态，不进入提交、评审、Award 流程 |
| RaceProject | not_configured | Rider View 显示 CA Setup 和证据缺口提示，但不阻断 Work Submission |
| RaceProject | connected / active | 显示已登记 CAConnection 和 Riding Status；Live Hall 可消费 Projection |
| RaceProject | failed | 显示聚合 CA 接入异常，进入评审前风险提示；单个 CAConnection failed 作为连接异常展示 |
| Work | draft | 仅 Rider 自己和授权 Organizer 可见 |
| Work | submitted | 可进入评审和 Organizer 管理 |
| Work | locked | Rider 不可继续编辑 |
| Work | hidden | 不进入 Public Works |
| Report | draft / generated / reviewed | 不进入 Public Site |
| Report | published | Review / Rider Report / Race Report 可按权限展示 |

---

## 6.2 CA 接入与证据完整度

实时 CA 接入是 ARY 的差异点和骑行过程证据来源，但不是参赛资格硬门禁。

IA 行为：

* Rider View 必须展示 CA 接入状态。
* Rider 可在参赛过程中配置一个或多个 CAConnection。
* CAConnection 必须先完成登记和握手，后续数据才进入 Projection、Evidence 或 Report 输入。
* CA 未配置、无 CA 数据或接入异常时，Work Submission 仍可进入，但 Rider View 应提示证据缺口。
* RaceProject 聚合 CA 接入 failed / not_configured 时，Rider View 展示接入异常或证据缺口，不展示自动退赛状态。
* Organizer View 和 Judge View 应展示评审前风险提示，包括空骑行、无 CA 数据、空作品、缺必填材料、疑似违规和接入异常。
* GitHub 只作为登录来源、作品代码入口或外部材料引用，不替代实时 CA 接入。

---

## 6.3 权限与可见性规则

页面访问和信息可见性以 `ary-permission-matrix.md` 为准。

通用规则：

* Public 只能访问公开且已发布的信息。
* Public 不访问原始 CA Session、未公开 Work、未发布 JudgingRecord、未发布 Report。
* Rider 只能访问自己的报名、RaceProject、Work、Rider Report 和可见骑行摘要。
* Judge 只能访问分配给自己的 Work、Evidence 摘要和 JudgingRecord。
* Organizer 只能管理自己负责的 Race 及其相关资源。
* Admin 只在 Admin Console 中维护用户、资料状态和 `User.roles`。
* Screen Console 通常由 Organizer 或 Admin 使用。

---

## 6.4 公开 / 内部信息边界

| 信息 | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| Race public info | 可见 | 可见 | 可见 | 可见 | 可见 |
| Raw CA Session | 不可见 | 不可见 | 不可见 | 内部例外 | system |
| Session Summary | 公开摘要可见 | 自己可见 | 分配上下文可见 | managed race 可见 | system |
| Evidence | 公开 Evidence 可见 | 自己摘要可见 | 分配上下文可见 | managed race 可见 | system |
| Work draft | 不可见 | 自己可见 | 不可见 | managed race 可见 | system |
| Work public | 可见 | 可见 | 可见 | 可见 | 可见 |
| JudgingRecord draft | 不可见 | 不可见 | 自己可见 | managed race 可见 | system |
| Report draft | 不可见 | 按个人报告权限 | 不可见 | managed race 可见 | system |
| Report published | 可见公开报告 | 自己报告可见 | 可见公开报告 | 可见 | 可见 |
| User.roles | 不可见 | 不可见 | 不可见 | 不可见 | 可维护 |

---

# 7. Public Site 公开端信息架构

## 7.1 首页 / Race Gallery

首页采用 Gallery-first 结构，是 ARY 的主要公共入口。

首页目标：

1. 展示赛事列表和当前主推赛事。
2. 展示正在进行的赛事。
3. 展示最新赛果和优秀作品。
4. 展示优秀骑手。
5. 引导报名、观看、办赛和赞助。

首页结构如下：

```text
Home / Race Gallery
├─ Hero / Featured Races / Live Race Switcher
├─ Latest Results
├─ Featured Works
├─ Featured Riders
├─ Past Races
└─ CTA：报名 / 办赛 / 赞助 / 合作
```

### 7.1.1 Hero / Featured Races

首屏展示当前最重要的一组赛事。MVP 首场可只有一场；当同时有多场重点赛事时，应以 Featured Races 列表或轮播表达，而不是把 Home 设计成单赛事落地页。

当存在多场进行中 Race 时，Hero 本身承担 Live Race Switcher。用户应能在 Hero 中切换不同 live Race，切换后更新赛事名称、赛题、状态、活跃人数、作品数、进度和主 CTA；不再另设独立 Live Now 卡片。

每个 Featured Race 内容包括：

* 赛事名称
* 一句话赛题
* 当前状态
* 时间信息
* 参赛人数
* 作品数量
* 主 CTA

每个 Featured Race 根据赛事状态，CTA 动态变化：

```text
报名中：立即报名 / 查看赛题
进行中：进入实况大厅 / 查看赛题
评审中：查看提交作品 / 查看评审进度
已结束：查看赛果 / 查看优秀作品
```

---

### 7.1.2 Live Race Switcher

展示正在进行中的赛事。该能力属于 Hero / Featured Races 的一部分，必须支持多场 Race 同时进行。

内容包括：

* 赛事名称
* 当前阶段
* 活跃骑手数
* 已提交作品数
* 当前进度
* 进入实况大厅入口

该能力强调 ARY 的“可观看性”，让公众知道赛事不是静态结果，而是一个正在发生的 Agent Riding 过程。首页不额外放置 Live Now 框，避免与主 Gallery 重复。

---

### 7.1.3 Latest Results

展示最新发布的赛果。

内容包括：

* 赛事名称
* 获奖名单
* 赛果入口
* 评审总结入口
* 优秀作品入口

该模块承担赛后传播与结果展示功能。

---

### 7.1.4 Featured Works

展示精选作品。

内容包括：

* 作品封面
* 作品名称
* 所属赛事
* 作者
* 一句话亮点
* Demo / 视频入口
* 评委点评摘要

精选作品是 ARY 的核心资产之一，应优先服务传播、教学和招商。

---

### 7.1.5 首页不设独立 Leaderboards 模块

Home / Race Gallery 不设置独立 Leaderboards 模块，避免把首页变成赛事内部信息索引。

榜单仍保留在对应上下文中：

* Live Hall 展示过程榜单，用于观看正在发生的 Agent Riding 过程。
* Results 展示最终 Award / Leaderboard，用于赛后结果传播。
* Screen Display / Screen Console 可以按展示模式显示过程榜或最终榜，但必须区分 feed item 类型和赛事状态。

首页只通过 Featured Race / Live Race Switcher、Latest Results 或具体 Work / Rider 卡提供上下文入口，不单独堆叠榜单卡。

---

### 7.1.6 Featured Riders

展示优秀骑手。

内容包括：

* 骑手姓名
* 学校 / 单位
* 代表赛事
* 代表作品
* Agent Riding Skill 标签
* 骑手档案入口

该模块为后续开发者能力背书和人才服务留下入口。

---

### 7.1.7 Past Races

展示往届赛事。

内容包括：

* 赛事封面
* 赛事主题
* 时间
* 参赛人数
* 作品数量
* 获奖情况
* 赛果入口
* 复盘入口

往届赛事是 ARY 的信任资产，用于证明平台持续办赛能力和赛事沉淀能力。

---

## 7.2 赛事详情页 / Race Page

Race Page 是单场赛事的核心承载页。

基础结构如下：

```text
Race Page
├─ Overview 赛事概览
├─ Rules / Schedule 规则与赛程
├─ Live 实况大厅
├─ Riders 参赛骑手
├─ Works 作品展示
├─ Results 赛果榜单
├─ Review 评审总结
└─ CTA 报名 / 提交 / 查看下一场
```

Race Page 根据赛事状态动态调整信息优先级。

---

### 7.2.1 报名中状态

重点是转化报名。

页面优先展示：

* 赛事介绍
* 赛题说明
* 参赛收益
* 时间安排
* 交付要求
* 评审标准
* 奖项设置
* 报名入口

推荐页面顺序：

```text
Hero
→ 赛题说明
→ 为什么参加
→ 赛程安排
→ 交付要求
→ 评审标准
→ 奖项
→ 报名 CTA
```

---

### 7.2.2 进行中状态

重点是观看过程。

页面优先展示：

* 实况大厅
* Jumbotron / Billboard
* 选手进度
* 活跃动态
* 风险事件
* 当前排行榜
* 阶段公告

推荐页面顺序：

```text
Live Hall
→ 当前阶段
→ 活跃骑手
→ 进度看板
→ 成本 / 风险提示
→ 当前榜单
→ 阶段公告
```

---

### 7.2.3 提交中状态

重点是推动成果沉淀。

页面优先展示：

* 提交入口
* 提交要求
* 已提交作品
* 未提交提醒
* 截止时间
* 示例提交格式

推荐页面顺序：

```text
提交状态
→ 提交要求
→ 成果提交入口
→ 已提交作品
→ 截止时间提醒
```

---

### 7.2.4 评审中状态

重点是展示评审进度与结果公布预期。

页面优先展示：

* 已提交作品
* 评审进度
* 评委信息
* 预计公布时间

推荐页面顺序：

```text
评审状态
→ 已提交作品
→ 评审进度
→ 评委阵容
→ 结果公布时间
```

---

### 7.2.5 已结束状态

重点是资产沉淀与传播。

页面优先展示：

* 获奖名单
* 最终排行榜
* 优秀作品
* 评审总结
* 赛事复盘
* 骑手档案
* 下一场赛事 CTA

推荐页面顺序：

```text
获奖名单
→ 最终排行榜
→ 优秀作品
→ 评审总结
→ 赛事复盘
→ 优秀骑手
→ 下一场 CTA
```

---

## 7.3 实况大厅 / Live Hall

Live Hall 是进行中赛事的核心页面。

目标是让公众、老师、赞助方和参赛者看到赛事正在发生什么。

基础结构如下：

```text
Live Hall
├─ Race Status 赛事状态
├─ Stage Progress 阶段进度
├─ Rider Activity 骑手动态
├─ Cost / Progress / Risk 指标
├─ Event Stream 事件流
├─ Current Leaderboard 当前榜单
└─ Screen Entry 大屏入口
```

MVP 指标包括：

* 当前参赛人数
* 活跃骑手数
* 已启动 Session 数
* 已提交作品数
* 平均进度
* 总 token / cost 消耗
* 高风险骑手数
* 最近关键事件

Live Hall 不直接暴露原始 CA 数据，而是展示经过 Projection 处理后的赛事投影数据。

---

## 7.4 作品列表 / Works

Works 是某场赛事的公开作品集合页，帮助公众浏览、筛选并进入作品详情。

基础结构如下：

```text
Works
├─ Race Context 赛事上下文
├─ Filter / Sort 筛选与排序
├─ Work Cards 作品卡片
├─ Featured Works 精选作品
└─ Work Page Entry 作品详情入口
```

作品卡片信息包括：

* 作品名称
* 作者
* 所属赛事
* 一句话亮点
* Demo / 视频入口
* 奖项或精选标识
* 评审结果摘要

Works 只展示已公开作品；隐藏或未发布作品不进入公开列表。

---

## 7.5 作品详情页 / Work Page

Work Page 是赛事资产沉淀的重要页面。

基础结构如下：

```text
Work Page
├─ 作品概览
├─ Demo / 视频
├─ 问题定义
├─ 解决方案
├─ 技术方案
├─ 骑行过程摘要
├─ 关键证据
├─ 评委点评
└─ 作者
```

MVP 作品详情应至少包含：

* 作品名称
* 所属赛事
* 作者
* 作品简介
* Demo 链接
* GitHub / 代码链接
* 演示视频
* 技术说明
* 骑行过程摘要
* 评委点评
* 奖项信息

Work Page 不只是作品展示页，也是课程案例、传播素材和招商材料的来源。

---

## 7.6 赛果榜单 / Results

Results 是赛事结束后的结果页，展示最终 Award 榜单和赛后结果入口。

基础结构如下：

```text
Results
├─ Race Result Summary 赛事结果摘要
├─ Award Leaderboards 奖项榜单
├─ Winning Works 获奖作品
├─ Riding Skill Highlights 骑行能力亮点
└─ Review Entry 评审总结入口
```

Results 读取 `leaderboard_read_model`、Award 和 Report，不读取过程 Projection 作为最终结果。

榜单展示关系：

* 每个 Award Setting 对应一个榜单分组。
* 榜单按 Award.rank 排列。
* Award 授予 Registration，可选展示关联 Work。
* 过程榜单只可作为 Live Hall 或 Screen Console 的过程展示，不进入最终赛果。

---

## 7.7 评审总结 / Review

Review 是赛事评审后的公开总结页，解释结果背后的评审判断和复盘价值。

基础结构如下：

```text
Review
├─ Review Summary 评审总结
├─ Award Rationale 获奖说明
├─ Featured Cases 典型案例
├─ Judge Comments 评委观点
├─ Evidence Highlights 证据摘要
└─ Next Race Suggestion 下一场建议
```

Review 读取已发布的 `review_summary` Report，可引用公开 Evidence、Award 和 JudgingRecord 摘要。

未发布 Review 不进入公开导航，也不在 Race Page 已结束状态中展示。

---

## 7.8 骑手档案 / Rider Profile

Rider Profile 用于沉淀选手的 Agent Riding Skill 证据。

MVP 阶段不要做成完整社交主页，而是聚焦参赛与能力记录。

基础结构如下：

```text
Rider Profile
├─ 基础信息
├─ 参赛记录
├─ 获奖记录
├─ 作品记录
├─ Agent Riding Skill 标签
├─ 骑行数据摘要
├─ 评委评语
└─ 能力证据
```

MVP 内容包括：

* 姓名 / 昵称
* 学校 / 单位
* 参加过的赛事
* 提交过的作品
* 获得过的奖项
* Agent Riding Skill 标签
* 成本控制表现
* 进度表现
* 风险处理表现
* 纠偏案例
* 公开作品链接

Rider Profile 应优先基于用户资料、报名记录、作品、奖项、能力标签和公开 Evidence 生成，减少用户手动维护成本。

---

## 7.9 Cooperation

该页面用于解释 ARY 是什么，并承接办赛、赞助和合作转化。

基础结构如下：

```text
Cooperation
├─ 什么是 Agent Racing Yard
├─ 什么是 Agent Riding Skill
├─ 为什么需要 Agent Racing
├─ 如何参赛
├─ 如何办赛
├─ 如何赞助
└─ 联系合作
```

该页面服务四类用户：

* 学生 / 开发者：了解为什么参赛
* 老师 / 学校：了解如何用于课堂和实训
* 企业：了解如何命题、赞助和筛选人才
* 社区：了解如何共创赛事

---

# 8. Console 管理端信息架构

管理端不进入公开首页主导航，而是通过独立入口进入。

建议入口：

```text
/console
```

MVP 管理端按照产品体验面拆分为 Race Console、Admin Console 和 Screen Console。Race Console 是单场 Race Workspace，不是三个互相独立的后台产品：

```text
Console
├─ Race Console
│  └─ Race Workspace
│     ├─ Organizer View
│     ├─ Rider View
│     └─ Judge View
├─ Admin Console
└─ Screen Console
```

---

## 8.1 Race Console / Organizer View 主办方视图

面向赛事主办方、老师、运营人员。

信息层级：

```text
Race Console / Organizer View
├─ Overview
├─ Settings
├─ Registrations
├─ Riders
├─ CA Status
├─ Works
├─ Judges
├─ Judging
├─ Awards
├─ Reports
└─ Maintenance
```

核心任务：

* 创建并发布赛事
* 管理报名和参赛选手
* 配置成果提交要求
* 管理评委和 MVP 固定评审说明
* 发布赛果和榜单
* 生成赛事总结报告

---

## 8.2 Race Console / Rider View 选手视图

面向参赛选手。

信息层级：

```text
Race Console / Rider View
├─ Registration
├─ CA Setup
├─ Riding Status
├─ Work Submission
├─ Review Result
└─ Rider Report
```

核心任务：

* 查看当前赛事报名状态
* 进入 ARY 自动生成的 RaceProject，配置一个或多个 CAConnection，并关联 GitHub repo
* 在参赛过程中新增或查看 CAConnection，查看接入状态和证据完整度
* 查看个人进度、成本和风险
* 提交作品
* 查看评审结果和选手报告

IA 规则：

* Work Submission 不受 CA 接入状态硬门禁控制。
* CA 未配置、无 CA 数据或接入异常时，Work Submission 可继续，但必须展示证据缺口和评审风险提示。
* 未登记、未握手、归属错误或被禁用的 CAConnection 信号不进入有效 Projection、Evidence 或 Report 输入。
* RaceProject 聚合 CA 接入 failed / not_configured 时，Rider View 展示接入异常或证据缺口，不展示自动退赛状态。

---

## 8.3 Race Console / Judge View 评委视图

面向评委。

信息层级：

```text
Race Console / Judge View
├─ Assigned Works
├─ Reviewing
└─ Submitted Reviews
```

核心任务：

* 查看分配作品
* 查看作品和骑行过程摘要
* 按 MVP 固定评分项评分
* 撰写评语
* 提供评审总结素材

---

## 8.4 Screen Console 大屏控制台

面向现场运营和课堂展示人员。

信息层级：

```text
Screen Console
├─ Race Selection
├─ Display Mode
├─ Theme / Calibration
├─ Fallback Control
└─ Fullscreen Output
```

核心任务：

* 控制赛事大屏展示内容
* 切换 Live / 榜单 / 作品 / 公告视图
* 配置大屏主题
* 完成现场屏幕校准

Screen Console 与 Screen Display 的关系：

* Screen Console 是控制面。
* Screen Display 是展示输出面。
* 大屏模式包括 Jumbotron、Billboard、Live、Leaderboard、Works、Announcement。

---

## 8.5 Admin Console 账号与角色控制台

面向拥有 `admin` role 的用户。

信息层级：

```text
Admin Console
├─ 用户列表
├─ 用户资料状态
├─ User.roles 维护
└─ 最小系统管理入口
```

核心任务：

* 查看 GitHub 登录后的用户
* 查看用户资料补全状态
* 维护用户 `User.roles`
* 支持同一用户的 `User.roles` 包含多个 role 值

Admin Console 不承担赛事执行、CA 接入维护或数据运营职责。

---

## 8.6 Internal Data Maintenance 内部数据维护

MVP 阶段暂不提供独立 Data / Ops Console。

为保证 CA 接入、大屏展示和报告生成可运行，只保留以下内部维护能力：

这些能力通常由拥有 `organizer` 或 `admin` role 的用户承担，但不进入 Admin Console 的账号与角色管理结构。

```text
Internal Data Maintenance
├─ CA 接入状态查看
├─ Projection 最近更新时间
├─ Projection 手动重算
├─ 报告生成手动重跑
└─ 公开展示异常数据处理
```

这些能力可以先通过隐藏入口、管理脚本或主办方视图中的最小状态提示实现，后续再升级为独立数据运营后台。

---

# 9. Riding Intelligence 信息出口

Riding Intelligence 是产品信息能力。产品级能力由 `ary-mvp.prd.md` 负责；指标、证据类型和读取模型口径由 `ary-domain-analysis.v0.3.md` 负责；验收覆盖由 `ary-qa-plan.md` 负责。

本文只定义它在信息架构中的出口：哪些页面或视图消费哪些信息，以及这些信息是否属于过程 Projection 或赛后结果 Read Model。

```text
Riding Intelligence
├─ 过程 Projection
│  ├─ race_progress_projection
│  ├─ registration_status_projection
│  ├─ cost_projection
│  ├─ risk_projection
│  ├─ submission_projection
│  ├─ judging_projection
│  ├─ current_leaderboard_projection
│  └─ screen_feed_projection
│
├─ 赛后 Read Model
│  └─ leaderboard_read_model
│
├─ Evidence
│  └─ 通过 sourceRef 引用实时 Session Summary、Work、Judging Record、GitHub 代码材料等来源
│
└─ Report
   ├─ rider_report
   ├─ race_report
   └─ review_summary
```

---

## 9.1 页面消费关系

| 页面 / 视图 | 主要消费信息 | 信息属性 |
|---|---|---|
| Live Hall | race_progress、registration_status、cost、risk、event stream | 过程 Projection |
| Race Page | Race、Registration 统计、Work 状态、Report 摘要 | 核心事实 + Read Model |
| Works / Work Page | Work、Evidence、Judging Record 摘要、Award | 核心事实 + Evidence |
| Results | Award、leaderboard_read_model、Report | 赛后结果 Read Model |
| Review | review_summary Report、Award、Evidence、Judging Record 摘要 | 赛后总结 Read Model |
| Rider Profile | User、Registration、Work、Award、Skill Tag、Evidence | 公开读取模型 |
| Cooperation | 介绍内容、合作入口、Contact | 内容页 |
| Race Console / Organizer View | Registration、Work、Judge Assignment、Judging Progress、Report | 工作台信息 |
| Race Console / Rider View | Registration、RaceProject、registration_status、Work、rider_report | 个人参赛信息 |
| Race Console / Judge View | Judge Assignment、Work、Evidence、Judging Record | 评审工作台 |
| Admin Console | User、User.roles、用户资料状态 | 账号与角色管理 |
| Screen Console | screen_feed_projection、current_leaderboard_projection、leaderboard_read_model、Announcement | 大屏展示信息 |

---

## 9.2 Projection 与结果边界

IA 中只表达读取路径，不把 Projection 当作最终结果事实源。

* 过程状态、实时榜单和大屏 feed 读取 Projection。
* 最终榜单读取 `leaderboard_read_model`。
* 赛事结果和评审总结读取 `Report`、`Award` 和 `Evidence`。
* `screen_feed_projection` 可以展示过程榜单或最终榜单，但需要在 feed item 类型中区分二者。

---

# 10. 推荐 URL 结构

```text
/                           首页 / Race Gallery

/races                      全部赛事
/races/{raceSlug}            赛事详情
/races/{raceSlug}/live       实况大厅
/races/{raceSlug}/works      作品列表
/races/{raceSlug}/results    赛果榜单
/races/{raceSlug}/review     评审总结

/works/{workSlug}            作品详情
/riders/{riderSlug}          骑手档案

/cooperation                合作 / 赞助 / 办赛

/console                    管理入口
/console/races              Race Console 赛事列表 / 入口
/console/races/{raceSlug}                  单场 Race Workspace

/console/races/{raceSlug}/organizer             Organizer View
/console/races/{raceSlug}/organizer/overview    Organizer Overview
/console/races/{raceSlug}/organizer/settings    Race Settings
/console/races/{raceSlug}/organizer/registrations Registrations
/console/races/{raceSlug}/organizer/riders      Riders
/console/races/{raceSlug}/organizer/ca-status   CA Status
/console/races/{raceSlug}/organizer/works       Works Management
/console/races/{raceSlug}/organizer/judges      Judge Assignment
/console/races/{raceSlug}/organizer/judging     Judging Progress
/console/races/{raceSlug}/organizer/awards      Awards / Leaderboard
/console/races/{raceSlug}/organizer/reports     Reports

/console/races/{raceSlug}/rider                 Rider View
/console/races/{raceSlug}/rider/registration    Registration Status
/console/races/{raceSlug}/rider/ca-setup        CA Setup
/console/races/{raceSlug}/rider/riding          Riding Status
/console/races/{raceSlug}/rider/submission      Work Submission
/console/races/{raceSlug}/rider/review          Review Result
/console/races/{raceSlug}/rider/report          Rider Report

/console/races/{raceSlug}/judge                 Judge View
/console/races/{raceSlug}/judge/assigned        Assigned Works
/console/races/{raceSlug}/judge/reviewing       Reviewing
/console/races/{raceSlug}/judge/submitted       Submitted Reviews

/console/admin                         Admin Console 账号与角色控制台
/console/admin/users                   用户列表
/console/admin/profile-completion      资料补全状态
/console/admin/roles                   User.roles 维护

/console/screen                        Screen Console 大屏控制台
/console/screen/{raceSlug}             单场大屏控制
/console/screen/{raceSlug}/{mode}      指定模式控制
```

URL 规则：

* URL 只是 IA 建议，最终路由以架构设计和前端实现为准。
* `/` 是 Home / Race Gallery；`/races` 是同一 Race 列表能力的完整列表入口，二者不表达两个不同的信息对象。
* Console 子路由必须结合 `User.roles`、当前 Race 关系和授权范围做访问控制。
* Organizer View 限定用户管理的 Race；Rider View 限定用户已报名且未被拒绝的 Race；Judge View 限定用户被分配评审任务的 Race。
* Public Site 的 URL 使用公开 slug；Console 内部可以使用 slug 或内部 id，由架构设计决定。
* Screen Display 的实际播放 URL 可在后续 UI / 技术设计中单独定义。

---

# 11. MVP 页面优先级

## P0：第一场赛事必须具备

本章只表达页面和导航层面的优先级。产品能力优先级以 `ary-mvp.prd.md` 为准。

```text
公开端：
- 首页 / Race Gallery
- 赛事详情页
- 实况大厅基础版
- 作品列表
- 作品详情页
- 赛果榜单页
- 骑手档案基础版
- 评审总结基础页
- Cooperation 基础页

管理端：
- 基础账号能力：GitHub 登录、资料补全
- Admin Console 基础版
- Race Console 基础版
- Organizer View：创建赛事、报名管理、评审配置、榜单发布
- Rider View：CA 接入、骑行状态、成果提交
- Judge View：作品查看、骑行摘要、评分表单
- Screen Console 基础配置
```

---

## P1：体现 ARY 差异

```text
公开端：
- Featured Riders
- 骑手档案展示增强
- 骑行能力榜
- 评审总结页体验增强
- 优秀作品 Case Card

管理端：
- 评审总结草稿生成与编辑增强
- Jumbotron / Billboard 高级配置
- 风险事件管理
```

---

## P2：后续平台化

```text
公开端：
- 多赛事专题
- 公开认证页
- 社区化骑手主页
- 课程案例库

管理端：
- 多组织 / 多学校管理
- 赞助商后台
- 企业命题后台
- 课程包生成
- 众包项目撮合
```

---

# 12. 一句话总结

ARY MVP 的信息架构不是以后台功能为中心，而是以公开赛事资产为中心。

公开端采用：

```text
Race Gallery → Race Page → Live / Works / Results / Riders / Review
```

管理端采用：

```text
Race Console / Admin Console / Screen Console
```

信息能力出口采用：

```text
Riding Intelligence → Projection / Evidence / Report / Read Model
```

最终目标是：

```text
让赛事可观看，让作品可传播，让能力可证明，让案例可沉淀，让平台可转化。
```
