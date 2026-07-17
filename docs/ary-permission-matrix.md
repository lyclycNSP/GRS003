# ARY MVP Permission Matrix

版本：v0.4
文档类型：Permission Matrix
上游入口：`ary-mvp.prd.md`
领域基线：`ary-domain-analysis.v0.3.md`
当前实现参考：`../web/lib/auth.ts`、`../web/lib/domain.ts`、`../web/app/console/page.tsx`、`../web/tests/domain.test.ts`

---

# 1. 文档目的

本文是 ARY MVP 的权限矩阵附件，定义资源动作级访问规则。PRD 只保留角色原则；实际架构设计、接口鉴权、页面入口和测试用例应以本文为权限输入。

MVP 使用 GitHub Account 登录；用户补充公共账号资料后成为 ARY User。角色资格通过规范化 `UserRole` 表达，一个用户可同时拥有 `rider`、`judge`、`organizer`、`admin` 多个有效资格；每个 `AuthSession` 只保存一个 `activeRole`。页面、查询、Server Action 与 API 必须按当前会话的 `activeRole` 和资源归属鉴权，不得合并多个角色的权限。

`RoleApplication` 按“用户 + 申请角色”保存草稿、待审、通过、驳回和撤回记录。Rider 完成分类资料后可自助开通；Judge、Organizer 需 Admin 审核；Admin 不出现在注册入口，只能由有效 Admin 授予。Admin 激活时不获得 Organizer、Rider 或 Judge 的业务权限，执行相应业务前必须切换角色。

---

# 2. 角色与范围规则

| 角色 | 权限范围 |
|---|---|
| Public | 未登录或未授权公众，只能访问已公开、已发布资源 |
| Rider | 当前会话激活有效 `rider` 资格的用户，只能管理自己的报名、RaceProject、Work、报告和可见骑行摘要 |
| Judge | 当前会话激活有效 `judge` 资格的用户，只能访问分配给自己的评审任务和相关作品 / Evidence 摘要 |
| Organizer | 当前会话激活有效 `organizer` 资格的用户，只能管理自己负责的 Race 及其报名、提交、评审、榜单、报告和展示 |
| Admin | 当前会话激活有效 `admin` 资格的用户，可以管理角色申请和资格状态，并进行带审计的系统异常处理；不继承业务角色权限 |

范围说明：

* `own` 表示仅限当前用户自己的资源。
* `assigned` 表示仅限分配给当前评委的资源。
* `managed race` 表示仅限当前主办方负责的赛事。
* `public` 表示仅限公开且已发布的资源。
* `system` 表示系统管理范围，MVP 中主要由 Admin 承担。

`managed race` 判定规则：

* MVP 不引入 Organization。
* Organizer 可管理的 Race 由 Race 上的 organizer 用户集合或创建者关系判定。
* 若后续数据模型保存 `organizerUserIds`、`createdByUserId` 或类似字段，接口鉴权必须以这些关系判断 `managed race` 范围。

---

# 3. 权限矩阵

## 3.1 Race

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view_public | public | public | public | public | public |
| view_private | - | own registered race | assigned race | managed race | system |
| create | - | - | - | yes | system |
| edit | - | - | - | managed race | system |
| publish | - | - | - | managed race | system |
| archive | - | - | - | managed race | system |

## 3.2 Registration

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| submit | - | own | - | - | - |
| view | - | own | assigned work context | managed race | system |
| approve | - | - | - | managed race | system |
| reject | - | - | - | managed race | system |
| withdraw | - | own before locked | - | managed race exception | system exception |

规则：

* 一个 User 对同一 Race 最多一个 Registration。
* 团队参赛时，Registration 的 `participantType=team`，`teamId` 指向对应 Team，`userId` 记录队长 / 创建者。
* 同一 User 不能同时个人报名和加入同一 Race 的团队。
* CA 接入状态不驱动 Registration 进入 `withdrawn`；RaceProject 聚合接入 failed / not_configured 只表达证据缺口或接入异常，并进入评审前风险提示。

## 3.2.1 Team / TeamMember

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| create_team | - | active Rider while registration is open | - | - | - |
| join_team | - | invite code before submitted | - | - | - |
| leave_team | - | member before submitted | - | - | - |
| update_team | - | captain before submitted | - | - | - |
| remove_member | - | captain before submitted | - | - | - |
| submit_team_registration | - | captain before submitted | - | - | - |
| view_team_status | - | own team | assigned work context | managed race | system |

规则：

