# ARY Riding Record

记录时间：2026-06-21  
记录范围：本轮 Codex 协作对话中的项目问答、关键判断、实现动作和验收结果。  
隐私处理：GitHub OAuth Client Secret、用户提供的密钥、授权 code、临时 cookie/session 等敏感内容均不记录明文。

## 1. 项目入口与现状问答

### Q：当前项目中的应用如何启动？

A：项目里存在多个历史阶段产物：

* `design-prototype/`：高保真前端原型，早期可直接打开 `index.html` 查看。
* `app/`：无依赖本地 MVP，覆盖 DEV-4 到 OPS-1 的本地演示闭环。
* `web/`：正式 Next.js + Prisma + SQLite 集成应用，是当前推荐入口。

当前主入口是 `web/`：

```powershell
cd F:\lianggm2\project\ARY_GRS\ary-grs-003-Currygm\web
npm run dev
```

默认访问：

```text
http://127.0.0.1:3000
```

### Q：当前项目实现了哪些功能，还有哪些没有实现？

A：对照文档和代码，结论分阶段：

* DEV-1 到 DEV-3：领域模型、权限矩阵、Public Site 高保真页面、登录/Profile/Console 角色入口已形成。
* `app/`：本地 MVP 覆盖 DEV-4 到 OPS-1，可演示报名、RaceProject、CA、Projection、大屏、Report、Results、Ops。
* `web/` 初期：已完成 DEV-2/DEV-3 的高保真迁移和真实服务端数据接入。
* `web/` 后续补齐：已扩展到 DEV-4 到 REL-1 的本地演示闭环。

尚未实现或未生产化：

* 真实 CAConnector HTTP 接入。
* 生产级 staging / production 部署流水线。
* 生产监控、真实回滚、长期值守自动化。
* 完整浏览器 E2E 截图基线和 CI 化回归。

### Q：应用服务只有一个吗？有没有其他可以启动？

A：不是一个。历史上有两个主要可运行面：

* `app/`：本地 MVP，纯前端/本地领域逻辑，用于 DEV-4 到 OPS-1 演示。
* `web/`：正式集成应用，Next.js + Prisma + SQLite，是当前应继续推进和验收的应用。

`design-prototype/` 主要作为高保真原型与迁移来源保留。

### Q：截图中列出的 Race/Work 深链页面是否存在？

A：原型中存在类似 hash 深链页面；迁移到 `web/` 后，Next 路由采用标准路径：

* `/races/:slug`
* `/races/:slug/live`
* `/races/:slug/works`
* `/races/:slug/results`
* `/races/:slug/review`
* `/works/:slug`
* `/works/:slug/judge`

旧 hash 链接已通过兼容跳转处理。

## 2. 高保真原型与正式应用集成问答

### Q：是否现在有两个独立东西，一个只有高保真前端原型，另一个只实现后端功能但未适配高保真？

A：基本判断正确。早期状态是：

* `design-prototype/` 有高保真视觉和页面结构，但主要是静态/样例数据。
* `app/` 有本地业务闭环和领域动作，但不是正式 Next.js 工程，也不是完全高保真界面。

因此决定新建或继续推进 `web/`，作为正式 Next.js 全栈应用，把高保真 UI 和领域动作集成起来。

### Q：需要把二者集成到一起，如果页面缺失用相同元素补充，同时修复混乱页面。

A：形成并实施了 `web/` 集成方向：

* 保留 `app/` 和 `design-prototype/` 作为历史归档与迁移来源。
* 以 `design-prototype/` 的视觉和信息结构为主界面。
* 将 `app/domain.js` 的领域动作迁移到 `web/lib/domain.ts`。
* 使用 Prisma + SQLite 持久化。
* 页面缺失时复用已有高保真元素补齐，不引入新的视觉系统。

## 3. DEV-1 到 DEV-3 要求与验收问答

### Q：`ary-dev-1-dev-3-delivery.md` 和 `ary.plan.md` 中 DEV-1 到 DEV-3 是否满足？

A：对照文档后，DEV-1 到 DEV-3 已满足本地/原型交付口径：

* DEV-1：领域聚合、数据模型草案、权限矩阵、领域事件已输出。
* DEV-2：Public Site 静态闭环已覆盖 Home、Race、Live、Works、Work Detail、Results、Review、Rider、Cooperation。
* DEV-3：登录/Profile/角色 Console 静态演示已覆盖 Organizer、Rider、Judge、Admin。

