# ARY 真实赛事安全与生产就绪基线

版本：v0.1  
文档类型：Security & Production Readiness  
状态：代码级安全基线已实现；真实赛事上线仍以本文第 8 节外部基础设施证据为硬门禁  
关联入口：`../PLAN.md`、`../STATUS.md`、`ary-permission-matrix.md`、`ary-ca-integration-spec.md`、`ary-release-ops-plan.md`

---

# 1. 文档目的

本文承接 ARY 从本地 MVP 到真实赛事的安全整改，记录数据传输、身份认证、公开数据边界、CA 接入、防重放、数据库和部署门禁。本文只声明可由仓库代码、自动化测试或明确的生产证据证明的能力。

真实赛事标准包含两层：

* 代码级安全基线：仓库内可以实现、测试和审查的控制。
* 生产环境硬门禁：TLS 入口、托管数据库、密钥托管、备份恢复、WAF / 限流、监控和值守等必须由实际部署环境提供证据的控制。

在第 8 节全部通过前，不得将本项目标记为“真实赛事可上线”。

---

# 2. 生产数据流

```text
Browser
  -> TLS ingress / WAF
  -> Next.js page、Server Action 或 Route Handler
  -> OAuth session / role / resource scope 校验
  -> domain action
  -> Prisma
  -> managed PostgreSQL

GitHub OAuth
  -> 一次性 state
  -> GitHub HTTPS token exchange
  -> providerAccountId 绑定
  -> 服务端生成随机 session token
  -> 数据库仅保存 token SHA-256 hash

CA Connector
  -> POST /api/ca/v1/signals
  -> 严格 schema 与 64 KiB 上限
  -> CAConnection 登记、握手、归属和禁用状态校验
  -> 完整载荷 HMAC-SHA256 + signingKeyId + 时间窗校验
  -> CAIngestionReceipt 唯一约束防重放
  -> Session / Evidence / RaceProject 原子写入
  -> Projection / Live Hall / Screen 读取
```

Live Hall、Works 和 Screen Display 已强制动态读取，不能把构建时数据当作赛事期间实时数据。

---

# 3. 已实现的代码级安全控制

## 3.1 登录与会话

* GitHub OAuth callback 必须同时具备授权 `code`、请求 Cookie 中的一次性 `state` 和回调 `state`；任一缺失或不匹配均返回 400。
* 未配置 GitHub OAuth 时返回 503，不再自动登录演示账号。
* production 不按 GitHub login 名称继承 seed 用户，避免账号名复用导致高权限账号接管；正式预绑定必须使用 provider account ID。
* Debug Login 同时受 `ENABLE_DEBUG_LOGIN=true` 和 `NODE_ENV !== production` 限制。
* `ary_session` 是 256-bit 随机不透明 token；数据库只保存 SHA-256 hash、用户归属和过期时间。
* Cookie 使用 `HttpOnly`、`SameSite=Lax`、12 小时有效期；production 自动增加 `Secure`。
* Logout 删除数据库会话并清理 Cookie，使当前会话可撤销。

## 3.2 权限与请求来源

* 后台动作继续使用 `AuthContext`、role、managed race、own registration 和 assigned work 做服务端授权。
* `/api/console/action` 在 production 校验 `Origin` 必须等于 `NEXT_PUBLIC_APP_URL`。
* Next.js Server Action 用于页面表单动作；生产反向代理不得改写 Host / Origin 到不可信值。

## 3.3 Public API 最小披露

公开 Race、Work、Rider、Live、Results、Review 和 Screen API 改为显式白名单 DTO。公开响应不再序列化以下内部对象：

* CAConnection、原始 Session 和内部 RaceProject；
* ReviewFlag、JudgeAssignment 和 JudgingRecord；
* 未发布 Report / Award / Work；
* ReleaseChecklistItem、Backup 和 Incident；
* `rolesJson`、内部用户 ID、Registration 内部归属字段和 Evidence `sourceRefJson`。