* Team 只用于当前 Race 的轻量团队参赛，不表达 Organization、学校或长期团队。
* Team `draft` 阶段可加入、退出或移除成员；提交后进入 `submitted`，审核通过后进入 `locked`。
* 团队至少 2 人才能提交团队报名。
* 团队人数上限由队长在 2–10 人内设置，默认 5；不得调低到当前成员数以下。团队简介可选，提交后与成员名单一起锁定。
* 建队、入队和提交报名均重新校验报名窗口、当前 Rider 身份、赛事角色冲突、唯一参赛关系、团队状态与邀请码所属 Race。
* Team 提交后生成一条团队 Registration，后续 RaceProject、CAConnection、Work、Award、Report 均沿用 Registration 闭环。

## 3.3 RaceProject

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| create | - | - | - | managed race assistance | system |
| view_status | - | own | assigned work summary | managed race | system |
| register_ca_connection | - | own approved registration during race participation | - | managed race assistance | system exception |
| manage_ca_connection | - | own connection metadata | - | managed race exception | system exception |
| view_session_summary | - | own | assigned work summary | managed race | system |
| view_raw_session | - | - | - | managed race internal exception | system |
| sync_status | - | own status | - | managed race | system |

规则：

* Registration approved 后由系统幂等创建 RaceProject；Rider 不手动创建自己的 RaceProject。
* 同一 RaceProject 可配置多个 CAConnection；CAConnection 可在参赛过程中新增。
* 团队参赛时，TeamMember 可以为团队 RaceProject 登记自己的 CAConnection，连接保留 `ownerUserId` 便于审计。
* 只有已登记、已握手、归属正确且未禁用的 CAConnection 后续数据可以进入 Projection、Evidence 或 Report 输入。
* 单个 CAConnection failed 或 RaceProject 聚合接入 failed 不触发 Registration 自动退赛，只形成连接异常、证据缺口和评审前风险提示。
* GitHub Repo 只能作为作品代码入口或 Evidence 外部材料引用，不能替代任何实时 CAConnection。
* 原始 CA Session 默认不公开，公开端永不读取原始 CA Session。
* Rider、Judge 默认读取 Session Summary 或 Evidence 摘要，不直接读取原始 CA Session。

## 3.4 Work

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view_public | public | public | public | public | public |
| view_private | - | own | assigned | managed race | system |
| create | - | own registration | - | - | system exception |
| submit | - | own registration | - | - | system exception |
| configure_submission_window | - | - | - | managed race, judging 前 | system |
| lock_submission_window | - | - | - | managed race, reason required | system |
| reopen_submission_window | - | - | - | - | no assignment, reason + future deadline |
| publish | - | - | - | managed race | system |
| hide | - | own if draft | - | managed race | system |
| review | - | - | assigned | - | - |

规则：

* Work 是作品资产，不是提交记录本身。
* MVP 阶段一个 Registration 最多一个主 Work。
* 只有 approved Registration 本人可以提交；Organizer 和其他 Rider 不得代提交。
* 每次提交创建不可更新、不可删除的 WorkSubmissionVersion，Work 字段只是当前版本投影。
* Organizer 可配置或提前关闭全场提交，但不能解锁；Admin 仅在尚无 JudgeAssignment 时可带原因和未来截止时间重开。
* 未版本化 legacy Work 可继续读取；重新评审或首次公开前必须由 Rider 创建真实版本。
* 团队参赛时，主 Work 由队长提交；普通成员可维护 CAConnection，但不能直接覆盖团队 Work。

## 3.5 Evidence

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view_public | public | public | public | public | public |
| view_private_summary | - | own | assigned work context | managed race | system |
| view_raw_source | - | - | - | managed race internal exception | system |
| set_visibility | - | own limited | - | managed race | system |
| cite_in_report | - | - | - | managed race | system |

规则：

* Evidence 通过 `sourceRef` 引用来源。
* 公开端只展示可公开 Evidence 摘要，不暴露敏感原始 Session。
* Rider 默认管理 Evidence 可见性和摘要，不直接读取敏感原始来源。

## 3.5A ReviewFlag / Review Readiness

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view_public | - | - | - | - | - |
| view_private | - | own / team related | assigned work context | managed race | global read-only |
| mark_in_review | - | - | - | managed race | - |
| resolve | - | - | - | managed race | - |
| reopen | - | own / team related flag | - | managed race | - |
| add_resolution_note | - | - | read assigned result only | managed race | - |

规则：

