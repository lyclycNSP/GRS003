# ARY DEV-1到DEV-3交付与验收记录

版本：v0.1
文档类型：Architecture & Demo Delivery
状态：已交付草案
关联任务：`DEV-1`、`DEV-2`、`DEV-3`
上游入口：`ary-mvp.prd.md`、`ary-domain-analysis.v0.3.md`、`ary-permission-matrix.md`、`ary-mvp.ia.md`、`ary-ca-integration-spec.md`
演示入口：`../design-prototype/index.html`

---

# 1. 交付结论

本轮把`ary.plan.md`中的`DEV-1`到`DEV-3`落为两类产物：

| 任务 | 本轮产物 | 完成判断 |
|---|---|---|
| `DEV-1`领域模型+权限+数据模型 | 聚合边界、数据模型草案、接口鉴权规则和验收用例 | 可作为后续正式应用架构输入 |
| `DEV-2`Public Site静态闭环 | `design-prototype/`公开端主路径：Home、Race Page、Live Hall、Works、Work Page、Results、Review、Rider Profile、Cooperation | 可用mock/种子数据走查公开浏览路径 |
| `DEV-3`登录/角色/Race Console | `design-prototype/`模拟GitHub登录、资料补全、角色入口、Organizer/Rider/Judge/Admin视图和`User.roles`维护 | 可演示多role入口和基础Console框架 |

本轮不新增正式后端、数据库迁移、真实OAuth、生产CA接入或完整赛事执行代码。当前仓库仍以文档、静态高保真原型和mock数据作为可审查产物。

---

# 2. DEV-1领域聚合边界

## 2.1 设计原则

* `Race`是MVP的核心上下文，不以后台模块或组织租户为建模中心。
* `Registration`是参赛追溯中枢；`RaceProject`、`Work`、`Evidence`、`Award`和`rider_report`均应能追溯到`Registration`。
* `User.roles`表达`rider`、`judge`、`organizer`、`admin`多身份，MVP不引入`Team`、`Organization`或独立`RoleAssignment`实体。
* `Projection`只服务过程展示和大屏，不作为最终事实源；最终结果读取`Award`、`Report`或`leaderboard_read_model`。
* CA接入状态不改变`Registration`资格状态；`not_configured`、`failed`和空骑行进入评审前风险提示。

## 2.2 聚合边界

| 聚合/边界 | 聚合根 | 内部对象 | 主要不变量 |
|---|---|---|---|
| Identity | `User` | GitHub账号映射、资料字段、`roles`集合 | GitHub账号唯一映射到一个User；只有Admin可更新`roles` |
| Race | `Race` | 赛题、赛程、规则、提交要求、奖项设置、organizer用户集合、公告 | Organizer只能管理自己负责的Race；Public只读已公开/已发布Race |
| Registration | `Registration` | 报名状态、审核时间、退赛标记、资料快照 | 同一`userId+raceId`最多一条Registration；CA状态不驱动`withdrawn` |
| RaceProject | `RaceProject` | 多个`CAConnection`、聚合接入状态、GitHub材料引用、聚合Metrics | approved Registration幂等生成且仅生成一个RaceProject；RaceProject可有多个CAConnection |
| RidingSession | `Session` | Session快照摘要、计数器、状态时间点 | Session必须归属合法CAConnection；原始Session默认不公开 |
| Work | `Work` | Demo、视频、Repo、公开状态、作品说明 | 一个Registration最多一个主Work；提交不以CA接入成功为硬门禁 |
| Review | `JudgeAssignment` | `JudgingRecord`、评分、评语、提交状态 | JudgingRecord必须来源于JudgeAssignment；Judge只能操作分配给自己的任务 |
| Result | `Award` | 奖项名、名次、获奖Registration、可选Work、决策说明 | 同一Race同一awardName下rank唯一；Award授予Registration |
| Evidence | `Evidence` | `sourceRef`、摘要、可见性、证据类型 | 公开端只读公开摘要；GitHub材料可作sourceRef但不能替代实时CA接入 |
| Report | `Report` | `rider_report`、`race_report`、`review_summary`、引用Evidence/Award | `rider_report`必须有`subjectRegistrationId`；未发布Report不进Public Site |
| Projection | `Projection` | race_progress、registration_status、cost、risk、screen_feed等读取模型 | 可重算；失败不污染核心事实；Live Hall和Screen Display优先读取Projection |
| ReviewFlag | `ReviewFlag` | flag类型、严重度、来源资源、处理状态、Judge可见摘要 | 表达空骑行、无CA数据、空作品、缺必填材料、疑似违规和接入异常；不自动替代人工评审 |

