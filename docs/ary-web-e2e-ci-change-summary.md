# ARY Web 全角色 E2E 与 CI 修改说明

> 历史阶段说明：本文中的 Admin `User.roles` 表单测试已由 2026-07-15 的 RoleApplication / UserRole 资格管理与会话角色切换 E2E 取代。

文档类型：阶段修改总结  
覆盖时间：2026-07-13  
对应任务：`WEB-1 Judge / Public / Screen E2E`、`WEB-1 Rider / Organizer / Admin E2E + CI`  
当前结论：本地自动化验收完成；GitHub-hosted Runner 首次结果待 Workflow 推送后确认。

---

## 1. 修改背景

ARY 已经从产品文档、高保真原型和本地领域闭环推进到 `web/` 正式集成应用阶段。此前代码已经覆盖 Public Site、四角色 Console、CA、Projection、Screen、Report、Results 和 Ops，但浏览器验证主要依赖人工走查，缺少可重复、可进入 CI 的用户路径证据。

本阶段的目标不是继续扩张产品范围，而是把关键路径从“可以人工演示”提升为“可以自动验证”：

```text
角色登录与隔离
→ 角色领域动作
→ 页面刷新后的数据持久化
→ 公开边界与权限边界
→ 构建和浏览器质量门
```

## 2. 修改范围

### 2.1 Playwright 基础设施

新增：

* `web/playwright.config.ts`
* `web/scripts/e2e-prepare.mjs`
* `web/e2e/*.spec.ts`
* `@playwright/test` 开发依赖及按场景运行脚本

测试固定使用：

* `http://127.0.0.1:3100`
* Chromium Desktop
* 单 Worker 串行执行
* 独立数据库 `prisma/e2e.db`
* 本地专用 Debug Login
* 失败时保留 trace 和截图

`e2e.db` 每次执行前都会重新初始化并 Seed，不读取或重置 `dev.db`，从而避免测试污染开发数据。

### 2.2 Judge E2E

覆盖：

1. 未登录访问 review-only Judge 页面返回 404。
2. Judge 登录后只看到 Judge View。
3. Judge 只能进入分配给自己的作品。
4. 评委可提交结果分、骑行分和评语。
5. 提交后 Assignment 变为 `reviewed`，JudgingRecord 为 `submitted`。
6. 页面刷新后评分和评语仍然存在。

实施过程中发现并修复了真实权限缺口：原 Judge 页面能够读取 review-only Work，但页面入口本身未校验当前用户是否是被分配的 Judge。现在页面同时检查 `judge` role、`assignedWorkIds` 和当前用户对应的具体 Assignment。

### 2.3 Public E2E

覆盖：

1. Race Gallery 展示当前赛事和公开作品。
2. Live Hall 展示稳定 Projection、过程榜和骑行事件。
3. Works 只展示已发布公开作品。
4. Results 展示 Award 和公开 race report。
5. Review 展示公开 review summary。
6. review-only Work 的页面和公共 API 均返回不可见结果。

这组测试把“页面看不到”与“API 也不能读取”同时纳入验收，避免只靠前端隐藏造成数据泄露。

### 2.4 Screen E2E

覆盖：

1. 未登录用户只能查看大屏状态，不能看到模式和 fallback 控件。
2. Organizer 可以在 `live`、`leaderboard` 等模式之间切换。
3. Screen Display 与 Console 状态同步。
4. fallback 开启后，Display 使用稳定 Projection / 公共作品 / 公告兜底。

### 2.5 Rider E2E

为避免污染普通演示 Seed，新增仅在 `DATABASE_URL` 指向 `e2e.db` 时创建的测试骑手 Fixture。

覆盖：

1. Rider 登录后只看到 Rider View。
2. Registration 为 `approved`，RaceProject 已生成。
3. 带 connector attestation 的合法 CA Signal 可以接入。
4. RaceProject 从 `connected` 更新为 `active`。
5. Rider 可以提交 Work。
6. 页面刷新后 Work 标题与状态仍然存在。

### 2.6 Organizer E2E

