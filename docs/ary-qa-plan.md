# ARY MVP QA Plan

版本：v0.3
文档类型：QA Plan
上游入口：`ary-mvp.prd.md`
领域基线：`ary-domain-analysis.v0.3.md`
权限矩阵：`ary-permission-matrix.md`

---

# 1. 文档目的

本文定义 ARY MVP 的测试覆盖范围、关键测试类型和 P0 回归要求。PRD 保留产品验收目标；本文负责把验收目标转成可执行测试范围。

测试原则：

* 优先保证首场赛事完整闭环。
* 优先覆盖权限、CA 实时接入、Projection、Report、大屏和公开展示。
* 所有测试必须遵守实时 CA 接入规则：CA 接入状态不作为参赛资格硬门禁；未登记、未握手、归属错误或被禁用的 CA 数据不得污染 Projection、Evidence 或 Report；不接受事后上传 Session Summary 伪造实时 CA 证据。

---

# 2. 测试覆盖

## 2.1 赛事生命周期测试

覆盖流程：

```text
创建赛事
-> 发布赛事
-> 用户报名
-> 审核报名
-> ARY 自动生成 RaceProject
-> 实时 CA 接入
-> 开赛
-> 作品提交
-> 评审分配
-> 评审提交
-> 发布赛果
-> 发布评审总结
-> 归档赛事
```

验收点：

* Race status 可以按预期流转。
* Registration approved 后 RaceProject 自动幂等生成，Registration、RaceProject、Work、JudgeAssignment、JudgingRecord、Award、Report 可以形成闭环。
* RaceProject 聚合 CA 接入 failed / not_configured 不阻断 Work Submission、评审和 Award 流程，但必须形成评审前风险提示。

## 2.2 角色路径测试

覆盖角色：

* Public：浏览首页、Race Page、Live Hall、Works、Results、Review、Rider Profile。
* Rider：GitHub 登录、资料补全、报名、进入自动生成的 RaceProject、查看 CA 接入状态、提交 Work、查看报告。
* Judge：查看分配作品、查看 Evidence 摘要、评分、提交评语。
* Organizer：创建赛事、管理报名、分配评委、发布榜单、生成和发布报告。
* Admin：查看用户、查看资料补全状态、维护 `User.roles`。
* Screen Operator：进入 Screen Console、选择赛事、切换视图、进入全屏、执行 fallback。

验收点：

* 各角色只能看到与自己职责匹配的入口。
* 多 role 用户可以在授权范围内切换对应视图。
* Screen Operator 不是独立 role，通常由 Organizer 或 Admin 承担。

## 2.3 权限测试

覆盖规则：

* Public 不能访问后台、原始 CA Session、未发布 Work、未发布 JudgingRecord、未发布 Report。
* Public 不能访问 `rider_report`，除非后续单独增加公开发布规则。
* Rider 不能查看其他选手的非公开 Session、私有 Evidence、未发布评分和报告。
* Rider / Judge 不能查看未发布 Award / Leaderboard draft。
* Judge 不能查看未分配给自己的作品，不能越权评分。
* Organizer 只能管理自己负责的 Race。
* Admin 可以维护 `User.roles`，但 Admin Console 不承担赛事执行、CA 接入维护或数据运营职责。
* 非 Admin 不能修改 `User.roles`。

验收点：

* 每个资源动作必须符合 `ary-permission-matrix.md`。
* 越权请求必须被拒绝，不能只在 UI 层隐藏入口。

## 2.4 CA 接入测试

覆盖场景：

* 实时 CA 接入成功。
* 单个选手 RaceProject 聚合 CA 接入失败。
* 多个选手中部分接入失败。
* 单个选手绑定多个 CAConnection，部分 CAConnection 接入失败但仍有可用连接。
* 单个选手绑定多个 CAConnection，全部 CAConnection 接入失败。
* 参赛过程中新增多个 CAConnection，并在登记和握手成功后接入骑行数据。
* 未登记、未握手、归属错误或被禁用的 CAConnection 尝试 push 骑行信号或提供 Session Snapshot。
* RaceProject Aggregate Ingestion Status 覆盖 not_configured、connected、active、failed。
* CAConnection Ingestion Status 覆盖 not_configured、connected、active、failed。
* GitHub Repo / 代码材料绑定成功。
* 重复同步同一 Session 或重复引用同一代码材料。
* 接入状态可追踪。
* 空骑行、无 CA 数据、空作品、缺必填材料、疑似违规和接入异常可以生成评审前风险提示。