`ReviewFlag`作为本轮实现命名；`ReviewReadinessCheck`用于表示生成这些flag的检查流程。

## 2.3 关键领域事件

后续实现建议围绕以下事件组织命令、副作用和Projection重算：

| 事件 | 触发 | 后续动作 |
|---|---|---|
| `UserSignedInWithGitHub` | GitHub登录成功 | 创建或更新User和GitHub账号映射 |
| `UserProfileCompleted` | 用户保存必填资料 | 解除资料补全拦截，允许进入授权Console |
| `UserRolesUpdated` | Admin更新`User.roles` | 重新计算Console入口和API授权范围 |
| `RacePublished` | Organizer发布Race | 进入公开Race Page或报名状态 |
| `RegistrationSubmitted` | Rider报名 | 等待Organizer审核 |
| `RegistrationApproved` | Organizer/Admin审核通过 | 触发`EnsureRaceProjectForRegistration`幂等命令 |
| `RaceProjectEnsured` | RaceProject创建或已存在 | Rider View显示参赛工作区 |
| `CAConnectionRegistered` | Rider登记CAConnection | 记录connected状态和握手材料 |
| `CAConnectionActivated` | 合法连接产生Session | 聚合RaceProject状态并重算Projection |
| `CAConnectionFailed` | 单个连接失败 | 更新连接健康度并生成ReviewFlag候选 |
| `RidingSignalAccepted` | 合法connector push信号 | 写入接入事实，按需触发snapshot fetch |
| `SessionSummaryGenerated` | Session快照归一化 | 生成Evidence候选和Metrics输入 |
| `WorkSubmitted` | Rider提交作品 | 检查必填材料和ReviewFlag |
| `JudgeAssigned` | Organizer分配评委 | Judge View出现任务 |
| `JudgingRecordSubmitted` | Judge提交评分评语 | 更新评审进度 |
| `AwardPublished` | Organizer发布Award | 生成或刷新`leaderboard_read_model` |
| `ReportPublished` | Report发布 | Public Review/Results可读取 |
| `ProjectionRebuilt` | 投影定时或手动重算 | 更新Live Hall和Screen Display |

---

# 3. DEV-1数据模型草案

本节是逻辑数据模型草案，不是最终迁移脚本。字段命名以实现阶段技术栈为准，但约束和关系应保留。

## 3.1 核心表

