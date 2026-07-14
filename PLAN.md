# PLAN

本文是 ARY 近期任务窗口，只记录当前阶段、近期主线、后续队列和质量门。长期任务定义见 `docs/ary.plan.md`；当前事实、完成证据和风险见 `STATUS.md`。

## 当前阶段

ARY 已完成 PRD / UX / 领域模型 / 本地 MVP、WEB-1 全角色 E2E / CI，以及 SEC-1 代码级安全基线。Racer 作品提交完整性代码基线已落地不可变版本、UTC 提交窗口、全场冻结、commit SHA / canonical hash、审计事件和评审版本绑定；一次性 PostgreSQL migration deploy 仍待具备数据库环境后验收。

当前从“代码级正式工程化”进入“真实环境验收”。仓库尚未取得生产 TLS、托管 PostgreSQL、真实 OAuth App、正式 CA 凭据、备份恢复、WAF / 限流、监控和 staging 彩排证据，真实赛事继续保持 no-go。

## 当前主线

| 优先级 | 工作项 | 目标 | 完成口径 | 下一入口 |
| --- | --- | --- | --- | --- |
| P0 | Hosted CI 首次验证 | 确认安全与作品提交完整性基线在远端环境可重复执行 | 静态检查、完整领域/契约测试、类型检查、PostgreSQL migration + production build、生产配置预检和 14 个 E2E 均通过 | `.github/workflows/web-ci.yml`、`web/e2e/`、`web/prisma/migrations/` |
| P0 | Staging 基础设施 | 建立托管 PostgreSQL、TLS ingress、secret manager、WAF / 限流、集中日志和监控 | `docs/ary-production-security-baseline.md` 的部署门禁在 staging 有可追溯证据 | `docs/ary-production-security-baseline.md` |
| P0 | 真实 GitHub OAuth 验收 | 使用真实 OAuth App 验证身份与会话闭环 | state、登录、过期、Logout、角色变化和跨会话策略在 staging 通过 | `web/lib/auth.ts`、`web/app/api/auth/`、`docs/ary-permission-matrix.md` |

## 后续队列

| 顺序 | 工作项 | 目标 |
| --- | --- | --- |
| 1 | 真实 CAConnector | 完成凭据交付、轮换 / 吊销、HTTP snapshot fetch，以及篡改、过期和重放演练 |
| 2 | 数据可靠性演练 | 完成 migration、备份恢复、回滚和本地 / E2E / staging 数据隔离验证 |
| 3 | 浏览器与非功能验收 | 在 14 个 E2E 基础上补截图、移动端、弱网、负载和权限负向路径 |
| 4 | Production go/no-go | 完成 P0 回归、发布检查、回滚彩排、监控和事故响应；任一硬门禁缺失则保持 no-go |
| 5 | 仓库与 Demo 内容安全 | 在线证明 commit 属于声明仓库，补不可变归档、secret / 依赖扫描、文件杀毒和 Demo 沙箱；与当前格式校验/冻结基线分开立项 |

## 当前质量门

进入下一项功能开发、合并或发布前，至少确认：

* `npm.cmd run check:static` 通过。
* `npm.cmd test` 领域测试通过。
* `npm.cmd run typecheck` 通过。
* `npm.cmd run build` 通过。
* `npm.cmd run check:production-config` 通过目标环境预检。
* `npm.cmd run test:e2e` 全角色 / Public / Screen / Security 路径通过；若环境缺少浏览器或外部服务，必须明确记录阻塞原因。
* 在一次性 PostgreSQL 上执行 `npm.cmd run prisma:migrate:deploy`，并保留全新库及既有基线库升级证据；无数据库环境时不得把该项标记完成。
* 服务端权限符合 `docs/ary-permission-matrix.md`，Debug Login 和 OAuth fallback 在生产环境不可用。
* `.env`、数据库、Cookie、OAuth Secret、CA 密钥和 connector 凭据不进入 Git。

## 文档入口

* 产品基线：`docs/ary-mvp.prd.md`
* 长期任务定义：`docs/ary.plan.md`
* 当前状态与风险：`STATUS.md`
* 生产安全基线：`docs/ary-production-security-baseline.md`
* 权限基线：`docs/ary-permission-matrix.md`
* CA 契约：`docs/ary-ca-integration-spec.md`
* 工程运行：`web/README.md`
* WEB-1 E2E / CI 总结：`docs/ary-web-e2e-ci-change-summary.md`

## 执行纪律

* 开工前确认目标、产出、验收口径和不做事项。
* 新增正式任务 ID、依赖或长期验收口径时，先更新 `docs/ary.plan.md`，再同步本文和 `STATUS.md`。
* 完成任务、改变近期窗口或改变重要产物后，及时更新本文和 `STATUS.md`。
