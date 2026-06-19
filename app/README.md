# ARY Local MVP App

本文记录`app/`本地MVP应用的运行方式和覆盖范围。该应用用于完成`docs/ary.plan.md`中`DEV-4`到`DEV-7`、`REL-1`和`OPS-1`的可演示闭环。

## 运行方式

直接用浏览器打开：

```text
app/index.html
```

应用不依赖npm包、构建步骤或开发服务器。状态保存在浏览器`localStorage`中，左侧`Reset Seed`可恢复种子数据。

## 本地验证

```bash
node --check app/domain.js
node --check app/app.js
node app/domain.test.js
node app/layout-check.js
```

## 覆盖范围

| 任务 | 应用落点 |
|---|---|
| `DEV-4` | Race发布、报名审核、Registration唯一性、RaceProject幂等生成、Work提交、JudgeAssignment、JudgingRecord。 |
| `DEV-5` | CAConnection登记与握手、合法骑行信号接入、非法信号隔离、接入失败ReviewFlag、Projection生成和失败隔离、Live Hall读取稳定Projection。 |
| `DEV-6` | Screen Console模式切换：live、leaderboard、works、announcement、fallback。 |
| `DEV-7` | Award/Leaderboard发布、race_report、review_summary、rider_report生成、编辑、发布和公开读取边界。 |
| `REL-1` | P0回归按钮、发布检查项、彩排/回滚/发布证据记录。 |
| `OPS-1` | 备份记录、事故记录、fallback记录、赛后归档动作。 |

## 实现边界

该应用是本地可运行MVP，不是生产系统：

* GitHub登录、真实OAuth、服务端鉴权、数据库迁移和部署配置未接入。
* CAConnector为本地模拟信号；契约边界按`docs/ary-ca-integration-spec.md`实现校验和隔离。
* Release/Ops以本地演练、检查项和记录入口验收，不代表已完成真实生产发布。

## 视图状态模式

8 个视图（Overview / Race / CA / Screen / Reports / Public / Ops / Admin）共享同一套空态 / 错误态展示模式，由 `app/app.js` 中的两个 helper 暴露：

* `renderEmpty(label, hint)`：用于列表为空 / 数据缺失分支，渲染图标 + 主标题 + 提示文案。
* `renderError(type, message)`：用于渲染时发现的错误（如 `report.lastError`），渲染红色描边条 + 类型 + 错误消息 + 视觉上的 Retry 按钮（仅样式占位，不绑定真实 handler）。

调用约定：所有视图渲染函数里凡是"`list.length === 0` → 占位字符串"或"`result.ok === false` → 显示给用户"的分支，都改为调用 `renderEmpty` / `renderError`；功能逻辑保持不变，只替换展示方式。原有的 `empty(text)` helper 保留为 `renderEmpty(text, "")` 的薄别名，便于历史调用点逐步迁移。

示例（RenderOps 中的 release checklist 空态）：

```javascript
$("#release-list").innerHTML = state.releaseChecklist.length
  ? state.releaseChecklist.map(renderChecklistItem).join("")
  : renderEmpty("No release checks", "Seed a release checklist before invoking Mark Release Ready");
```

新增 / 复用的 CSS 类名（`app/styles.css`）：

* `.empty-state` / `.empty-state-icon` / `.empty-state-label` / `.empty-state-hint`：垂直居中、padding 32px（≤480px 缩到 24px）、字号不变小。
* `.screen-stage .empty-state`：暗色 stage 内嵌变体，白色边框与文字。
* `.error-state` / `.error-state-icon` / `.error-state-body` / `.error-state-type` / `.error-state-message` / `.error-state-retry`：顶部水平条、红色描边、可关闭（视觉占位）。
* 移动端 ≤480px：`.empty-state { padding: 24px }`；`.error-state` 按钮换行占满。
