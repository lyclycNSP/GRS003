# ARY Web

`web/` 是 ARY 的正式工程化入口，用 Next.js App Router、Prisma 和 SQLite 将高保真原型与本地 MVP 领域动作集成到一个可运行应用中。

## 运行

```bash
cp .env.example .env
npm install
npm run db:init
npm run seed
npm run dev
```

默认入口：

```text
http://127.0.0.1:3000
```

`db:init` 会重建 `DATABASE_URL` 指向的 SQLite 数据库；只对本地开发库或一次性测试库执行。未配置 GitHub OAuth 时不会自动降级登录；本地角色验收需设置 `ENABLE_DEBUG_LOGIN=true`，且该入口在 production 强制禁用。

### 浏览器验收：作品提交完整性

1. 启动后打开 `http://127.0.0.1:3000/api/debug/login?user=rider_e2e`，进入 Rider Console，确认提交窗口为 open。
2. 填写标题、摘要、`https://github.com/<owner>/<repo>`、40 位 commit SHA 和可选公共 HTTPS Demo，点击“提交 Work”；页面应显示 v1、commit SHA 和 64 位完整性哈希。
3. 修改内容与 commit SHA 再提交，刷新后应显示 v2；数据库中的 v1 不变。
4. 打开 `http://127.0.0.1:3000/api/debug/login?user=organizer`，选择 Submission Integrity E2E Race，填写原因并“提前关闭全场提交”。
5. 切回 rider_e2e，提交按钮应禁用；服务端直接提交也会被拒绝。
6. Organizer 在冻结后分配 Judge；打开 `http://127.0.0.1:3000/api/debug/login?user=judge`，Judge View 应显示 assignment 固定的版本号、commit SHA 和哈希。
7. 公开 Work 页面只应显示已公开版本元数据，不应出现提交人内部 ID、审计事件或锁定原因。

## 验证

不依赖安装包的工程骨架检查：

```bash
npm.cmd run check:static
```

完整本地验证：

```bash
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
```

如果 PowerShell 拦截 `npm`，使用 `npm.cmd`。

### 全角色 / Public / Screen E2E

首次运行前安装 Chromium：

```bash
npx playwright install chromium
```

全部 E2E 或按场景运行：

```bash
npm run test:e2e
npm run test:e2e:judge
npm run test:e2e:public
npm run test:e2e:screen
npm run test:e2e:rider
npm run test:e2e:organizer
npm run test:e2e:admin
npm run test:e2e:security
```

E2E 使用独立的 `prisma/e2e.db`，每次执行会重建 schema 和 Seed 数据，不读写本地开发数据库。测试服务只在本地启用 Debug Login。

### GitHub Actions CI

`.github/workflows/web-ci.yml` 在 `web/**` 或 Workflow 变化时运行两个并行质量门：

* `Static, domain and build`：安装依赖、初始化独立测试库、静态烟测、TypeScript、领域测试和 production build。
* `Playwright browser E2E`：安装 Chromium 并运行全部 14 个浏览器场景；失败时上传 trace、截图和 HTML report，保留 7 天。

CI 使用 Node.js 22、Python 3.13 和只读仓库权限。首次托管 Runner 结果需要在 Workflow 推送到 GitHub 后确认。

## 覆盖范围

* Public：Home、Race Detail、Live Hall、Works、Work Detail、Results、Review、Rider Profile、Cooperation。
* Auth/Profile：GitHub OAuth state 校验、数据库随机会话、本地显式 Debug Login、资料补全、Workspace 前置校验。
* Console：Organizer、Rider、Judge、Admin 角色入口，Race 创建/发布、报名审核、RaceProject、CAConnection、Work、Judge、Award、Report、Projection、Admin roles。
* Screen：Screen Console / Screen Display，支持 live、leaderboard、works、announcement、fallback 模式。
* Ops：P0 回归、发布检查项、灰度/正式发布证据、go/no-go、备份记录。
* API：`/api/public/races`、`/api/public/races/:slug`、Live、Works、Results、Review、Work detail、Rider detail。

DEV-2 / DEV-3 的高保真页面与交互已迁入 `web/`；DEV-4 到 REL-1 已补齐为本地演示闭环：Race、报名、RaceProject、CA、Projection、Screen、Report、Results、Review 和发布证据均通过服务端数据和 Server Actions 驱动。