* `ReviewFlag` 用于表达空骑行、无 CA 数据、缺材料、接入异常、疑似违规和过程性风险提示，不自动替代人工评审。
* Rider 只能看到与自己相关且对整改有帮助的风险摘要，不读取 Organizer 内部判断或原始 CA 证据。
* Judge 只能读取分配作品相关的风险摘要和处置结果，用于评审上下文，不直接执行风险关闭。
* Organizer 只能处置自己管理 Race 的风险；Admin 提供跨赛事只读治理、筛选和审计视图，不替代 Organizer 处置。
* Rider 的 own 范围包含本人个人 Registration 以及本人所在团队的 Registration；团队成员可在整改后重新打开相关风险。
* 风险被 `resolved` 后仍保留审计记录，并继续在 Judge 评审上下文中可见。
* `open` / `in_review` 是辅助判断信号，不自动阻断报名、Work 提交或 Judge 评审。

## 3.6 JudgeAssignment

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view | - | own aggregate after release | assigned own / aggregate after completion | managed race | governance read only |
| manage_judge_pool | - | - | - | managed race | - |
| allocate_batch | - | - | - | managed race | - |
| remove_pool_member | - | - | - | managed race, unassigned only | - |

规则：

* JudgeAssignment 应记录 `assignedByUserId`、slot 和 allocationBatchId；仅管理该 Race 的 active Organizer 可维护 Judge 池和执行批量分配，Admin 不替代 Organizer 经营赛事。
* Judge 池只接受 active Judge，且不得包含本场个人或团队参赛者；已有 Assignment 的池成员不可移除。
* 只能在提交窗口关闭后分配；创建时绑定 Work 当前 WorkSubmissionVersion，Judge 后续始终读取该固定版本。
* 每件 Work 必须恰好拥有三个不同 Judge。候选不足、版本冲突、已有超过三条 Assignment 或重复关系时整批拒绝且零写入。

## 3.7 JudgingRecord

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view_published_summary | public | own work result | assigned | managed race | system |
| view_private | - | own result after release | assigned own record | managed race | system |
| create | - | - | assigned | - | - |
| submit | - | - | assigned | - | - |
| update_before_submit | - | - | assigned own record | - | - |

规则：

* JudgingRecord 应来源于 JudgeAssignment；评分两个维度均为 0–100 整数，评论最长 2000 字。
* Organizer 可查看全场评审进度和聚合分；Judge 只有在本人已提交且同 Work 三份评审全部完成后才能读取聚合分，且不能读取其他 Judge 的单项记录。
* Rider 只有在 Organizer 发布评审结果后才能读取本人 Work 的维度均分；公共访客不读取内部均分，只读取正式 Award。
* 发布评审结果后锁定 JudgingRecord、Judge 池和 Assignment。平均分不自动生成 Award，Award 仍由 Organizer 手工发布。

## 3.6.1 Registration 审核与参赛选手库

* 仅管理该 Race 的 active Organizer 可审核 pending Registration。通过与拒绝均记录审核人、时间；拒绝必须填写原因。
* 通过操作必须幂等且原子：Registration 更新、团队锁定、唯一 RaceProject 和一次初始 CA 缺失风险不可出现部分成功。
* Race Workspace 只展示 pending 队列；受权参与者库展示 approved 参赛者和 rejected / withdrawn / cancelled 历史。隐藏或篡改 `raceId` 不改变服务端 managed Race 鉴权。

## 3.8 Award / Leaderboard

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view_published | public | public | public | public | public |
| view_draft | - | - | - | managed race | system |
| create_draft | - | - | - | managed race | system |
| edit_draft | - | - | - | managed race | system |
| publish | - | - | - | managed race | system |
| withdraw_publication | - | - | - | managed race | system |

规则：

* Award 授予 Registration，可选关联获奖 Work。
* Award 若关联 Work，必须在版本冻结后绑定明确的 WorkSubmissionVersion；旧数据允许版本引用为空。
* Leaderboard 是按 Award.rank 排列的读取模型。
* Award / Leaderboard draft 在发布前只允许 managed race Organizer 和 Admin 查看，避免提前泄露赛果。

## 3.9 Projection

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view_public | public via Live Hall | public via Live Hall | public via Live Hall | public via Live Hall | public via Live Hall |
| view_internal | - | own summary | assigned context | managed race | system |
| rebuild | - | - | - | managed race | system |
| inspect_status | - | - | - | managed race | system |

规则：

* Projection 是过程展示数据，可以重建，不作为最终事实源。
* Projection 失败不影响核心事实数据。