迁移到 `web/` 后，DEV-2/DEV-3 页面和交互已接入真实 Prisma 数据、Server Actions 和权限上下文。

### Q：DEV-1、DEV-2、DEV-3 分别如何验收？

A：

* DEV-1 验收：检查领域对象、权限矩阵、数据模型、不变量、事件和接口鉴权规则是否能支撑后续实现。
* DEV-2 验收：以公众身份完成 Home -> Race -> Live -> Works -> Work Detail -> Results -> Review -> Rider/Cooperation 的公开浏览闭环。
* DEV-3 验收：完成登录/Profile，按角色进入 Console，Organizer/Rider/Judge/Admin 看到对应入口并能触发允许的动作。

## 4. GitHub OAuth 登录问答

### Q：当前默认账户是什么，如何使用登录功能？

A：`web` 支持两种模式：

* 未配置 GitHub OAuth 时，`/api/auth/github` 走本地 fallback 演示账号。
* 配置 GitHub OAuth 后，走真实 GitHub 登录。

本地 seed 中有演示用户，例如 Organizer、Rider、Judge。

### Q：DEV-3 要求的 GitHub 登录是不是还没实现？

A：初期判断为真实 GitHub OAuth 配置尚未完成。随后补充并验证：

* `/api/auth/github`
* `/api/auth/github/callback`
* OAuth callback 创建或更新 `User` / `AuthAccount`
* session cookie 生成 `AuthContext`
* profile 未完成时进入 `/profile`

### Q：为什么需要配置 OAuth？

A：因为真实 GitHub OAuth 必须依赖 GitHub OAuth App 的：

* Client ID
* Client Secret
* Callback URL

这些配置用于证明当前应用是 GitHub OAuth App 的合法调用方，并允许用授权码换取访问令牌。

### Q：如果换设备或换端口，这些配置还能用吗？

A：取决于 GitHub OAuth App 配置的 callback URL：

* 同一设备同一端口可继续使用。
* 换端口，需要在 GitHub OAuth App 中新增或修改 callback URL。
* 换服务器，需要配置该服务器域名/IP 对应的 callback URL。

### Q：另一台服务器不是我的 GitHub 账号，也能运行项目吗？

A：可以，但需要：

* 使用自己的 GitHub OAuth App，配置自己的 Client ID / Secret。
* 或由团队统一提供 dev/staging/prod 环境变量。
* 不建议多人共享个人 OAuth App 的生产 secret。

### Q：用户提供 OAuth Client ID 和 Secret 后如何处理？

A：已写入 `web/.env`，但本记录不保存任何明文 secret。对话中出现过的 secret 应按“已泄露”处理，建议到 GitHub OAuth App 中轮换 Client Secret。

### Q：GitHub 登录日志中的 307 / 200 是什么意思？

A：

* `GET /api/auth/github 307`：应用将用户重定向到 GitHub 授权页面。
* `GET /api/auth/github/callback?... 307`：GitHub 回调后，应用处理授权码并重定向到 Console。
* `GET /console 200`：Console 页面成功返回。

这说明真实 GitHub OAuth 基本跑通。

### Q：GitHub 登录后页面按不动怎么办？

A：排查发现真实 GitHub 新用户通常只有 `rider` 角色且没有报名记录，Console 初始状态缺少明显可操作入口。已修复：

* Rider 无报名时显示“报名参赛”按钮。
* 角色入口卡片改成真实可点击链接。
* `web/.gitignore` 忽略 dev server 日志。

## 5. Codex Windows 沙箱弹窗问答

### Q：出现 “COM+ 注册表数据库检测到一个系统错误” 是什么？

A：这是 Codex Desktop 的 Windows 沙箱辅助程序 `codex-windows-sandbox-setup.exe` 报错，不是 `web` 应用本身的错误。它影响的是 Codex 执行某些本地命令或 `apply_patch` 的能力。

处理方式：

* 后续改用 PowerShell/.NET 写文件。
* 避免依赖失败的 `apply_patch`。
* 应用代码和 Next 构建可继续验证。

## 6. DEV-4 到 REL-1 检查与补齐问答

### Q：检查 `web` 中 DEV-4 到 OPS-1 / DEV-4 到 REL-1 是否实现？

