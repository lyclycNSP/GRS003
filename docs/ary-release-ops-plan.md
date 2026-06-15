# ARY MVP Release & Ops Plan

版本：v0.1
文档类型：Release & Ops Plan
上游入口：`ary-mvp.prd.md`
项目计划：`ary.plan.md`
测试计划：`ary-qa-plan.md`

---

# 1. 文档目的

本文定义 ARY MVP 的发布、部署、监控、备份、值守、回滚和赛事当天稳定性要求。目标不是建立复杂运维体系，而是保证首场标杆赛事稳定完成。

关键规则：

* 实时 CA 接入是骑行过程证据、Projection 输入和评审参考，不是参赛资格硬门禁。
* CAConnection 可在参赛过程中新增，但必须先完成登记和握手，后续数据才可进入有效 Projection、Evidence 或 Report 输入。
* RaceProject 聚合 CA 接入失败、无 CA 数据或空骑行应形成评审前风险提示，不自动取消该选手提交、评审或 Award 资格。
* MVP 不接受事后上传 Session Summary 伪造实时 CA 证据；如作为说明材料引用，必须标记来源、时间和可信度。
* 单个选手 RaceProject 聚合 CA 接入失败不应影响赛事整体展示和其他选手。

---

# 2. 环境

| 环境 | 用途 | 要求 |
|---|---|---|
| dev | 日常开发和本地调试 | 可使用 mock 数据，不承载正式赛事 |
| staging | 彩排、验收、灰度验证 | 使用接近生产的配置和种子数据 |
| production | 正式赛事 | 只部署已验收版本 |

要求：

* 正式赛事前必须在 staging 完成至少一次完整赛事流程演练。
* production 发布必须有可回滚版本。
* 开赛冻结窗口内只允许修复阻断赛事的 P0 问题。

---

# 3. 数据备份

## 3.1 赛前备份

赛前至少备份：

* User / roles。
* Race 配置。
* Registration。
* RaceProject 自动生成状态。
* Work 草稿和已提交作品。
* JudgeAssignment。

## 3.2 赛中关键数据备份

赛中重点保护：

* CA 接入状态。
* Session 摘要和 Metrics 输入。
* Work 提交。
* JudgingRecord。
* Award 草稿。
* Projection 最近一次稳定版本。

## 3.3 赛后归档

赛后归档：

* Race。
* Registration。
* Work。
* Award / Leaderboard。
* Report。
* Review。
* 赛事当天事故记录和运维复盘。

---

# 4. 监控

必须监控：

* GitHub 登录成功率。
* 资料补全和 `User.roles` 更新。
* 报名提交和审核。
* CA 实时接入状态。
* Projection 生成、重算和失败。
* Live Hall 数据刷新。
* Screen Console 展示状态。
* Screen Console 首屏和视图切换响应时间。
* Report 生成、编辑和发布。
* Public Site 关键页面响应时间。
* 公开端、Live Hall、Results、Works、Rider Profile 的并发访问压力。

告警原则：

* 影响 Public Site、Live Hall、Screen Console 的问题优先级最高。
* 单个选手 RaceProject 聚合 CA 接入失败、无 CA 数据或空骑行应记录并展示给主办方，进入评审前风险提示，但不触发赛事整体事故。
* 未登记、未握手、归属错误或被禁用的 CAConnection 信号应拒收或隔离审计，不进入 Projection、Evidence 或 Report。
* 多个选手集中接入失败应进入赛事当天技术值守处理。

---

# 5. 赛事当天值守

| 职责 | 负责内容 |
|---|---|
| 产品值守 | 判断业务规则、赛事流程、公开展示优先级 |
| 技术值守 | 登录、权限、CA 接入、Projection、Report、发布和回滚 |
| 数据值守 | 数据状态核对、Projection 重算、Report 重跑、异常数据标记 |
| 现场大屏值守 | Screen Console、投屏设备、全屏展示、fallback 切换 |
| 主办方值守 | 报名、选手沟通、评委协调、榜单和报告发布确认 |