新增浏览器回归直接检查上述字段不出现在公开 JSON 中。

## 3.4 CA 信号认证与防重放

CA 接入端点为 `POST /api/ca/v1/signals`。消息必须包含：

* `messageId`、`idempotencyKey`、`timestamp`；
* Race / Registration / RaceProject / CAConnection / CA Session 标识；
* 进度和 token 等允许的摘要指标；
* `source`、`signingKeyId`、`signedAt` 和 HMAC signature。

签名内容是递归按 key 排序后的：

```json
{
  "payload": "完整 RidingSignalPayload",
  "attestation": {
    "source": "registered_ca_connector",
    "signingKeyId": "已登记 key ID",
    "signedAt": "ISO-8601 timestamp"
  }
}
```

connector 使用共享密钥计算 HMAC-SHA256，并以 base64url 编码。服务端使用 constant-time comparison 验签，要求：

* key ID 与 CAConnection 登记值完全一致；
* `signedAt` 距服务端时间不超过 5 分钟；
* payload `timestamp` 与 `signedAt` 相差不超过 1 分钟；
* `messageId` 和 `idempotencyKey` 在同一 CAConnection 下唯一；
* 回执、Session、Evidence 和聚合状态在一个数据库事务中写入。

重复消息返回幂等成功，不生成重复 Evidence；篡改载荷、过期签名、错误归属和禁用连接均被拒绝或隔离。

## 3.5 传输、安全头与生产配置

* production 的 `NEXT_PUBLIC_APP_URL` 必须是非 loopback HTTPS URL。
* 全站增加 HSTS、frame deny、MIME sniffing 禁止、Referrer Policy、Permissions Policy 和基础 CSP。
* `npm start` 前自动执行 `check:production-config`；SQLite、HTTP、Debug Login、缺失 OAuth 或缺失 CA key 时拒绝启动。
* CA connector key 通过服务端 `CA_CONNECTOR_KEYS` 注入，不进入 Public API、页面 props 或数据库明文字段。

## 3.6 数据库

* production Prisma datasource 已切换为 PostgreSQL。
* 已提供 `prisma/migrations/20260713_security_production_baseline/migration.sql` 和 `prisma migrate deploy` 入口。
* SQLite 只通过临时生成的测试 schema 服务于本地开发和 E2E，不是 production datasource。
* AuthSession 和 CAIngestionReceipt 均有数据库唯一索引；核心领域关系继续由 PostgreSQL foreign key 约束。

---

# 4. 生产环境变量

| 变量 | 生产要求 |
|---|---|
| `DATABASE_URL` | 托管 PostgreSQL TLS 连接；禁止 `file:` |
| `NEXT_PUBLIC_APP_URL` | 实际 HTTPS origin，与 GitHub callback 和代理 Origin 一致 |
| `GITHUB_CLIENT_ID` | 真实 GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | 从 secret manager 注入，不进入镜像或日志 |
| `ENABLE_DEBUG_LOGIN` | 必须为 `false` 或不设置 |
| `DEFAULT_CA_CONNECTOR_ID` | 默认登记 connector，必须存在于 key map |
| `CA_CONNECTOR_KEYS` | JSON key map；每个 secret 至少 32 个高熵字符 |

示例仅表达结构，不得把示例值用于正式赛事：

```text
CA_CONNECTOR_KEYS={"connector-prod":{"keyId":"key-2026-01","secret":"<secret-manager-value>"}}
DEFAULT_CA_CONNECTOR_ID=connector-prod
```

---

# 5. 部署顺序

```text
创建托管 PostgreSQL
-> 注入 secret manager 配置
-> npm ci
-> npm run prisma:generate
-> npm run check:production-config
-> npm run prisma:migrate:deploy
-> npm run build
-> 部署不可变制品
-> TLS / WAF / 限流 / 日志检查
-> staging 全流程彩排
-> 备份恢复演练
-> go/no-go
```