A：初始检查结论：

* DEV-4、DEV-5、DEV-7 在 `web` 中已有大部分领域动作。
* DEV-6 Screen Console / Screen Display 基本缺失。
* DEV-7 缺 Report 编辑、失败重跑。
* REL-1 只有 P0 和 checklist 展示，缺少可触发的灰度、正式发布、go/no-go 证据。
* OPS-1 本轮不纳入补齐范围。

### Q：按本地演示闭环补齐 DEV-4 到 REL-1。

A：已实施：

* DEV-4：补齐 Race 创建/发布入口；保留报名、审核、RaceProject、Work、Judge 流程。
* DEV-5：补齐 CAConnection 禁用、Projection 失败隔离、多连接状态展示。
* DEV-6：新增 `/screen` 和 `/screen/display`，支持 `live / leaderboard / works / announcement / fallback`。
* DEV-7：补齐 Report 失败、重跑、编辑、发布；保持公开边界。
* REL-1：Ops 页面支持 P0、release checklist、灰度、正式发布、go/no-go 证据记录。

新增或修改的主要位置：

* `web/lib/domain.ts`
* `web/app/actions.ts`
* `web/app/console/page.tsx`
* `web/app/ops/page.tsx`
* `web/app/screen/page.tsx`
* `web/app/screen/display/page.tsx`
* `web/app/api/public/races/[slug]/screen/route.ts`
* `web/prisma/schema.prisma`
* `web/prisma/seed.ts`
* `web/tests/domain.test.ts`

### Q：DEV-4 到 REL-1 补齐后的验证结果？

A：已通过：

```text
prisma generate
prisma db push
tsx prisma/seed.ts
tsx tests/domain.test.ts   # 15 PASS
tsc --noEmit
next build
GET /screen -> 200
```

### Q：能否启动 web 服务？

A：构建和临时 HTTP 验证通过。持久后台启动曾被本机策略拦截；可以手动启动：

```powershell
cd F:\lianggm2\project\ARY_GRS\ary-grs-003-Currygm\web
npm run dev
```

## 7. CA 接入问答

### Q：目前 CA 接入是如何实现的？

A：当前 `web` 中的 CA 接入是本地演示版，不是真实外部 CAConnector。

流程：

1. Organizer 审核报名，系统幂等创建 RaceProject。
2. Rider 为 RaceProject 登记 CAConnection。
3. Rider 或 Organizer 触发握手。
4. Rider 在 Console 中手动提交一条模拟合法 CA Signal。
5. 服务端校验 CAConnection 是否存在、已握手、未禁用、归属正确。
6. 合法信号写入 `Session`、`Evidence`，并更新 `RaceProject` / `CAConnection` 状态。
7. 非法、未握手、归属错误、被禁用的信号生成 `ReviewFlag`，不进入 Evidence 或 Projection。
8. `rebuildProjection` 用当前事实数据生成稳定 Projection。

### Q：也就是说当前还无法接入真实 CA？

A：是。当前可以演示 CA 业务闭环和接入边界，但还不能连接真实外部 CA / Codex Agent 运行数据。

尚缺：

* 真实 connector 服务。
* Webhook / push API。
* HTTP fetch snapshot。
* connector 凭证和签名校验。
* 生产级幂等、审计日志、重放防护。

### Q：文档中有没有指导如何接入 CA？

A：有方向性指导，但不是完整实施手册。

主要文档：

* `docs/ary-ca-integration-spec.md`
* `docs/ary-dev-1-dev-3-delivery.md`
* `docs/ary-qa-plan.md`

其中 `ary-ca-integration-spec.md` 已定义：

* CAConnection 登记与握手。
* 合法 CA 数据边界。
* `RidingSignalMessage` 消息草案。
* Session Snapshot fetch 建议接口。
* Projection / Evidence / Report 输入边界。
* CA 失败不取消参赛，只形成风险提示。

仍缺：

* 真实 webhook 路径。
* connector 鉴权方式。
* 签名校验。
* secret 管理。
* 错误码和重试策略。
* connector SDK 或部署说明。

## 8. 隐私与安全问答

### Q：OAuth secret 泄露给团队成员是否有风险？

A：有风险。OAuth Client Secret 不等于 GitHub 账号密码，但它能让持有者伪装成该 OAuth App 参与授权码交换。对话中曾出现过 secret，因此建议按“已泄露”处理。