覆盖：

1. Organizer 登录后只看到 Organizer 管理入口。
2. 创建新的私有 draft Race。
3. 通过 Race switch 进入新 Race，验证 Console 为 Race-scoped。
4. 发布当前 Race，使其进入 `running/public`。
5. 公共 Races API 能读取已发布 Race。

### 2.7 Admin E2E

覆盖：

1. Admin 登录后只看到 Admin Console。
2. 定位指定用户的 `User.roles` 表单。
3. 增加 Rider role 并验证刷新后持久化。
4. 测试结束前恢复原 Seed role，避免影响 Judge 场景。

### 2.8 SQLite 初始化修正

原 `scripts/init-sqlite.py` 与 Prisma schema 发生漂移，缺少 `ScreenState` 表，导致 Seed 失败。本阶段完成：

* 补齐 `ScreenState` 建表和清理逻辑。
* 支持从 `DATABASE_URL=file:...` 选择目标 SQLite 文件。
* E2E 初始化器显式指定 `e2e.db`。
* 使用 Node 原生 `--import tsx` 执行 TypeScript，避免部分受限环境下 `tsx` CLI 的 IPC 问题。

## 3. CI 集成

新增 `.github/workflows/web-ci.yml`，在 `web/**` 或 Workflow 变化时触发，并支持手动执行。

CI 分为两个并行 Job：

| Job | 验证内容 |
| --- | --- |
| `Static, domain and build` | `npm ci`、测试库初始化、静态烟测、TypeScript、20 个领域测试、Next production build |
| `Playwright browser E2E` | 安装 Chromium、运行全部 9 个 E2E；失败时上传 trace、截图和 HTML report |

Workflow 使用只读 `contents` 权限、Node.js 22、Python 3.13 和 npm lockfile cache。失败诊断产物保留 7 天。

## 4. 验证结果

| 验证项 | 结果 |
| --- | --- |
| Playwright E2E | `9/9` 通过 |
| 领域测试 | `20/20` 通过 |
| 静态烟测 | 17 个页面路由、14 个 API 路由通过 |
| TypeScript | `tsc --noEmit` 通过 |
| Next.js build | production build 通过 |
| Workflow YAML | 本地解析通过 |
| 实际浏览器抽查 | Rider / Organizer / Admin 角色隔离和关键状态通过 |

## 5. 修改意义

### 5.1 从功能存在转向行为可证明

过去的证据主要说明代码和页面存在；现在可以证明真实用户路径在浏览器中能够走通，并且刷新后数据仍然正确。

### 5.2 权限边界进入回归体系

Judge assignment、review-only Work、Screen 控制权和角色隔离不再只依赖文档约定，而成为自动化测试中的强制断言。

### 5.3 为持续开发建立安全网

后续 OAuth、真实 CAConnector、数据库迁移或页面重构可以复用现有 E2E，快速发现跨 Race 串流、角色串扰、数据泄露和状态未持久化问题。

### 5.4 为团队协作提供统一验收语言

开发者不再需要用“我本地看起来可以”描述完成度，而可以使用同一套命令和 CI 结果进行交接、评审和发布判断。

## 6. 明确边界

本阶段没有完成：

* GitHub-hosted Runner 的首次远程执行；需要 Workflow 推送后确认。
* 真实 GitHub OAuth 跨会话生产验证。
* 真实 CAConnector HTTP push / fetch。
* PostgreSQL 和正式 migration 流程。
* 移动端关键路径 E2E 与视觉截图基线。
* staging / production 部署、监控和回滚流水线。

## 7. 后续建议

1. 推送当前 Workflow，确认两个 Job 在 GitHub-hosted Runner 上通过，并设为分支保护必需检查。
2. 增加移动端 Rider、Judge、Screen 关键路径和稳定截图基线。
3. 将真实 OAuth 和 CAConnector 接入同一套 E2E Fixture / mock server。
4. 将 SQLite 测试库与生产 PostgreSQL migration 验证分层。
5. 在 staging 完成一次完整模拟赛事和彩排回滚。