| 表 | 关键字段 | 约束/说明 |
|---|---|---|
| `users` | `id`、`slug`、`display_name`、`profile_completed`、`roles_json`、`created_at`、`updated_at` | `slug`唯一；`roles_json`只允许`rider/judge/organizer/admin` |
| `user_auth_accounts` | `id`、`user_id`、`provider`、`provider_account_id`、`login_name` | `provider+provider_account_id`唯一；MVP provider为`github` |
| `races` | `id`、`slug`、`title`、`status`、`visibility`、`challenge`、`rules_json`、`schedule_json`、`submission_requirements_json`、`award_settings_json`、`created_by_user_id` | `slug`唯一；status覆盖`draft/published/registration/running/submitting/judging/completed/archived` |
| `race_organizers` | `race_id`、`user_id`、`added_by_user_id`、`created_at` | `race_id+user_id`唯一；用于`managed race`判定 |
| `registrations` | `id`、`race_id`、`user_id`、`status`、`submitted_at`、`approved_at`、`review_flag_summary_json` | `race_id+user_id`唯一；approved后必须能找到一个RaceProject |
| `race_projects` | `id`、`registration_id`、`repo_url`、`aggregate_ingestion_status`、`connection_health`、`last_synced_at` | `registration_id`唯一；由系统幂等创建 |
| `ca_connections` | `id`、`race_project_id`、`ca_type`、`connector_id`、`connector_version`、`external_project_ref`、`ingestion_status`、`registered_at`、`handshake_at`、`disabled_at`、`last_synced_at` | 只有`handshake_at`存在且`disabled_at`为空的连接可接收有效数据 |
| `sessions` | `id`、`ca_connection_id`、`external_session_ref`、`started_at`、`ended_at`、`last_active_at`、`message_count`、`tool_call_count`、`token_cost`、`snapshot_version` | `ca_connection_id+external_session_ref`唯一；来源必须是合法CAConnection |
| `riding_metrics` | `id`、`scope_type`、`scope_id`、`cost_json`、`progress_json`、`risk_json`、`skill_json`、`calculated_at` | `scope_type`可为`race_project/ca_connection/session` |
| `works` | `id`、`registration_id`、`slug`、`title`、`summary`、`status`、`visibility`、`demo_url`、`video_url`、`repo_url`、`submitted_at`、`published_at` | `registration_id`唯一约束用于MVP主Work；`slug`唯一 |
| `evidences` | `id`、`race_id`、`registration_id`、`type`、`title`、`summary`、`source_ref_json`、`visibility`、`created_at` | `source_ref_json`记录Session、Work、JudgingRecord、commit/PR等来源 |
| `review_flags` | `id`、`race_id`、`registration_id`、`work_id`、`race_project_id`、`type`、`severity`、`status`、`source_ref_json`、`judge_visible_summary`、`created_at`、`resolved_at` | type覆盖`empty_riding/no_ca_data/empty_work/missing_required_material/suspected_violation/ingestion_exception` |
| `judge_assignments` | `id`、`race_id`、`work_id`、`judge_user_id`、`assigned_by_user_id`、`status`、`assigned_at` | `work_id+judge_user_id`唯一；分配人需为managed race Organizer或Admin |
| `judging_records` | `id`、`assignment_id`、`score_result`、`score_riding`、`comments`、`status`、`submitted_at` | `assignment_id`唯一或按版本追加，MVP建议一条当前记录 |
| `awards` | `id`、`race_id`、`registration_id`、`work_id`、`award_name`、`rank`、`decision_reason`、`status`、`published_at` | `race_id+award_name+rank`唯一；`race_id+award_name+registration_id`唯一 |
| `reports` | `id`、`race_id`、`type`、`subject_registration_id`、`status`、`visibility`、`content_json`、`generated_at`、`published_at` | `rider_report`必须有`subject_registration_id`；其他类型必须为空 |
| `projections` | `id`、`race_id`、`type`、`status`、`payload_json`、`last_rebuilt_at`、`stable_version_id` | 可重算；保留最近稳定版本用于Live Hall/Screen fallback |
| `announcements` | `id`、`race_id`、`title`、`body`、`visibility`、`published_at` | Live Hall和Screen Display可读取公开公告 |

## 3.2 数据约束清单

| 约束 | 落点 |
|---|---|
| 一个User对同一Race最多一个Registration | `registrations`唯一键`race_id+user_id` |
| 一个Registration最多一个RaceProject | `race_projects.registration_id`唯一 |
| approved Registration应有且仅有一个RaceProject | `RegistrationApproved`后执行幂等`EnsureRaceProjectForRegistration`，并用唯一键防重复 |
| 一个RaceProject可有多个CAConnection | `ca_connections.race_project_id`一对多 |
| 合法CA数据边界 | 接收时校验CAConnection归属、握手状态、未禁用、RaceProject和Registration一致 |
| CA failed/not_configured不阻断提交评审Award | Work提交和Judge/Award命令不依赖`aggregate_ingestion_status=active` |
| 一个Registration最多一个主Work | `works.registration_id`唯一 |
| Judge只能评审已分配Work | `judging_records.assignment_id`外键到`judge_assignments` |
| Award必须授予Registration | `awards.registration_id`非空，`work_id`可空 |
| Projection不是事实源 | `projections`不被Award/Report作为唯一来源引用 |
| 未发布资源不公开 | Public读取必须检查`visibility/status/published_at` |