验收点：

* 接入成功的 Registration 可以进入比赛后续流程。
* RaceProject 聚合接入 failed / not_configured 的 Registration 仍可进入提交、评审和 Award 流程，但 Organizer / Judge 必须看到风险提示。
* 部分或全部 CAConnection failed 时，该 Registration 不应被自动视为退赛。
* 未登记、未握手、归属错误或被禁用的 CAConnection 数据不得进入 Projection、Evidence、Report 或评审摘要。
* not_configured / failed 时可以完成 Work Submission，但必须生成证据缺口或接入异常风险提示；connected / active 时展示正常证据状态。
* 部分选手接入失败不影响 Public Site、Live Hall、Screen Console 和其他选手。
* 重复同步不应生成重复事实或污染 Projection。
* GitHub 代码材料不能替代实时 CA 接入。

## 2.5 Projection 测试

覆盖场景：

* Projection 可生成。
* Projection 可手动重算。
* Projection 失败不污染核心事实数据。
* Projection 失败后可回退到最近一次稳定 Projection。
* Live Hall 和 Screen Console 读取 Projection 或稳定 fallback。

验收点：

* Projection 不是最终事实源。
* Award、Report、Leaderboard 不依赖过程 Projection 作为最终结果事实。

## 2.6 Report 测试

覆盖场景：

* rider_report 生成、查看。
* race_report 生成、编辑。
* review_summary 生成、编辑、发布。
* Report 生成失败后手动重跑。
* 未发布 Report 不出现在 Public Site。

验收点：

* `rider_report` 必须关联 `subjectRegistrationId`。
* `race_report` / `review_summary` 的 `subjectRegistrationId` 必须为空。
* `rider_report` 默认只允许对应 Rider、managed race Organizer 和 Admin 查看。
* 已发布 Review 必须来自已发布 `review_summary` Report。

## 2.7 大屏测试

覆盖场景：

* Screen Console 选择赛事。
* Jumbotron / Billboard 切换。
* Live / 榜单 / 作品 / 公告切换。
* 全屏展示。
* 弱网或断流时 fallback 到最近一次稳定 Projection。
* Projection 不可用时 fallback 到静态榜单或公告。

验收点：

* 大屏展示失败不影响公开网页核心数据。
* 大屏 fallback 不改变核心事实数据。

## 2.8 非功能 / 性能测试

覆盖场景：

* 公开页首屏响应时间。
* Live Hall 数据刷新。
* Screen Console 等页面切换加载首屏。
* 公开端、Live Hall、Results、Works、Rider Profile 的并发访问。

验收点：

* 公开页首屏目标响应时间：1s 内。
* Live Hall 数据刷新目标：3s 内。
* Screen Console 等页面切换加载首屏目标响应时间：1s 内。
* MVP 应支持同时在线 200 用户访问公开端、Live Hall、Results、Works 和 Rider Profile 等公开页面。
* 性能测试不应绕过权限、可见性和 Projection / Report 读取边界。

## 2.9 回归测试

P0 回归必须一键跑通：

```text
GitHub 登录
-> 资料补全
-> Admin 分配 roles
-> Organizer 创建并发布 Race
-> Rider 报名
-> Organizer 审核
-> ARY 自动生成 RaceProject
-> 实时 CA 接入成功
-> Live Hall 展示 Projection
-> Rider 提交 Work
-> Organizer 分配 Judge
-> Judge 提交 JudgingRecord
-> Organizer 发布 Award / Leaderboard
-> Report 生成和发布
-> Public 查看 Results / Review / Work / Rider Profile
-> Screen Console 展示赛事状态
```

---

# 3. 测试完成标准

进入首场赛事彩排前，应满足：

* P0 回归测试通过。
* 权限测试无高危漏洞。
* CA 接入成功、部分失败、重复同步场景通过。
* Projection 生成、重算、失败不污染事实数据场景通过。
* Report 生成、发布、未发布不可见场景通过。
* 大屏基础展示和 fallback 场景通过。
* 非功能 / 性能测试达到 PRD 中的 P0 工程就绪目标。