要求：

* 值守人员必须在赛前完成一次全流程演练。
* 大屏值守必须熟悉 Jumbotron / Billboard / 公告 fallback。
* 技术值守必须掌握回滚路径。

---

# 6. 冻结窗口

建议冻结窗口：

* 正式开赛前 24 小时进入功能冻结。
* 正式开赛前 4 小时进入发布冻结。
* 赛事进行中不发布非 P0 修复。

允许变更：

* 修复登录不可用。
* 修复 Public Site、Live Hall、Screen Console 不可用。
* 修复权限高危漏洞。
* 修复数据丢失或事实数据污染风险。

不允许变更：

* 临时放宽 CA 数据校验、让未登记或未握手连接数据进入 Projection、Evidence 或 Report。
* 临时新增评审规则。
* 临时新增后台功能。
* 临时修改核心领域模型。

---

# 7. 彩排

至少一次完整彩排必须覆盖：

```text
GitHub 登录
-> 资料补全
-> Admin 分配 roles
-> Organizer 创建并发布 Race
-> Rider 报名
-> Organizer 审核
-> ARY 自动生成 RaceProject
-> 实时 CA 接入
-> Live Hall 展示
-> Screen Console 展示
-> Work 提交
-> Judge 评审
-> Award / Leaderboard 发布
-> Report / Review 发布
-> 赛后归档
```

彩排必须同时验证：

* P0 回归。
* 权限边界。
* Projection 重算。
* 大屏 fallback。
* Report 失败后重跑。
* 回滚流程。

---

# 8. 降级方案

## 8.1 Live Hall 不稳定

处理方式：

* 优先读取最近一次稳定 Projection。
* 若 Projection 不可用，展示静态赛事状态、阶段公告和已公开作品入口。
* 不直接读取原始 CA Session 作为公开展示 fallback。

## 8.2 大屏不稳定

处理方式：

* 切换到最近一次稳定 Projection。
* Projection 不可用时切换静态榜单、公告或作品展示。
* 现场投屏不可用时，使用公开 URL 或备用浏览器窗口展示。

## 8.3 CA 接入失败

处理方式：

* 单个选手 RaceProject 聚合 CA 接入失败时，该 Registration 不自动退赛，应生成接入异常或证据缺口风险提示。
* 单个 CAConnection failed 时，优先检查同一 RaceProject 是否仍有 connected / active 连接；若无可用连接，标记 RaceProject 聚合接入异常。
* 未登记、未握手、归属错误或被禁用的 CAConnection 信号不得作为有效骑行数据。
* 主办方可在内部状态中看到失败原因、证据缺口和评审前风险提示。
* Live Hall 和大屏不应因该选手失败整体不可用。
* MVP 不允许通过事后上传 Session Summary 伪造实时 CA 证据。

## 8.4 Report 生成失败

处理方式：

* 允许手动重跑 Report 生成。
* 允许主办方人工编辑报告后发布。
* 未发布 Report 不进入公开端。

---

# 9. 回滚

发布失败时：

* 优先回滚到上一稳定版本。
* 保留失败版本日志。
* 核对核心事实数据是否被污染。
* 必要时重建 Projection。
* 回滚后执行 P0 smoke test。

P0 smoke test 至少覆盖：

* GitHub 登录。
* Public Site 访问。
* Live Hall 访问。
* Screen Console 展示。
* Race Console 登录后可访问。
* Report / Results 公开页可访问。

---

# 10. 事故记录

赛事当天事故记录至少包含：

* 发生时间。
* 影响范围。
* 影响用户或角色。
* 相关资源。
* 处理动作。
* 是否触发 fallback。
* 是否回滚。
* 后续改进项。

赛后复盘应进入：

* 内部运维复盘。
* 必要时进入 race_report 的运营总结部分。
