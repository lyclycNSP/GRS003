# ARY Web

`web/` 是 ARY 的正式工程化入口，用 Next.js App Router、Prisma 和 SQLite 将高保真原型与本地 MVP 领域动作集成到一个可运行应用中。

## 运行

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
```

默认入口：

```text
http://127.0.0.1:3000
```

如果没有配置 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`，`/api/auth/github` 会进入本地演示账号回调，便于本地走通 Console。

## 覆盖范围

* Public：Home、Race Detail、Live Hall、Works、Work Detail、Results、Review、Rider Profile、Cooperation。
* Auth/Profile：GitHub OAuth / 本地 fallback 登录、资料补全、Workspace 前置校验。
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
* 本地 fallback 登录：未配置 GitHub OAuth 环境变量时进入演示账号。
* Profile Completion：未补全资料的用户进入 `/profile`，保存展示名、城市和 GitHub login 后进入 Workspace。
* 服务端会话：通过 `ary_session` cookie 生成 `AuthContext`。
* 角色上下文：支持 `rider`、`judge`、`organizer`、`admin`。

### Console / Domain Actions

* Organizer View：Race 创建/发布、报名审核、RaceProject 幂等生成、CAConnection 禁用、作品公开、Judge 分配、Award 发布、Report 生成/失败/编辑/重跑/发布、Projection 重建与失败隔离。
* Rider View：查看自己的 Registration、RaceProject、CAConnection、Work 状态，登记/握手 CAConnection，接入合法 CA Signal，提交 Work。
* Judge View：查看分配作品并进入 Judge View 提交评分。
* Admin Console：维护 `User.roles`。
* Screen：`/screen` 控制大屏模式，`/screen/display` 输出现场展示。
* Ops：P0 回归、发布检查项、灰度/正式发布证据、go/no-go、备份记录和运维入口。

### Data / APIs / Tests

* Prisma + SQLite 覆盖 User、AuthAccount、Race、Registration、RaceProject、CAConnection、Session、Work、Evidence、ReviewFlag、JudgeAssignment、JudgingRecord、Award、Report、Projection、Announcement、ScreenState、Backup、Incident、ReleaseChecklistItem。
* Public API 覆盖 races、race detail、live、works、results、review、screen、work detail、rider detail。
* 领域测试覆盖 Race 创建/发布、重复报名、RaceProject 幂等、权限拒绝、Profile Completion、Admin roles、Work/Judge、CA 合法/非法/禁用接入、Projection 失败隔离、Screen mode、Report 可见性/失败重跑/编辑发布和 P0 回归。

`app/` 和 `design-prototype/` 保留为历史归档与迁移来源。