## 3.10 Report

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view_public_published | public report | public report | public report | public report | public report |
| view_private | - | own rider_report | assigned context summary | managed race | system |
| generate | - | - | - | managed race | system |
| edit | - | - | - | managed race | system |
| publish | - | - | - | managed race | system |
| regenerate | - | - | - | managed race | system |

规则：

* `rider_report` 必须关联 `subjectRegistrationId`。
* `race_report` / `review_summary` 的 `subjectRegistrationId` 必须为空。
* Public 只能查看已发布且公开可见的 `race_report` / `review_summary`；`rider_report` 默认只允许对应 Rider、managed race Organizer 和 Admin 查看，除非后续单独增加公开发布规则。

## 3.11 User

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| sign_in_github | yes | yes | yes | yes | yes |
| update_profile | - | own | own | own | own |
| view_public_profile | public | public | public | public | public |
| view_private_profile | - | own | own | managed race user summary | system |
| update_roles | - | - | - | - | system |

规则：

* Admin Console 只承载基础账号、角色申请和 `UserRole` 资格状态管理。
* MVP 不建立独立 `RoleAssignment` 实体。

## 3.12 Announcement

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view_public | public | public | public | public | public |
| view_private | - | - | - | managed race | system |
| create | - | - | - | managed race | system |
| edit | - | - | - | managed race | system |
| publish | - | - | - | managed race | system |
| hide | - | - | - | managed race | system |

## 3.13 ScreenDisplay

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view_public_display | public | public | public | public | public |
| view_private_preview | - | - | - | managed race | - |
| configure | - | - | - | managed race | - |
| switch_mode | - | - | - | managed race | - |
| fallback_to_stable_projection | - | - | - | managed race | - |
| fallback_to_static_notice | - | - | - | managed race | - |

规则：

* Screen Console 使用 `/screen?raceId={raceId}`，必须显式指定 Race，且只允许当前激活 Organizer 管理自己负责的 Race；缺失、无效或未授权 ID 不回退默认赛事。
* Display 使用 `/screen/display/{raceId}`；public 且非 draft 的 Race 可匿名查看，draft/private 仅对应 Organizer 预览，旧 `/screen/display` 不读取任何默认赛事。
* 大屏展示失败时，可切换到最近一次稳定 Projection 或静态榜单 / 公告。

---

# 4. 测试要求

权限测试至少覆盖：

* Public 不可访问后台、原始 CA Session、未发布 Work、未发布 JudgingRecord 和未发布 Report。
* Rider 只能操作自己的 Registration、RaceProject、Work、rider_report 和私有摘要。
* Judge 只能访问分配给自己的 Work、Evidence 摘要和 JudgingRecord。
* Organizer 只能管理自己负责的 Race 及其相关资源。
* Admin 可以维护 `UserRole` 资格，但 Admin Console 不承担赛事执行、CA 接入维护或数据运营职责。
* Projection 重建与 Report 生成只能由 Organizer 管理赛事范围或 Admin 系统范围执行；大屏控制仅由当前激活 Organizer 在 managed Race 范围执行。

---

# 5. 当前实现状态（正式集成应用口径）

本权限矩阵是 ARY MVP 的资源动作级规范，是服务端鉴权和 Console 入口可见性的输入。根目录旧 `app/` 静态 MVP 已移除；当前实现以 `web/` 为准，权限落地状态如下：

| 权限实现维度 | 当前状态 | 代码 / UI 入口 |
|---|---|---|
| 角色身份 | GitHub OAuth 会话读取用户；本地调试可通过 `/debug-login` 写入单角色覆盖 cookie，隔离 Organizer / Admin / Rider / Judge | `web/lib/auth.ts`、`web/app/debug-login/page.tsx` |
| Server-side 鉴权 | Server Actions 从服务端 auth context 读取 actor，领域动作执行角色、所有权和 race 范围校验 | `web/app/actions.ts`、`web/lib/domain.ts` |
| 已落地的 actor 校验 | Judge 评分校验 assignment 归属；Organizer/Admin 才能管理当前 Race、Screen、Award、Report；Rider 只能操作自己的 Registration / RaceProject / Work；团队成员可接入团队 RaceProject，团队 Work 由队长提交 | `web/lib/domain.ts`、`web/tests/domain.test.ts` |
| 公开端访问控制 | 公开 Works / Results / Review 只读取已发布和公开资源；非公开 Work detail 不返回公开详情 | `web/lib/queries.ts`、`web/tests/domain.test.ts` |
| 数据可见性 | `rider_report` 保持 private；`race_report` / `review_summary` 可发布为 public；Award 校验 registration/work 属于当前 Race | `web/lib/domain.ts` |
| 跨用户与跨会话隔离 | 生产路径依赖服务端会话；每个会话独立保存 `activeRole`，切换一个设备不影响其他设备 | `web/lib/auth.ts` |