建议：

* 到 GitHub OAuth App 中重新生成 Client Secret。
* 更新 `web/.env`。
* 确认 `.env` 未提交。
* 团队协作使用密码管理器、部署平台环境变量或每人单独 dev OAuth App。

本记录不包含任何 OAuth secret 明文。

### Q：`.env` 是否会被提交？

A：不会。检查时 `web/.env` 处于 ignored 状态；`web/dev-server*.log` 也已加入 ignore。

## 9. 仓库提交与上传问答

### Q：整理当前实现的所有功能并 commit 到 GitHub 仓库。

A：此前已在分支 `codex/web-dev2-dev3-integration` 上提交并推送过一次：

```text
42880ee Add integrated Next.js web app
```

后续 DEV-4 到 REL-1 补齐完成后，尝试再次提交上传时遇到环境限制：

```text
fatal: Unable to create '.git/index.lock': Permission denied
```

当时 `.git` 对 Codex 会话不可写，且本机没有安装 `gh`，所以未能完成第二次提交和推送。

建议手动执行：

```powershell
cd F:\lianggm2\project\ARY_GRS\ary-grs-003-Currygm
git add PLAN.md STATUS.md web/.gitignore web/README.md web/app web/lib web/prisma web/tests
git commit -m "Complete web DEV-4 to REL-1 demo flow"
git push origin codex/web-dev2-dev3-integration
```

## 10. 当前实现功能总览

### Public

* Home / Race Gallery
* Race Detail
* Live Hall
* Works
* Race Works
* Work Detail
* Results
* Review
* Rider Profile
* Cooperation
* 旧 hash 深链兼容跳转

### Auth / Profile

* GitHub OAuth 登录。
* 本地 fallback 登录。
* `ary_session` cookie。
* Profile Completion。
* 角色上下文：Rider / Judge / Organizer / Admin。

### Console

* Organizer View：
  * Race 创建/发布。
  * 报名审核。
  * RaceProject 幂等生成。
  * CAConnection 状态查看和禁用。
  * Work 公开。
  * Judge 分配。
  * Award 发布。
  * Report 生成、失败模拟、编辑、重跑、发布。
  * Projection 重建和失败隔离。
* Rider View：
  * 报名。
  * 查看 Registration / RaceProject / Work 状态。
  * CAConnection 登记、握手。
  * 模拟合法 CA Signal。
  * 提交 Work。
* Judge View：
  * 查看分配作品。
  * 进入 Judge View 提交评分。
* Admin Console：
  * 维护 `User.roles`。

### Screen

* `/screen` 控制台。
* `/screen/display` 大屏展示。
* 支持模式：
  * live
  * leaderboard
  * works
  * announcement
  * fallback
* 新增 `ScreenState` 持久化当前大屏状态。

### Ops / Release

* P0 Regression。
* Release Checklist 可操作。
* 灰度发布证据。
* 正式发布证据。
* go/no-go 证据。
* Backup 记录。
* Incident 展示保留。

### Data / Domain

Prisma + SQLite 覆盖：

* User
* AuthAccount
* Race
* Registration
* RaceProject
* CAConnection
* Session
* Work
* Evidence
* ReviewFlag
* JudgeAssignment
* JudgingRecord
* Award
* Report
* Projection
* Announcement
* ScreenState
* Backup
* Incident
* ReleaseChecklistItem

### APIs

* `/api/public/races`
* `/api/public/races/:slug`
* `/api/public/races/:slug/live`
* `/api/public/races/:slug/works`
* `/api/public/races/:slug/results`
* `/api/public/races/:slug/review`
* `/api/public/races/:slug/screen`
* `/api/public/works`
* `/api/public/works/:slug`
* `/api/public/riders/:id`
* `/api/console/action`
* `/api/auth/github`
* `/api/auth/github/callback`

## 11. 当前未完成 / 后续建议

* 真实 CAConnector 接入仍未实现。
* 需要补 connector webhook / push API。
* 需要补 HTTP snapshot fetch。
* 需要设计 connector 凭证、签名校验、重放防护、错误码、重试策略。
* 需要补生产部署、staging、production、CI/CD。
* 需要补浏览器 E2E 和截图回归。
* OAuth secret 已在对话中暴露过，建议轮换。

