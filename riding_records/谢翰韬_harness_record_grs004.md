# ARY GRS004 工程化与安全基线 Riding Record

文档类型：Riding / Harness Orchestration Record  
记录时间：2026-07-13 至 2026-07-18
记录角色：项目推进与 Agent 指挥方（第一人称）  
覆盖范围：项目理解、全角色 E2E、CI、SEC-1 生产安全基线与数据安全审计
关联任务：`WEB-1`、`SEC-1`

---

## 0. 一句话总结

我没有在 ARY 已具备本地 MVP 闭环后继续横向堆功能，而是将工作收紧为两件高杠杆事项：先用全角色 E2E 与 CI 证明已有流程可重复，再以 SEC-1 审计认证、授权、公开数据和 CA 证据链。最终项目从“能演示”推进到“关键行为有自动化证据、代码级安全边界已收口，但生产环境仍明确 no-go”。

## 1. 我如何理解项目阶段并决定方向

我先要求 Agent 阅读 `PLAN.md`、`STATUS.md`、PRD、权限矩阵、CA 契约、发布运维计划和 `web/` 工程，而不是直接修改代码。确认结果是：`web/` 已承接 Public、Race Console、CA、Projection、Screen、Report、Results 和 Ops 的本地闭环；项目最缺的不是页面，而是可重复的角色行为证明，以及真实赛事所需的身份、数据和上线安全边界。

因此我采用以下顺序：

```text
理解权威文档与现状
→ 用 E2E 验证已有角色闭环
→ 将验证纳入 CI
→ 审计认证、授权、公开数据与 CA 证据
→ 区分代码级通过与生产 no-go
```

## 2. 我如何指挥 E2E 与 CI 收口

### 2.1 从 Judge、Public、Screen 进入

我首先要求补齐 Judge、Public、Screen E2E，因为三者分别代表敏感评审数据、公开数据边界和现场展示控制权。我要求验证的不是页面能打开，而是：

* 未登录或未分配 Judge 不能访问 review-only Work；
* Judge 提交后数据刷新仍然持久化；
* review-only Work 不会从页面或 API 泄露到公开端；
* Screen 对非管理者只读，Organizer 才能控制模式与 fallback；
* Projection 异常时仍保留稳定展示。

Agent 因此发现 Judge 页面缺少 assignment 级入口校验。我要求修复角色、已分配 Work 与具体 Assignment 三层边界，而不是为测试写特例。这说明 E2E 的作用是暴露真实权限缺口，而不是为已有实现补绿灯。

### 2.2 测试环境的边界决策

当执行遇到 `tsx` IPC 受限、Prisma reset 保护、SQLite 初始化 schema 漂移和开发库污染风险时，我没有允许绕过保护或重置开发数据，而是要求使用独立 `e2e.db`、Node 原生 `--import tsx`、修正初始化器并让 Fixture 只在测试数据库创建。测试必须可重复，但不能以破坏开发数据为代价。

### 2.3 补齐 Rider、Organizer、Admin 与 CI

第一轮完成后，我继续要求补齐 Rider、Organizer、Admin，并把本地验证纳入 CI：

| 范围 | 我要求证明的行为 |
| --- | --- |
| Rider | approved Registration → RaceProject → 合法 CA Signal → Work 提交与持久化 |
| Organizer | 创建 Race、切换当前 Race、发布后 Public API 可见 |
| Admin | `User.roles` 的真实更新及测试后的 seed 恢复 |
| 静态 / 领域 / 构建 | 路由、类型、领域不变量与 production build 不回归 |
| 浏览器 E2E | 真实用户路径、权限与持久化可重复证明 |

我坚持区分本地与远程证据：Workflow、命令和本地浏览器回归可以证明；GitHub-hosted Runner 的首次结果必须推送后确认，不能提前宣称远程 CI 成功。

## 3. 我如何拆解 SEC-1

我将 SEC-1 理解为从“本地可演示 MVP”走向“可以讨论真实赛事承载条件”的工程化推进，而不是补几个安全名词。ARY 必须回答身份从哪里来、谁能访问哪一场 Race、公开接口会否泄露、CA 证据能否伪造、异常能否追溯和上线依据是否充分。

我要求 Agent 将问题分为五层：

1. OAuth 与会话可信性；
2. 角色与资源范围授权；
3. Public API 最小披露；
4. CA 签名、防篡改和防重放；
5. PostgreSQL、配置门禁和生产基础设施证据。

我先要求区分“设计承诺”和“实际实现”，逐项回到代码检查 HTTPS、Cookie、OAuth callback、Public API、CA `dev-signature` 和 SQLite 的真实边界，不把规划文档写成已上线保护。

## 4. 我的关键安全决策