禁止在 production 使用 `db push`、`init-sqlite.py`、seed 数据或 Debug Login。

---

# 6. 自动化验收

当前新增或扩展的验证包括：

* OAuth callback 缺少一次性 state 时拒绝；
* Session Cookie 不包含用户 ID且为 HttpOnly / SameSite；
* Public API 不返回内部资源；
* CA API 拒绝未签名或 schema 不完整消息；
* 完整 HMAC 信号成功入库；
* 修改签名后的 payload 被拒绝；
* 重复消息只产生一个 receipt 和一份 Evidence；
* TypeScript、静态烟测、领域测试、Next production build 和全角色 Playwright 回归。

推荐验证命令：

```bash
cd web
npm run test:e2e:prepare
DATABASE_URL=file:./e2e.db npm test
npm run typecheck
npm run check:static
npm run test:e2e
npm run prisma:generate
DATABASE_URL=postgresql://... npm run build
```

---

# 7. 仓库不能单独完成的控制

以下项目必须由部署平台或赛事运维提供，不能仅凭当前代码判定完成：

* 公网 TLS 证书、TLS 版本和 cipher 验证；
* WAF、DDoS 防护以及按 IP / connector / route 的分布式限流；
* PostgreSQL 存储加密、TLS 连接、multi-AZ、PITR 和只读副本；
* KMS / secret manager、CA key 轮换和紧急吊销；
* 加密备份、跨区域副本和实际恢复演练；
* 集中日志、不可变审计存储、指标、告警和赛事值守通知；
* SAST、依赖漏洞扫描、镜像扫描和 SBOM；
* 200 并发、Live Hall 3 秒刷新和大屏弱网性能实测。

当前数据库中的 Backup 仍是业务“备份记录”，不等同于物理备份。

---

# 8. 真实赛事 go-live 硬门禁

以下证据必须全部存在：

| 门禁 | 通过证据 |
|---|---|
| TLS | 公网 HTTPS、HSTS 和证书检查通过 |
| OAuth | 真实 GitHub App callback 在 staging 成功，伪造 state 失败 |
| Session | 登录、过期、Logout、角色变更后的会话策略通过 |
| Database | PostgreSQL migration 成功，TLS / encryption / PITR 已开启 |
| Backup | 完整备份和恢复演练记录，RPO / RTO 满足赛事要求 |
| CA | 正式 connector key 交付、验签、篡改、过期、重放和吊销演练通过 |
| Public boundary | 安全 E2E 与 API 响应抽查无内部字段 |
| Edge protection | WAF、限流和 body size 策略生效 |
| Monitoring | 登录、CA ingestion、Projection、Public API、DB 和错误率告警生效 |
| Load | 目标并发和刷新频率实测通过 |
| Operations | staging 全流程、fallback、事故响应和回滚演练完成 |

任一门禁缺失时，go/no-go 必须为 no-go。

---

# 9. 当前剩余风险

* connector key 当前通过环境变量 map 注入，尚无独立凭证签发、轮换和吊销控制台；正式赛事应优先接入 secret manager / KMS。
* 通用 append-only 安全审计日志尚未接入集中不可变日志平台；当前可追溯证据主要来自 AuthSession、CAIngestionReceipt、ReviewFlag 和领域事实。
* 应用层没有实现分布式限流，必须由 ingress / API gateway 提供。
* 尚未实现真实 CA HTTP snapshot fetch；当前生产端点接收的是签名 Riding Signal 摘要。
* 未对普通业务字段做字段级加密；正式环境依赖 PostgreSQL / 云盘 / 备份加密，若未来保存原始会话或敏感个人信息，必须重新做数据分类和字段级保护。
* CSP 当前用于限制嵌入、对象和表单目标，尚未升级为 nonce-based script CSP。

这些剩余项不影响本次代码安全基线结论，但其中第 7、8 节的生产门禁会决定能否承接真实赛事。