**正式工程化启动时必须补齐**：

1. 将本地 SQLite / seed 调试路径替换为生产数据库和正式 OAuth 配置。
2. 为接口层继续补齐越权请求审计和错误响应一致性。
3. 数据库迁移时持续校验权限判定所需的关系字段（`Race.organizerUserIds`、`Registration.userId`、`Work.registrationId`、`JudgeAssignment.judgeUserId` 等）对应唯一约束和外键。
4. 完成跨设备、跨会话的角色切换、会话失效和审计日志策略。
5. 审计日志：记录被拒绝的越权请求，便于 QA 和安全复盘。

正式权限测试需在服务端鉴权接入后，按本矩阵全量回归；本节当前只反映本地 MVP 实现口径。
## Race Live / Screen 权限补充

| 动作 | Public/Rider/Judge | Organizer | Admin |
| --- | --- | --- | --- |
| 查看公开 Race Live | 允许 | 允许 | 允许 |
| 暂停/继续、前后组、配置间隔 | 禁止 | 仅 managed Race | 禁止 |
| fallback 开关和展示模式 | 禁止 | 仅 managed Race | 禁止 |
| 修改 RaceRound/Track 绑定 | 禁止 | 仅 managed Race 且符合 Round 状态 | 允许 |

Routine Screen control 仅归当前激活 Organizer；Admin 不复用赛事大屏控制入口。Coach/Cockpit 不参与 ARY 授权模型。

## Race Live / Track Calibrator 增量权限

| 动作 | Rider | Judge | Organizer | Admin |
| --- | --- | --- | --- | --- |
| 查看公开 Race Live | 允许 | 允许 | 允许 | 允许 |
| 控制自动轮播 / mode / fallback | 禁止 | 禁止 | 仅 managed Race | 禁止 |
| 打开 Track Calibrator | 禁止 | 禁止 | 仅 managed Race | 允许 |
| 发布 Race Track | 禁止 | 禁止 | 仅 managed Race | 允许 |
| 发布 system Track | 禁止 | 禁止 | 禁止 | 允许 |
| 绑定 TrackProfileVersion 到 Round | 禁止 | 禁止 | 仅 managed Race 的 pending Round | 允许；仅 pending Round |

Track Calibrator 的 IndexedDB Draft 不参与服务端授权，也不是 ARY 事实源；每次发布仍在服务端重新鉴权和校验。
## 赛题附件与作品外部内容

| 能力 | Organizer | Rider | Judge | Admin / Public |
| --- | --- | --- | --- | --- |
| 上传/发布赛题 PDF | 仅 managed Race；已发布后必须新修订 | 否 | 否 | 否 |
| 下载 private/draft 赛题 | 仅 managed Race，可查看全部安全修订 | 仅当前 Race 的有效个人报名、团队成员或团队筹备成员，可下载当前 `clean` 修订 | 否 | 否 |
| 下载 public 已发布修订 | 是 | 是 | 是 | 是 |
| 授权 GitHub App / 提交 Work | 否 | 仅本人或团队队长 | 否 | 否 |
| 查看私有 Repo 元数据 | managed Race 上下文 | 本人 | 仅 assigned Work | Admin 仅治理摘要；Public 不披露私有 Repo URL |

附件扫描失败时所有角色均不得下载。GitHub App 验证只证明仓库与 Commit 归属，不授予 ARY 执行代码的权限。
Rider 的私有下载资格在每次请求时重新校验，拒绝、撤回或取消报名后立即失效；Rider 不得枚举或下载历史未发布修订。
赛题正文归 Organizer 自有对象存储所有；ARY 仅在上传请求期间进行内存检查，并在下载时签发最长 300 秒的临时地址。平台本地长期存储不属于允许的生产能力。

上传、扫描、发布或下载失败时，页面只消费服务端允许列表中的动作代码并显示受控原因；恢复入口只能重新选择、重试、返回对应 Race Workspace 或继续使用最后一个安全修订。客户端提供的 `next`、错误文案、对象 Key 或隐藏 `raceId` 均不得参与鉴权或改变资源范围。

Registration 审核、Judge 池维护、批次分配与评审结果发布均只允许 managed Race 的 active Organizer。所有按钮的 pending 和结果面板只是反馈层；服务端仍须在事务内复核 activeRole、managed Race、Registration/Work 状态和 Judge 冲突。