---

# 4. DEV-1接口鉴权规则

## 4.1 鉴权上下文

每个后台请求应先构造`AuthContext`：

```text
AuthContext
├─ userId
├─ roles
├─ profileCompleted
├─ managedRaceIds
├─ registeredRaceIds
├─ approvedRegistrationIds
├─ raceProjectIds
└─ assignedWorkIds
```

公共请求没有`AuthContext`时只能读取`public`范围资源。Console请求必须登录；除资料补全、退出登录和基础个人信息读取外，建议要求`profileCompleted=true`。

## 4.2 API规则草案

| 接口/动作 | 授权规则 | 关键校验 |
|---|---|---|
| `GET /public/races`、`GET /public/races/:slug` | Public | Race已发布且公开 |
| `GET /public/races/:slug/live` | Public | 读取Projection或最近稳定Projection，不读原始Session |
| `GET /public/races/:slug/works` | Public | 只返回公开Work |
| `GET /public/works/:slug` | Public | Work公开；Evidence只返回公开摘要 |
| `GET /public/races/:slug/results` | Public | Award/leaderboard已发布 |
| `GET /public/races/:slug/review` | Public | `review_summary`已发布且公开 |
| `POST /auth/github/callback` | GitHub回调 | 创建/更新User和账号映射 |
| `PATCH /me/profile` | 登录用户own | 更新自己的资料补全字段 |
| `GET /console` | 登录且资料已补全 | 按`roles`返回可进入视图 |
| `POST /races` | Organizer或Admin | Organizer创建后自动成为Race organizer |
| `PATCH /races/:raceId`、`POST /races/:raceId/publish` | managed race Organizer或Admin | 只能管理授权Race |
| `POST /races/:raceId/registrations` | Rider own | 同一Race不得重复报名 |
| `POST /registrations/:id/approve` | managed race Organizer或Admin | 状态更新后幂等生成RaceProject |
| `POST /race-projects/:id/ca-connections` | Rider own approved registration；Organizer/Admin assistance | Race处于running/submitting且未进入judging前，或Race规则允许的接收窗口内 |
| `PATCH /ca-connections/:id` | Rider own metadata；Organizer/Admin exception | 禁用连接需记录原因 |
| `POST /ca/riding-signals` | Connector credential | 校验`caConnectionId`已登记、已握手、归属正确且未禁用；重复`idempotencyKey`去重 |
| `GET /ca/connections/:id/sessions/:sessionId/snapshot` | ARY内部服务到connector | 仅对合法CAConnection发起fetch |
| `POST /registrations/:id/work`、`POST /works/:id/submit` | Rider own registration | 不以CA active为硬门禁；缺材料生成ReviewFlag |
| `POST /judge-assignments` | managed race Organizer或Admin | `assignedByUserId`记录操作者 |
| `POST /judging-records` | assigned Judge | 只能提交自己assignment下记录 |
| `POST /awards`、`POST /awards/:id/publish` | managed race Organizer或Admin | 发布前只对managed race/Admin可见 |
| `POST /reports/generate`、`POST /reports/:id/publish` | managed race Organizer或Admin | Report引用Evidence/Award；未发布不进Public |
| `POST /projections/rebuild` | managed race Organizer或Admin | 失败不写核心事实；可回退稳定版本 |
| `PATCH /admin/users/:id/roles` | Admin | 只更新`User.roles`，不承担赛事执行 |
| `POST /screen/:raceId/mode` | managed race Organizer或Admin | Screen Operator由Organizer/Admin承担 |

## 4.3 角色入口规则

