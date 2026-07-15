# ARY 风险评审中心

版本：v0.1
文档类型：功能专题说明
对应任务：`DEV-8`
上游入口：`ary-mvp.prd.md`、`ary-permission-matrix.md`、`ary.plan.md`
当前实现参考：`../web/app/console/risk-center/page.tsx`、`../web/lib/domain.ts`、`../web/lib/queries.ts`

---

## 1. 文档目的

本文用于定义 ARY 风险评审中心的正式口径，便于后续代码合并、功能审查、权限回归和继续扩展。

本文聚焦以下问题：

* 风险评审中心要解决什么问题。
* 当前交付范围、边界和不做事项是什么。
* `ReviewFlag` 的状态、字段、角色可见性和动作规则是什么。
* 页面与服务端实现当前采用什么结构。
* 后续合并或继续迭代时要重点关注哪些兼容点。

本文不替代 PRD、权限矩阵和长期任务定义；如发生冲突，以对应权威文档为准。

---

## 2. 功能目标

风险评审中心用于把评审前风险从“可见提示”推进为“可处理对象”。

核心目标：

* 让 Organizer 看到当前 Race 的全部风险，并执行筛选、处置、复核。
* 让 Rider 只看到与自己相关且可整改的风险，并获得明确下一步动作。
* 让 Judge 在评审上下文中看到未解决风险和处置记录，但不直接改写风险状态。
* 让风险状态变化保留最小审计记录，避免风险在处理后从评审链路中消失。

---

## 3. 当前交付范围

### 3.1 页面范围

当前已交付的主页面入口：

* `/console/risk-center`

当前已接入的关联入口：

* `/console`
* `/works/[slug]/judge`

### 3.2 角色范围

* Organizer / Admin：查看当前 Race 全量风险，执行状态变更和处置说明记录。
* Rider：只查看自己的风险和整改建议；可重新打开与自己相关的风险。
* Judge：只查看已分配作品相关的风险和处置摘要；不修改风险状态。

### 3.3 数据范围

当前以 `ReviewFlag` 为中心对象，结合以下上下文展示：

* `Registration`
* `RaceProject`
* `CAConnection`
* `Work`
* `JudgeAssignment`

---

## 4. 不做事项

当前版本明确不包含：

* 负责人分配、SLA、升级路径和审批流。
* 站内通知、邮件、消息推送。
* 自动处罚、自动退赛或自动阻断评审。
* 原始 CA Session 公开读取。
* Judge 直接关闭风险。

---

## 5. 领域对象口径

### 5.1 ReviewFlag 角色

`ReviewFlag` 用于表达评审前风险或材料缺口，不自动替代人工评审。

当前覆盖的典型风险类型包括：

* `no_ca_data`
* `empty_riding`
* `missing_required_material`
* `ingestion_exception`
* `cost_watch`

### 5.2 当前核心字段

当前实现中风险中心依赖以下字段：

* `type`
* `severity`
* `status`
* `judgeVisibleSummary`
* `sourceRefJson`
* `resolutionNote`
* `resolvedByUserId`
* `createdAt`
* `resolvedAt`
* `updatedAt`

### 5.3 状态定义

当前状态机采用三态：

* `open`
* `in_review`
* `resolved`

状态语义：

* `open`：风险存在，仍需处理或仍会影响评审上下文。
* `in_review`：Organizer / Admin 已接手，正在确认材料、证据或说明。
* `resolved`：当前口径下已完成处置，但记录继续保留在审计和 Judge 上下文中。

---

## 6. 权限与动作规则

### 6.1 Organizer / Admin

可执行：

* 查看当前 Race 全部风险。
* 按 `status`、`severity`、`type`、`rider` 筛选。
* 写入 `resolutionNote`。
* 将风险标记为 `open`、`in_review`、`resolved`。

不可执行：

* 通过风险状态直接更改参赛资格。

### 6.2 Rider

可执行：

* 查看自己的风险。
* 查看整改建议和关联作品入口。
* 对与自己相关的风险执行 `reopen`，即重新标记为 `open`。

不可执行：

* 查看 Organizer 内部判断。
* 将风险标记为 `in_review` 或 `resolved`。

### 6.3 Judge

可执行：

* 查看已分配作品相关的风险摘要。
* 查看 Organizer 已记录的处置说明。
* 从风险上下文进入 Judge View。

