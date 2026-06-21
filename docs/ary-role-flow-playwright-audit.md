# ARY Role Flow Playwright Audit

文档类型：QA Audit
日期：2026-06-20
范围：`web/` 角色数据流与操作逻辑
方式：Playwright CLI 手工自动化走查 `http://127.0.0.1:3001`

## 走查路径

1. `/debug-login` 以 Organizer、Judge、Rider 登录。
2. `/console` 查看各角色入口与当前 Race 数据。
3. Judge 打开 `/works/work-localjoy/judge` 并提交评分。
4. Rider 在 Console 提交 Work。
5. Organizer 回到 Console 检查是否能处理 Rider Work。
6. Public 打开 `/races/bay-area-happy-trip/results`、`/works/adaptive-bay-route-agent`、`/works`、`/races/bay-area-happy-trip/review`。
7. Rider 打开 `/screen` 并尝试切换 Screen mode。

## 符合预期的行为

* Judge 对已分配作品可看到 Work、ReviewFlag、公开 Evidence 摘要，并能提交 `JudgingRecord`。
* Judge 提交后，数据库中 `JudgingRecord.status=submitted`，对应 `JudgeAssignment.status=reviewed`。
* Public Results 能读取 published Award 和 published public `race_report`。
* Public Review 能读取 published public `review_summary` 和公开 Evidence 摘要。
* Screen mode 切换动作在后端会拒绝 Rider，触发 `FORBIDDEN`。

## 发现的问题

### P0 - Console 当前 Race 与角色子面板数据不一致

现象：

* Console 顶部显示当前 Race 为“本地演示 Race”，该 Race 没有 registrations / works。
* 同一页 Rider View 显示“湾区开心游”的 Registration、RaceProject 和 Work。
* Judge View 显示跨 Race 的 assignment。
* Rider 在该 Console 提交 Work 后，实际更新的是 `race_bay_2026` 下 `reg_mira` 的 Work，而不是顶部显示的“本地演示 Race”。
* Organizer 回到 Console 后仍看不到这个 Work，因此无法在当前页面完成“Rider 提交 -> Organizer 分配 Judge / 发布 Award”的闭环。

影响：

* 角色流表面可操作，但跨 Race 混流，容易产生错误分配、错误发布和错误验收。

建议：

* Console 必须有明确 Race 选择或路由参数，如 `/console/races/[raceId]`。
* `getConsoleSnapshotForUser()` 应按同一个 Race 返回 organizer/rider/judge/admin 子视图数据。
* Rider View 的 `ownRegistration` 不应取用户第一个报名，而应取当前 Race 下的报名。
* Judge View 应默认过滤当前 Race 的 assignment，或明确显示“全部 assigned works”并标注 Race。

### P0 - Award 数据存在跨 Race 引用

现象：

* 数据库中 `award-genesis-001.raceId = race_genesis_2026`，但其 `registration.raceId = race_bay_2026`。

影响：

* 违反 `Award` 必须授予同一 Race 下 Registration 的领域约束。
* Public Results / Rider Profile 可能展示跨赛事错误结果。

建议：

* `publishAward()` 写入前校验 `registration.raceId === input.raceId`。
* 若传入 `workId`，校验 `work.registrationId === input.registrationId`。
* seed 数据修正跨 Race Award。

### P1 - Public Work Detail 可直接访问非 public Work

现象：

* Public Works 列表不展示非 public Work。
* 但 `/works/adaptive-bay-route-agent` 可直接打开 `visibility=review`、`status=submitted` 的 Work。
* Results 页面还会链接到该 Work。

影响：

* 违反“Public 只读公开且已发布资源”的权限口径。

建议：

* `getWorkDetail()` 或对应页面应拒绝未 `visibility=public && status=published` 的匿名访问。
* Results 页面链接 Work 前也应确认 Work 公开，否则只展示 Award 摘要。

### P1 - Screen Console UI 对 Rider 暴露控制按钮

现象：

* Rider 可以打开 `/screen`，看到完整 Display Mode、fallback、Announcement 控件。
* 点击 mode 后端会抛出 `FORBIDDEN`，并显示 Next.js Runtime Error overlay。

影响：

* 后端权限拒绝有效，但用户体验和权限可见性不符合矩阵。

建议：

* `/screen` 对非 Organizer/Admin 显示只读说明或跳转。
* 操作按钮按 `canManageRace()` 条件隐藏或禁用。
* Server Action 错误应转为受控错误消息，不应暴露 Runtime Error overlay。

### P1 - Judge 提交后无可见反馈

现象：

* Judge 点击“提交评审”后，数据库保存成功，但页面没有成功提示、状态变化或返回入口。

影响：

* Judge 无法判断评审是否完成，容易重复提交或误以为失败。

建议：

* 提交后显示保存成功状态、`assignment.status=reviewed`、最后提交时间。
* 或跳回 Console Judge View 并高亮该 assignment。

### P1 - Organizer debug 用户是全角色用户，难以验证纯 Organizer 视角

现象：

* `user_org_1` 同时拥有 `organizer/admin/judge/rider`。
* Organizer 登录后也显示 Rider、Judge、Admin 面板。

影响：

* 很难用 debug login 验证纯 Organizer 权限边界。

建议：

* 增加纯 Organizer seed 用户，或 debug login 支持以同一 user 临时裁剪角色。

### P2 - Public Review 中 Evidence 摘要与 Work 当前标题可能漂移

现象：

* Rider 更新 Work 标题后，Review 页 Evidence 摘要仍是旧语义，但卡片标题显示新的 Work 标题。

影响：

* 不是权限问题，但复盘语义可能混乱。

建议：

* Evidence 应保留生成时的 Work title 快照，或 Review 页面明确区分 Evidence title 与当前 Work title。

### P2 - 缺少 favicon

现象：

* 浏览器 console 有 `GET /favicon.ico 404`。

影响：

* 不影响业务流，但会污染调试 console。

建议：

* 添加 favicon 或静态路由兜底。

## 本次走查造成的数据变更

* Judge 对 `assign_localjoy_ava` 提交了评审记录，comments 为 `Playwright flow: evidence and review flags are visible.`。
* Rider 将 `work-gba-wander` 更新为 `Playwright Rider Flow Work`，visibility 仍为 `review`。

这些是本地 SQLite 调试数据变更，不应作为业务样例基线提交。