| role | Console入口 | 范围 |
|---|---|---|
| `rider` | Rider View | 自己已报名且未被拒绝的Race |
| `judge` | Judge View | 分配给自己的Work及相关Evidence摘要 |
| `organizer` | Organizer View、Screen Console | 自己负责的Race |
| `admin` | Admin Console、系统范围Screen/维护入口 | 系统范围；Admin Console只做账号和角色管理 |

---

# 5. DEV-2静态闭环

## 5.1 演示页面

`design-prototype/index.html`当前覆盖以下公开端页面：

| 页面 | 对应DEV-2范围 | 验收点 |
|---|---|---|
| Home/Race Gallery | Home/Race Gallery | 首屏直接展示当前主推赛事，2次点击内进入Live Hall/Race Page |
| Race Page | Race Page | 展示赛题、状态、赛程和本场入口 |
| Live Hall | 补充公开端实时入口 | 读取mock Projection，明确过程榜不等于最终Results |
| Works | Works | 展示公开/评审中/精选作品列表和筛选入口 |
| Work Page | Work Page | 展示Demo、Repo、骑行摘要、Evidence摘要、评委摘录和Race回链 |
| Results | Results | 读取最终Award/Leaderboard样例，不使用过程榜作为最终事实 |
| Review | 评审总结mock | 展示已发布review_summary样例 |
| Rider Profile | 公开骑手资产 | 展示作品、奖项、能力标签和公开Evidence摘要 |
| Cooperation | Cooperation | 承接报名、办赛和赞助合作入口 |

## 5.2 DEV-2不做事项落实

* 不接真实登录和后台数据。
* 不做真实Projection实时刷新，只使用样例Projection和Canvas动效表达。
* 不把首页做成营销页或后台索引；Console入口弱化，公开端仍以Race Gallery为中心。

---

# 6. DEV-3静态闭环

## 6.1 演示页面

`design-prototype/index.html`当前提供以下DEV-3可走查能力：

| 能力 | 原型落点 | 验收点 |
|---|---|---|
| GitHub登录 | Auth/Profile页面 | 点击mock GitHub登录后进入资料补全状态 |
| 资料补全 | Auth/Profile页面 | 保存资料后进入Console入口 |
| 不同role看到不同Console入口 | Console页面Role Entry Grid | `rider`、`judge`、`organizer`、`admin`入口分离 |
| Race Console框架 | Console页面 | Organizer/Rider/Judge/Admin四个视图可切换 |
| Organizer View | Console页面 | 展示Race状态、报名、CA、作品、评审风险和待处理项 |
| Rider View | Console页面 | 展示Registration、自动RaceProject、多个CAConnection、提交入口和风险提示 |
| Judge View | Console页面 | 展示Assigned Works、Evidence摘要、固定评分项和提交评审动作 |
| Admin Console基础版 | Console页面Admin视图 | 展示用户列表、资料补全状态和`User.roles`维护 |

## 6.2 DEV-3不做事项落实

* GitHub登录是mock交互，不接真实OAuth。
* Admin角色维护只在静态原型内切换视觉状态，不写入后端。
* Race Console只做框架和关键入口，不实现完整赛事执行。
* Screen Console仍保留为后续`DEV-6`深化，当前仅从Console和Screen Display表达入口关系。

---

# 7. 验收用例

## 7.1 DEV-1验收

| 用例 | 本轮落点 |
|---|---|
| 一个User对同一Race最多一个Registration | 数据模型`registrations(race_id,user_id)`唯一约束 |
| Registration approved后幂等生成RaceProject | 领域事件`RegistrationApproved`和数据模型`race_projects.registration_id`唯一约束 |
| 一个Registration最多一个RaceProject和一个主Work | `race_projects.registration_id`唯一；`works.registration_id`唯一 |
| 一个RaceProject可登记多个CAConnection | RaceProject聚合和`ca_connections`一对多 |
| 只有合法CAConnection数据进入Projection/Evidence/Report | 接口规则`POST /ca/riding-signals`和snapshot fetch校验 |
| CA failed/not_configured不阻断提交、评审和Award | Work/Judging/Award命令不依赖`active`，ReviewFlag承接风险 |