| 决策 | 我的判断 | 落地结果 |
| --- | --- | --- |
| 随机服务端会话替代裸 `userId` Cookie | 身份不能由客户端自我声明，且需要撤销能力 | `AuthSession` 保存 token hash、归属和过期；Logout 同时清理会话与 Cookie |
| OAuth 使用一次性 state | 阻断 callback 绕过与登录 CSRF | 缺少或不匹配 state 返回 400；生产不继承 seed 登录名 |
| Public API 使用白名单 DTO | 页面不渲染不等于接口没有泄露 | 原始 Session、内部 ID、评审、运维和 `sourceRef` 不进入公开响应 |
| HMAC 与防重放取代 dev-signature | CA 过程证据必须可验证 | key 绑定、constant-time 比较、时间窗、唯一 Receipt 与事务写入 |
| PostgreSQL 用于 production | SQLite 只适合本地/E2E | baseline migration 与生产配置门禁 |
| 代码级通过不等于上线 | TLS、备份、密钥和监控不能靠仓库自证 | 建立 go/no-go 硬门禁 |

我坚持“连接失败不取消资格、伪造信号不能污染事实”的产品与安全口径：合法信号可进入 Evidence 与 Projection；伪造、篡改、过期或重放的消息必须拒绝或隔离。

## 5. 我如何继续审计并关闭旁路

安全基线完成后，我继续检查敏感页面和真实查询路径，提出：未登录者能否直接读取 Ops 数据？Organizer 是否按精确 ID 判断？无范围用户是否能通过 URL 得到敏感信息？

| 问题 | 判断 | 我的范围决策 |
| --- | --- | --- |
| `/ops` 读取完整运维快照后直接渲染 | P0：发布、备份和事故信息可能被匿名读取 | 本轮修复 |
| `organizerJson contains user.id` | P1：`user_12` 与 `user_123` 可能产生子串越权 | 本轮修复 |
| Console 跨赛事读取范围 | 需要独立审计和产品决策 | 用户要求暂时忽略，明确保留为后续项 |

收到“忽略 Console、修复另外两个”的明确决定后，我没有无限扩大改动范围，只实施获授权修复：

* Ops 先取得 `AuthContext`，按当前 `raceId` 读取范围，仅 `admin` 或精确管理该 Race 的 Organizer 可读取；匿名、无关角色和未知赛事统一 404。
* Organizer 判断改为解析 JSON 数组后严格比较用户 ID；后续若 Race 数量增长，应转为关系表或 PostgreSQL `jsonb` 精确查询。
* Console 的 Ops 入口只对当前赛事管理者显示，但 Console 跨赛事读取问题本身保留为后续项。

## 6. 我如何使用和指挥 Agent

我把 Agent 用作调查、实现与复验的加速器，而不是把判断外包：

* 要求它先按文档入口定位权威约束，再检查认证、查询、页面、API、E2E 与 schema；
* 要求它提供代码与测试证据，区分已证实漏洞、代码级能力和未取得生产证据的风险；
* 用角色、资源范围和拒绝路径定义验收，不接受只验证“200 / 页面存在”；
* 遇到 `DATABASE_URL` 缺失或本地端口受限时，先判断环境原因，再使用隔离数据库或获批测试服务器重跑；
* 每次重要结论后同步计划、状态与安全基线，防止实现与项目叙述漂移。

我的职责始终是控制目标、范围、优先级、验收口径和 no-go 边界；Agent 负责把这些判断转化为可审查的代码与证据。

## 7. 验证与证据

验证分为领域测试、Security E2E、静态烟测/TypeScript，以及 production build/preflight 四层。本次安全审计后已执行并通过：

```text
npm run typecheck
npm run test:e2e:prepare
DATABASE_URL=file:./e2e.db npm test
npm run check:static
npm run test:e2e:security
```

结果：TypeScript 通过；领域测试 23/23 通过；静态检查通过；Security Playwright E2E 5/5 通过。Ops 隔离覆盖匿名、Rider 和 Organizer 三条路径；Organizer 授权覆盖 `user_123`、`user_12` 与 `user_1234`，证明不再依赖子串命中。

关键证据入口：

* `web/e2e/`、`.github/workflows/web-ci.yml`
* `web/tests/domain.test.ts`、`web/e2e/security.spec.ts`
* `web/lib/auth.ts`、`web/lib/ca-attestation.ts`
* `web/app/ops/page.tsx`、`web/app/api/ca/v1/signals/route.ts`
* `web/prisma/migrations/20260713_security_production_baseline/migration.sql`
* `docs/ary-web-e2e-ci-change-summary.md`、`docs/ary-production-security-baseline.md`

## 8. 最终结论与下一步

```text
全角色关键路径：具备 E2E 与 CI 证据。
代码级安全基线：通过。
真实赛事生产上线：当前 no-go。
```

解除 no-go 的前提仍包括公网 TLS、托管 PostgreSQL 加密与 PITR、secret manager、CA 凭证轮换/吊销、WAF / 分布式限流、集中不可变日志、加密备份恢复、监控告警、压测和 staging 全流程彩排。

下一阶段我会优先推动真实 GitHub OAuth App、托管 PostgreSQL、connector 凭证和 snapshot fetch、部署流水线与 staging 演练，而不是继续增加与上线门禁无关的展示功能；Console 跨赛事读取范围仍是下一轮资源级读取审计项。