## 当前功能清单

### Public Site

* Race Gallery：首页展示当前主推赛事、Live Race 切换、公开作品入口、最新结果和合作入口。
* Race Page：展示单场赛事赛题、状态、报名 CTA、Live / Works / Results / Review 入口。
* Live Hall：读取稳定 Projection，展示 Riding Signal、过程指标、事件流和过程榜。
* Works：展示全站公开作品列表和单场作品墙。
* Work Page：展示作品摘要、Demo、Repo、Rider Profile 回链、Race 回链、公开 Evidence 和 ReviewFlag 摘要。
* Results：展示已发布 Award、最终榜单和公开 race_report。
* Review：展示已发布 review_summary 和公开 Evidence 摘要。
* Rider Profile：展示 Rider 的公开作品、奖项和参赛资产。
* Cooperation：提供 Rider 报名、Organizer 办赛、赞助和合作入口。
* Hash 兼容：旧原型 hash 深链会跳转到新的 Next.js 路由。

### Auth / Profile / Roles

* GitHub OAuth 路由：`/api/auth/github` 和 `/api/auth/github/callback`。
* 本地 Debug Login：仅在非 production 且显式设置 `ENABLE_DEBUG_LOGIN=true` 时可用；OAuth 未配置时不会自动登录演示账号。
* Profile Completion：未补全资料的用户进入 `/profile`，保存展示名、城市和 GitHub login 后进入 Workspace。
* 服务端会话：`ary_session` 使用随机不透明 token，数据库只保存 SHA-256 hash，并生成 `AuthContext`。
* 角色上下文：支持 `rider`、`judge`、`organizer`、`admin`。

### Console / Domain Actions

* Organizer View：Race 创建/发布、报名审核、RaceProject 幂等生成、CAConnection 禁用、UTC 提交窗口配置/提前冻结、作品公开、固定版本 Judge 分配、Award 发布、Report 生成/失败/编辑/重跑/发布、Projection 重建与失败隔离。
* Rider View：查看个人或团队 Registration、RaceProject、CAConnection、Work 状态；可个人报名、创建/加入团队、提交团队报名；审核通过后登记/握手 CAConnection、接入合法 CA Signal，并由个人参赛者或队长在开放窗口内提交不可变 Work 版本。
* Judge View：查看 assignment 固定的作品版本、commit SHA 和哈希，并提交评分。
* Admin Console：维护 `User.roles`，在无 JudgeAssignment 时带原因和未来截止时间紧急重开提交。
* Screen：`/screen` 控制大屏模式，`/screen/display` 输出现场展示。
* Ops：P0 回归、发布检查项、灰度/正式发布证据、go/no-go、备份记录和运维入口。

### Data / APIs / Tests

* Production 使用 Prisma + PostgreSQL migration；SQLite 仅用于本地 / E2E。模型包含 Team、TeamMember、AuthSession、CAIngestionReceipt、WorkSubmissionVersion 和 SubmissionAuditEvent，承接团队参赛、可撤销会话、CA 防重放与作品提交完整性。
* Public API 覆盖 races、race detail、live、works、results、review、screen、work detail、rider detail。
* 领域测试覆盖 Race 创建/发布、重复报名、团队创建/加入/报名/共享 CA、RaceProject 幂等、权限拒绝、Profile Completion、Admin roles、Work 不可变版本/哈希/窗口/冻结/评审绑定、CA 合法/非法/禁用接入、Projection 失败隔离、Screen mode、Report 可见性/失败重跑/编辑发布和 P0 回归。
* Playwright E2E 共 14 个场景，除全角色 / Public / Screen 外，增加 OAuth state、随机会话、Public DTO、安全头、Ops 读取隔离和未签名 CA API 拒绝检查。

真实赛事部署、安全配置和 go-live 硬门禁见 `../docs/ary-production-security-baseline.md`。生产启动会先运行 `npm run check:production-config`，数据库迁移使用 `npm run prisma:migrate:deploy`。

根目录旧 `app/` 静态 MVP 已删除；`design-prototype/` 保留为历史原型与视觉迁移来源。