## 7.2 DEV-2验收

| 用例 | 本轮落点 |
|---|---|
| 公众2次点击内进入当前主推赛事 | Home Hero CTA进入Race Page或Live Hall |
| 公众可查看作品 | Works列表和Work Page |
| 公众可查看赛果 | Results页面 |
| 公众可查看评审总结mock | Review页面 |
| Public不读取原始CA Session | 页面只呈现Projection、Evidence摘要和Report摘要 |

## 7.3 DEV-3验收

| 用例 | 本轮落点 |
|---|---|
| 用户可登录并补全资料 | Auth/Profile mock流程 |
| Admin可维护`User.roles` | Console Admin视图角色chip切换 |
| 不同role看到不同Console入口 | Console Role Entry Grid和视图切换 |
| Race Console框架可走查 | Organizer/Rider/Judge/Admin视图 |
| 多role用户视图切换不混淆 | Console侧边栏和当前视图标题明确显示role |

---

# 8. 后续进入DEV-4前的风险

| 风险 | 建议处理 |
|---|---|
| 尚无正式应用框架和测试命令 | DEV-4前需确定技术栈、路由、数据访问层和测试框架 |
| ReviewFlag状态机仍是草案 | DEV-4/DEV-5需要细化flag生成、关闭、人工处理和Judge可见摘要 |
| CAConnection新增截止窗口仍需产品化 | 当前建议running/submitting且未进入judging前允许新增，最终以Race规则配置为准 |
| Admin系统范围与赛事执行边界需防混淆 | 实现时保持Admin Console只做账号/角色，赛事维护动作走Race/Screen上下文 |
| 静态原型不等于安全控制 | 后续API必须服务端鉴权，不能只依赖UI隐藏入口 |

---

# 9. 复核结论与验证边界

## 9.1 符合性结论

按`ary.plan.md`中`DEV-1`到`DEV-3`的交付范围、验收用例和不做事项复核，本轮产物满足当前仓库阶段的任务要求：

| 任务 | 复核结论 |
|---|---|
| `DEV-1` | 已覆盖聚合边界、数据模型草案、接口鉴权规则和核心验收不变量，可作为后续正式应用架构输入。 |
| `DEV-2` | 已用高保真静态原型和样例数据形成Public Site公开浏览闭环，覆盖Home、Race Page、Works、Work Page、Results、Review和Cooperation。 |
| `DEV-3` | 已用高保真静态原型形成mock登录、资料补全、`User.roles`维护和Race Console多role入口演示。 |

本结论中的“完成”指满足当前仓库“文档+高保真静态原型”阶段的可审查/可演示产物要求，不表示已完成真实后端、数据库、OAuth、安全鉴权或生产CA接入。

## 9.2 已执行验证

| 验证 | 结果 |
|---|---|
| `node --check design-prototype/script.js` | 通过 |
| 静态页面面板检查 | 通过，确认`home/race/live/works/work/results/review/rider/cooperation/auth/console/screen`共12个页面面板存在 |
| 静态交互入口检查 | 通过，确认Work详情、Auth/Profile、Console角色视图和Admin角色chip入口存在 |
| 任务验收矩阵检查 | 通过，确认`DEV-1`到`DEV-3`关键验收条目均能追溯到本文和原型 |
| 旧口径残留搜索 | 未发现当前交付把CA接入失败表达为退赛或提交硬阻断；命中项均为历史整改记录或“不得如此表达”的护栏 |

## 9.3 未完成的验证

浏览器级烟测未完成，原因是当前验证环境存在工具限制：

* Python环境缺少`playwright`模块。
* Node侧`playwright`包缺少`playwright-core`。
* 内置浏览器按安全策略拒绝打开`file://`本地页面。

因此，本轮可靠验证范围为脚本语法、静态DOM入口、文档验收矩阵和口径搜索。进入`DEV-4`建立正式应用框架后，应补齐可运行开发服务器、浏览器自动化烟测和服务端权限测试。
