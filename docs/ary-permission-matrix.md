# ARY MVP Permission Matrix

版本：v0.3
文档类型：Permission Matrix
上游入口：`ary-mvp.prd.md`
领域基线：`ary-domain-analysis.v0.3.md`

---

# 1. 文档目的

本文是 ARY MVP 的权限矩阵附件，定义资源动作级访问规则。PRD 只保留角色原则；实际架构设计、接口鉴权、页面入口和测试用例应以本文为权限输入。

MVP 使用 GitHub Account 登录；用户补充个人资料后成为 ARY User。用户身份通过 `User.roles` 集合表达，可同时拥有 `rider`、`judge`、`organizer`、`admin` 多重身份；MVP 不建立独立 `RoleAssignment` 实体。

---

# 2. 角色与范围规则

| 角色 | 权限范围 |
|---|---|
| Public | 未登录或未授权公众，只能访问已公开、已发布资源 |
| Rider | 拥有 `rider` role 的用户，只能管理自己的报名、RaceProject、Work、报告和可见骑行摘要 |
| Judge | 拥有 `judge` role 的用户，只能访问分配给自己的评审任务和相关作品 / Evidence 摘要 |
| Organizer | 拥有 `organizer` role 的用户，只能管理自己负责的 Race 及其报名、提交、评审、榜单、报告和展示 |
| Admin | 拥有 `admin` role 的用户，可以维护用户角色，并可进行必要系统管理和异常处理 |

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
* CA 接入状态不驱动 Registration 进入 `withdrawn`；RaceProject 聚合接入 failed / not_configured 只表达证据缺口或接入异常，并进入评审前风险提示。

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
| lock | - | - | - | managed race | system |
| publish | - | - | - | managed race | system |
| hide | - | own if draft | - | managed race | system |
| review | - | - | assigned | - | - |

规则：

* Work 是作品资产，不是提交记录本身。
* MVP 阶段一个 Registration 最多一个主 Work。

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

## 3.6 JudgeAssignment

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view | - | - | assigned | managed race | system |
| create | - | - | - | managed race | system |
| update | - | - | - | managed race | system |
| remove | - | - | - | managed race | system |

规则：

* JudgeAssignment 应记录 `assignedByUserId`。
* 分配人应拥有 `organizer` 或 `admin` role。

## 3.7 JudgingRecord

| Action | Public | Rider | Judge | Organizer | Admin |
|---|---|---|---|---|---|
| view_published_summary | public | own work result | assigned | managed race | system |
| view_private | - | own result after release | assigned own record | managed race | system |
| create | - | - | assigned | - | - |
| submit | - | - | assigned | - | - |
| update_before_submit | - | - | assigned own record | - | - |

规则：

* JudgingRecord 应来源于 JudgeAssignment。
* MVP 暂不处理奖项推荐。

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

* Admin Console 只承载基础账号、个人资料状态和 `User.roles` 管理。
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
| configure | - | - | - | managed race | system |
| switch_mode | - | - | - | managed race | system |
| fallback_to_stable_projection | - | - | - | managed race | system |
| fallback_to_static_notice | - | - | - | managed race | system |

规则：

* Screen Console 是独立控制台，不混入 Race Console。
* 大屏展示失败时，可切换到最近一次稳定 Projection 或静态榜单 / 公告。

---

# 4. 测试要求

权限测试至少覆盖：

* Public 不可访问后台、原始 CA Session、未发布 Work、未发布 JudgingRecord 和未发布 Report。
* Rider 只能操作自己的 Registration、RaceProject、Work、rider_report 和私有摘要。
* Judge 只能访问分配给自己的 Work、Evidence 摘要和 JudgingRecord。
* Organizer 只能管理自己负责的 Race 及其相关资源。
* Admin 可以维护 `User.roles`，但 Admin Console 不承担赛事执行、CA 接入维护或数据运营职责。
* Projection 重建、Report 生成、大屏 fallback 等内部维护动作只能由 Organizer 管理赛事范围或 Admin 系统范围执行。