不可执行：

* 改写 `ReviewFlag` 状态。

---

## 7. 页面结构口径

### 7.1 顶部概览区

当前概览区提供：

* 当前 Race
* 未解决风险数量
* 已解决风险数量
* Race 切换入口

### 7.2 优先级摘要区

当前优先级摘要提供：

* 高优先级风险数
* 缺材料风险数
* 接入异常风险数
* 当前焦点风险

### 7.3 筛选区

当前筛选支持：

* `status`
* `severity`
* `type`
* `rider`

并提供若干快速筛选入口：

* `open`
* `in_review`
* `high`
* `missing_required_material`
* 清空筛选

### 7.4 Organizer 处置席

每条风险当前显示：

* 风险类型、严重度、状态
* Judge 可见摘要
* Rider、Work、CA 聚合状态、连接数
* 来源标签
* 创建时间、更新时间、处理人、处理时间
* Work 入口
* 处理状态选择和处置说明表单

### 7.5 Rider 整改席

每条风险当前显示：

* 风险类型、严重度、状态
* 可整改摘要
* 下一步建议动作
* 关联 Work 入口
* 更新时间
* 重新打开动作

### 7.6 Judge 评审上下文

每条风险当前显示：

* 风险类型、严重度、状态
* Judge 可见摘要
* Rider、Work、Assignment 状态
* 更新时间
* Organizer 处置说明
* Judge View 入口

---

## 8. 服务端实现口径

### 8.1 读取

当前风险中心读取入口：

* `getRiskCenterSnapshotForUser()`

该查询负责：

* 基于当前 Race 聚合风险。
* 按角色生成 `allFlags`、`ownFlags`、`judgeFlags` 三类读取结果。
* 将 `resolvedByUserId` 映射为页面可展示的人名。

### 8.2 写入

当前风险状态写入口：

* `updateReviewFlagStatus()`
* `updateReviewFlagStatusAction()`

当前规则：

* Organizer / Admin 可写 `open`、`in_review`、`resolved`。
* Rider 仅可将与自己相关的风险重新打开为 `open`。
* Judge 不可更新风险状态。

### 8.3 自动状态联动

当前已实现的自动联动包括：

* Registration 审核通过后，若尚无 CA 数据，会生成 `no_ca_data`。
* CAConnection 登记后，会自动解决对应 `no_ca_data`。
* 合法 CA Signal 接入后，会自动解决 `no_ca_data` / `empty_riding`。
* 提交 Work 且缺少材料时，会生成 `missing_required_material`。
* Rider 补齐必要作品材料后，会自动解决对应缺材料风险。
* CA 信号校验失败或连接全部不可用时，会生成 `ingestion_exception`。

---

## 9. 验收口径

当前功能验收至少应满足：

* Organizer 可以查看当前 Race 风险并执行状态流转。
* Rider 只能查看自己的风险并执行重新打开。
* Judge 只能查看分配作品相关的风险摘要。
* 风险在 `resolved` 后仍保留处理记录。
* 风险处理结果会继续进入 Judge 上下文。
* 风险中心相关权限拒绝具备服务端回归测试覆盖。

---

## 10. 已知边界

当前仍未覆盖的正式能力包括：

* 风险负责人和责任分配机制。
* 违规作品专项处理流。
* CAConnection 新增截止窗口。
* 风险通知、提醒和升级。
* 风险与 Report 自动引用链联动。

---

## 11. 后续合并关注点

后续如需合并到其他分支或继续演进，建议重点检查：

* `ReviewFlag` 字段是否与 Prisma schema、seed、SQLite 初始化脚本保持一致。
* `getRiskCenterSnapshotForUser()` 的角色读取结果是否与权限矩阵一致。
* `updateReviewFlagStatus()` 是否仍保持 Judge 只读边界。
* Console、Judge 页面和风险中心之间的入口是否完整。
* 若扩展新的风险类型，是否同步补充：
  * 推荐动作文案
  * 筛选项
  * 测试用例
  * 权限矩阵

---

## 12. 关联文档

* `ary-mvp.prd.md`
* `ary-mvp.ia.md`
* `ary-permission-matrix.md`
* `ary.plan.md`
* `ary-ca-integration-spec.md`
* `ary-dev-1-dev-3-delivery.md`
* `ary-dev-4-to-ops-delivery.md`
