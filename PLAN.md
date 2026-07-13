# PLAN

本文是 ARY 近期任务窗口，只记录当前阶段、近期主线、后续队列和质量门。长期任务定义见 `docs/ary.plan.md`；当前事实、完成证据和风险见 `STATUS.md`。

## 当前阶段

ARY 已完成 PRD / UX / 领域模型 / 本地 MVP 闭环，并建立 `web/` Next.js + Prisma 正式工程入口。DEV-1 到 OPS-1 的本地交付、WEB-1 角色数据流修正以及全角色 Playwright E2E / CI 基线已经形成。

当前从“本地 MVP 交付”切换到“正式工程化”，不再继续扩写旧阶段完成明细。

## 当前主线

| 优先级 | 工作项 | 目标 | 完成口径 | 下一入口 |
| --- | --- | --- | --- | --- |
| P0 | 正式工程化任务立项 | 将下一阶段的范围、依赖、验收和非目标写入长期计划 | `docs/ary.plan.md` 中形成可执行任务定义，并同步 `STATUS.md` | `docs/ary.plan.md`、`STATUS.md` |
| P0 | 真实 GitHub OAuth 与生产会话闭环 | 用真实身份体系替代本地 fallback / debug login 作为正式业务入口 | OAuth 回调、用户绑定、服务端会话、安全 Cookie、跨会话登录和角色权限验证通过 | `web/lib/auth.ts`、`web/app/api/auth/`、`docs/ary-permission-matrix.md` |
| P0 | Hosted CI 首次验证 | 确认已落盘的 GitHub Actions 在远端环境可重复执行 | 静态检查、领域测试、类型检查、构建和 Playwright E2E 均在 Hosted Runner 通过 | `.github/workflows/web-ci.yml`、`web/e2e/` |

## 后续队列

| 顺序 | 工作项 | 目标 |
| --- | --- | --- |
| 1 | 真实 CAConnector | 补齐 connector 凭证、登记握手、HTTP snapshot fetch、服务端幂等、防伪校验和审计日志 |
| 2 | 生产数据库与迁移 | 将本地 SQLite 基线推进为可部署数据库，建立迁移、回滚、备份和测试数据隔离机制 |
| 3 | 浏览器验收深化 | 在现有全角色 E2E 基础上补截图基线、移动端关键路径和权限负向用例 |
| 4 | Staging / Production 流水线 | 建立部署、监控、发布检查、回滚演练和生产事故记录闭环 |

## 当前质量门

进入下一项功能开发及合并前，至少确认：

* `npm.cmd run check:static` 通过。
* `npm.cmd test` 领域测试通过。
* `npm.cmd run typecheck` 通过。
* `npm.cmd run build` 通过。
* `npm.cmd run test:e2e` 全角色路径通过；若环境缺少浏览器或外部服务，必须明确记录阻塞原因。
* 服务端权限符合 `docs/ary-permission-matrix.md`，Debug Login 在生产环境不可用。
* `.env`、数据库、Cookie、OAuth Secret 和 connector 凭据不进入 Git。

## 文档入口

* 产品基线：`docs/ary-mvp.prd.md`
* 长期任务定义：`docs/ary.plan.md`
* 当前状态与风险：`STATUS.md`
* 权限基线：`docs/ary-permission-matrix.md`
* CA 契约：`docs/ary-ca-integration-spec.md`
* 工程运行：`web/README.md`
* WEB-1 E2E / CI 总结：`docs/ary-web-e2e-ci-change-summary.md`

## 执行纪律

* 开工前确认目标、产出、验收口径和不做事项。
* 新增正式任务 ID、依赖或长期验收口径时，先更新 `docs/ary.plan.md`，再同步本文和 `STATUS.md`。
* 完成任务、改变近期窗口或改变重要产物后，及时更新本文和 `STATUS.md`。
