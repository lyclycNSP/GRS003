# ARY Web

`web/` 是 ARY 的正式工程化入口，用 Next.js App Router、Prisma 和 SQLite 将高保真原型与本地 MVP 领域动作集成到一个可运行应用中。

## 运行

```bash
cp .env.example .env
npm install
npm run dev
```

默认入口：

```text
http://127.0.0.1:3000
```

> **数据保护警告：不要把 `npm run db:init` 或 `scripts/init-sqlite.py` 当作常规启动步骤。** 两者会重建 `DATABASE_URL` 指向的 SQLite 数据库。未经用户明确确认，禁止对 `web/prisma/dev.db` 执行这些命令；先备份并核对绝对路径。领域测试和 E2E 必须使用隔离的 `DATABASE_URL=file:./e2e.db`，不得读写手工开发库。

仅在用户确认要创建或重置一次性数据库后，才执行 `db:init` 和 `seed`。本轮验证期间 `web/prisma/dev.db` 曾被误重建，未发现可用备份，当前为 Seed 基线，原手工开发数据无法恢复。在 `dev.db` 上重复运行 `npm test` 还可能受到测试残留数据影响，不应将其误判为代码失败。

未配置 GitHub OAuth 时不会自动降级登录；本地角色验收需设置 `ENABLE_DEBUG_LOGIN=true`，且该入口在 production 强制禁用。

### 登录与跳转调试

* `/login` 是统一登录页。游客访问 `/console` 或其他保护入口时会进入 `/login?next=...`；`next` 只接受安全的站内路径，认证完成后不会跳往外部站点。
* GitHub OAuth 使用 `/api/auth/github` 与 callback，`NEXT_PUBLIC_APP_URL` 是唯一规范 Origin；从 `localhost` 等非规范 Host 发起时会先回到规范 Origin。最多保留 4 个、10 分钟有效的并发 state，callback 只消费匹配项。事务成功后才写 `ary_session` Cookie，页面只展示脱敏后的友好错误。
* 本地 Debug Login 使用当前请求的可信 Host / forwarded origin 生成回跳地址，浏览器以 `localhost` 打开时继续留在 `localhost`，以 `127.0.0.1` 打开时继续留在 `127.0.0.1`，避免跨 Host 导致 Cookie 看似丢失。
* 登录页和 Debug 账号入口使用原生链接访问认证 API，由浏览器完整导航回应用，使 Next.js RootLayout 重新读取最新 session。不要把这些入口改为只在客户端替换 URL 的跳转。
* 本地调试推荐先打开 `http://127.0.0.1:3000/login?next=/console`；启用 Debug Login 后选择账号，完成后应直接进入带左侧栏的对应角色工作台。

### 浏览器验收：PC 全站视觉与持久角色侧栏

本轮只验收 PC，建议分别使用 1280、1440、1920 宽度走查。先确认 `.env` 中 `ENABLE_DEBUG_LOGIN=true`，启动开发服务后可从 `/debug-login` 选择账号，也可直接访问以下入口：

| 身份 | Debug Login | 主要检查 |
| --- | --- | --- |
| Rider | `/api/debug/login?user=rider` | 仅本人参赛空间、Rider 资料、账号设置；公共内容从站点顶栏访问 |
| Organizer | `/api/debug/login?user=organizer` | 我的赛事、单场 Race Workspace，以及携带当前 `raceId` 的 Risk、Screen、Track、Ops |
| Judge | `/api/debug/login?user=judge` | 评审工作台、分配作品的 Judge View、评审上下文 Risk Center 和资料入口 |
| Admin | `/api/debug/login?user=admin` | 管理工作台、角色申请、用户与资格、账号设置 |
| Multi-role | `/api/debug/login?user=multi` | RoleSwitcher 只列出有效资格，切换后侧栏菜单与工作台同步变化 |

手工走查顺序：

1. 使用无登录 Cookie 的浏览器打开 `/`、`/works`、`/riders` 和 `/cooperation`，应显示新版公共顶栏，不显示角色侧栏。
2. 登录后继续浏览 `/`、`/works`、`/riders`、`/cooperation` 和公开详情时仍使用公共顶栏，Login 被替换为“工作台”和“退出”，不显示角色侧栏或 RoleSwitcher。
3. 点击“工作台”后进入角色外壳；刷新 `/profile`、`/onboarding/{role}` 和 Console 深层地址时侧栏恢复。四角色侧栏不再包含公共 Race、Works、Riders、Cooperation。
4. Organizer 进入 `/console/organizer/races/race_bay_2026` 后，侧栏应出现“当前 Race”分组；Risk、Screen、Track、Ops 均携带 `raceId=race_bay_2026`。返回 `/console/organizer` 后不得伪造单场 Race 上下文。
5. 首页“探索公开赛事”、`/works`、`/riders` 分别使用 `q/status/page`、`q/race/page`、`q/skill/page`，固定每页 9 条；检查第 10 条进入下一页、翻页保留条件、非法/越界页收敛，以及 draft/private Race、非公开 Work 和无有效资格 Rider 不泄露。
6. `/screen?raceId={raceId}`、Risk Center、Track Management、Track Calibrator 和 Ops 使用角色外壳；`/screen/display/{raceId}` 是独立投屏页，旧 `/screen/display` 只提示未指定赛事。
7. `/console/rider` 是全部参赛赛事入口；个人、团队及筹备记录分别进入 `/console/rider/races/{raceId}`，不再自动只选第一场。
8. 首页 Hero 最多轮播六场赛事；Admin 在工作台“首页赛事精选”中可置顶、排序和隐藏，未置顶空位按真实批准 Rider 与公开 Work 数自动补齐。自动、箭头、圆点和键盘切换应有明确横向位移，首尾无闪白；悬停、焦点和页面隐藏时暂停。
9. 首页下方应只出现最多 3 项精选 Works、动态最新赛果和窄版合作 CTA；完整作品、赛果与合作内容仍进入各自页面。
10. 四角色侧栏底部的“返回公共主页”应进入 `/` 并卸载侧栏；公共顶栏保持登录态的“工作台”和“退出”。
11. 检查固定侧栏不随右侧页面滚动消失，弹层不被遮挡，页面不存在横向溢出。本轮不以手机和平板视口作为验收门禁。

本次视觉重构不修改 Prisma Schema、外部 API、Server Action 输入或权限矩阵。最终验证结果见下方“验证”：自动化质量门已通过；Browser runtime 无可用实例，因此没有追加人工点击与截图走查。

### 浏览器验收：Organizer Portfolio 与 Race Workspace

1. 打开 `http://127.0.0.1:3000/api/debug/login?user=organizer`，应进入 `/console/organizer`；首页只显示账号级统计、创建表单和本人拥有或协作管理的 Race，不显示 Registration、CA、Projection、Work、Report 或风险卡。
2. Race 卡显示 Owner / Collaborator、状态、可见性、创建时间和短 ID；点击“进入赛事”后进入 `/console/organizer/races/{raceId}`，单场运营指标和业务动作都在该页面。
3. 打开 `http://127.0.0.1:3000/api/debug/login?user=organizer_alt`，该隔离账号只应看到“智能投研助理”；直接访问 `race_bay_2026` 的新 Workspace URL 应返回 404。
4. Multi-role Debug 账号是“湾区开心游”的 Collaborator，可以进入该 Race Workspace，但不会看到其他 Organizer 的独立 Race。
5. 旧 `/console?raceId=...` 与 `/console/organizer?raceId=...` 会兼容跳转到新路由；创建成功后也会直接进入新 Race Workspace。

公开主页只展示 `visibility=public` 的 Race。新建 Race 初始为 `draft/private`，不会出现在主页；Organizer 需要进入对应 Race Workspace 点击“发布当前 Race”，看到“现已显示在公开主页”后才算完成公开发布。Portfolio 的草稿卡会直接提示这一边界。

### 浏览器验收：Rider 报名

1. Organizer 创建并发布一场 Race 后，在公开主页确认该 Race 卡可见。
2. 使用 Rider 身份进入该 Race Page；报名开放时点击“报名参赛”，弹窗提供个人报名、创建团队、加入团队。
3. 创建团队填写名称、可选简介和 2–10 人上限；加入团队必须填写属于当前 Race 的邀请码。成功后进入 `/console/rider?raceId=...`。
4. 团队草稿显示“团队筹备中”；赛事空间始终显示名册和队长/队员身份。队长可编辑、复制邀请码、移除成员及提交团队报名，队员只能查看并在提交前退出；提交后锁定。
5. 个人报名完成后页面显示 `已报名 · pending`；刷新后不再出现报名弹窗。公开报名人数以真实 Registration 为准，草稿团队不提前计数。
6. 未登录、当前角色不是 Rider 或报名未开放时，页面分别显示登录、切换角色或关闭状态；伪造请求也由服务端拒绝并返回页面反馈。

Debug Seed 变更只会在重新初始化并执行 `npm run seed` 后进入本地库。该操作会重建开发数据；为保留已有 Race 与历史同名 draft，请不要仅为本轮 UI 验收重置当前开发库。

### 浏览器验收：作品提交完整性

1. 启动后打开 `http://127.0.0.1:3000/api/debug/login?user=rider_e2e`，进入 Rider Console，确认提交窗口为 open。
2. 填写标题、摘要、`https://github.com/<owner>/<repo>`、40 位 commit SHA 和可选公共 HTTPS Demo，点击“提交 Work”；页面应显示 v1、commit SHA 和 64 位完整性哈希。
3. 修改内容与 commit SHA 再提交，刷新后应显示 v2；数据库中的 v1 不变。
4. 打开 `http://127.0.0.1:3000/api/debug/login?user=organizer`，选择 Submission Integrity E2E Race，填写原因并“提前关闭全场提交”。
5. 切回 rider_e2e，提交按钮应禁用；服务端直接提交也会被拒绝。
6. Organizer 在冻结后分配 Judge；打开 `http://127.0.0.1:3000/api/debug/login?user=judge`，Judge View 应显示 assignment 固定的版本号、commit SHA 和哈希。
7. 公开 Work 页面只应显示已公开版本元数据，不应出现提交人内部 ID、审计事件或锁定原因。

### 浏览器验收：Race Live 与 Track Calibrator

1. 使用 `ENABLE_DEBUG_LOGIN=true` 启动本地服务，打开 `http://127.0.0.1:3000/api/debug/login?user=organizer`，再进入 `/console/organizer/races/race_bay_2026`。
2. Console 侧栏应显示 `Track Management`；进入后点击“打开 Track Calibrator”。Rider 登录时直接访问该地址应显示无权访问。
3. Calibrator 顶部可导入/导出 Draft、撤销、重做和反转方向；画布与 Inspector 编辑后自动校验应回到 `dirty / not validated`。预览可切换 1/4/8 Racer、分布场景和进度，主赛道与 Mini Map 使用同一 Track Runtime。
4. 发布前必须先运行自动校验并完成 8 项人工核验。服务端会重新鉴权和校验 Profile、背景 MIME/尺寸/checksum 与运行时几何；成功后生成不可变版本。被 Round 引用的版本不能归档，只有未引用的 archived 版本可删除。
5. 激活对应 Organizer 后从 Race Workspace 打开 `/screen?raceId={raceId}`；缺少、无效或未授权 Race 不回退默认赛事。可选择模式、暂停/恢复轮播、前后切组并配置 5–120 秒间隔。
6. 打开 `/screen/display/{raceId}`。public 且非 draft 的 Race 可匿名观看，private/draft 仅该 Race Organizer 预览；不同 Race 的模式、公告、Projection、作品和 Track 不得串流。Live 应恢复暗色完整赛道、TOP3、KPI、Mini Map、Ticker 与 Footer；榜单、作品和公告共享同一暗色赛事框架。
7. 执行 P0 彩排后 ScreenState 应回到 `live`。无 Projection 时只显示真实赛事名称、状态、报名数、作品数和等待 Round/Track/Projection 配置提示，不伪造排名或马匹。

## 验证

日常快速检查：

```bash
npm.cmd run check:quick
```

该命令依次执行静态工程检查和 TypeScript 类型检查。认证跳转或 OAuth 纯函数发生局部变化时，可追加：

```bash
npm.cmd run test:auth:quick
```

定向 E2E 调试时，只准备一次隔离测试库，然后连续运行需要的 spec：

```bash
npm.cmd run test:e2e:prepare
npm.cmd run test:e2e:run -- e2e/organizer.spec.ts
npm.cmd run test:e2e:run -- e2e/rider.spec.ts
```

本轮公共目录、轮播、大屏和工作台返回入口可定向执行：

```bash
npm.cmd run test:e2e:prepare
npm.cmd run test:e2e:run -- e2e/public-home-catalog.spec.ts e2e/works-pagination.spec.ts e2e/riders-pagination.spec.ts
npm.cmd run test:e2e:run -- e2e/screen-display-frame.spec.ts e2e/workspace-public-return.spec.ts
```

分页纯函数可单独运行：

```bash
npx.cmd tsx tests/pagination.test.ts
```

公共目录分页、Hero 横向轮播、Race Live 四模式框架与工作台返回入口的实现及独立复验已完成。本轮 `check:quick`、分页与 screen-p0 领域测试、本轮新增定向 E2E 10/10 通过；production build 首次且唯一一次通过，仅有 autoprefixer `flex-end` 和多 lockfile 警告。首次且唯一一次完整 E2E 为 49 pass / 6 fail / 1 未运行，暴露测试隔离和 Projection 选择问题；修复后只复跑相关 5 个 spec，15/15、0 失败、0 未运行，未重复完整 E2E 或 build，因此不能写成“修复后完整 E2E 全绿”。验证前后 `dev.db` 哈希一致，开发服务恢复为 `127.0.0.1:3000` HTTP 200。Screen 两种大屏视口与轮播由 Playwright 覆盖，人工 Browser 走查因无可用实例未完成。

`test:e2e:run` **不会**执行 prepare，也不会创建或重建数据库；使用前必须在本轮明确执行一次 `test:e2e:prepare`，并确认目标是隔离的 `prisma/e2e.db`。不要把它直接用于 `dev.db`。测试失败时优先复跑失败 spec，修复稳定后再按风险等级决定是否运行完整 E2E。

发布、里程碑、L3 稳定后或用户明确要求时，执行完整本地门禁：

```powershell
$env:DATABASE_URL="file:./e2e.db"
npm.cmd test
npm.cmd run test:e2e
npm.cmd run typecheck
npm.cmd run build
```

如果 PowerShell 拦截 `npm`，使用 `npm.cmd`。

L0/L1 与纯单测不需要停止开发服务；只有 Prisma generate 或浏览器 E2E 确实需要时才做一次受控停机，并在整轮验证结束后统一恢复。日常 L0/L1 不默认运行 production build 或完整 E2E，但 CI 与正式发布门禁保持不变。每次交付说明必须列出实际运行和主动跳过的检查。

本次 UX-1 PC 全站重构及登录/跳转/滚动修复的本地结果：

* `npm.cmd run check:static` 通过，覆盖 28 pages / 15 APIs。
* 设置 `DATABASE_URL=file:./e2e.db` 后，`npm.cmd test` 全部通过；隔离数据库用于保护 `dev.db`。
* `npm.cmd run typecheck`、`npm.cmd run build` 和 `git diff --check` 通过。
* 登录、跳转与滚动定向 Playwright E2E 10/10 通过；标准完整 Playwright E2E 40/40 通过，覆盖 PC 1280、1440、1920 视口；Browser runtime 无可用实例，额外人工走查受阻。
* 开发服务已恢复到 3000 端口并返回 HTTP 200。
* 验证前后 `web/prisma/dev.db` 的 SHA-256 未变化；本轮测试只使用隔离的 `e2e.db`。
* `npm.cmd run check:production-config` 在本地因缺少生产变量按预期失败；只有目标环境补齐真实生产配置后才能把该门禁标记为通过。

不要在 `dev.db` 上重复运行领域测试来判断回归；测试写入残留可能造成后续重复执行失败，应清理/重建隔离的 `e2e.db` 后重试。该现象不等同于代码失败。

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
* `Playwright browser E2E`：安装 Chromium 并运行全部浏览器场景；失败时上传 trace、截图和 HTML report，保留 7 天。场景数量以当次 `playwright test --list` / 实际运行结果为准，不维护易失真的固定数字。

CI 使用 Node.js 22、Python 3.13 和只读仓库权限。首次托管 Runner 结果需要在 Workflow 推送到 GitHub 后确认。

## 覆盖范围

* Public：Home、Race Detail、Live Hall、Works、Work Detail、Results、Review、Rider Directory、Rider Profile、Cooperation。
* Auth/Profile：GitHub OAuth state 校验、数据库随机会话、本地显式 Debug Login、资料补全、Workspace 前置校验。
* Console：Organizer、Rider、Judge、Admin 角色入口，Race 创建/发布、报名审核、RaceProject、CAConnection、Work、Judge、Award、Report、Projection、Admin roles。
* Screen：Screen Console / Screen Display，支持 live、leaderboard、works、announcement、fallback 模式。
* Ops：P0 回归、发布检查项、灰度/正式发布证据、go/no-go、备份记录。
* API：`/api/public/races`、`/api/public/races/:slug`、Live、Works、Results、Review、Work detail、Rider detail。

DEV-2 / DEV-3 的高保真页面与交互已迁入 `web/`；DEV-4 到 REL-1 已补齐为本地演示闭环：Race、报名、RaceProject、CA、Projection、Screen、Report、Results、Review 和发布证据均通过服务端数据和 Server Actions 驱动。

## 当前功能清单

### Public Site

* Race Gallery：首页展示当前主推赛事、Live Race 切换、公开作品入口、最新结果和合作入口。
  * Hero 使用可感知横向位移的无缝轮播；Race 目录支持搜索、状态筛选和每页 9 条分页。
* Race Page：展示单场赛事赛题、状态、报名 CTA、Live / Works / Results / Review 入口。
* Live Hall：读取稳定 Projection，展示 Riding Signal、过程指标、事件流和过程榜。
* Works：展示全站公开作品列表和单场作品墙；全站目录支持关键字、赛事筛选和每页 9 条分页。
* Work Page：展示作品摘要、Demo、Repo、Rider Profile 回链、Race 回链、公开 Evidence 和 ReviewFlag 摘要。
* Results：展示已发布 Award、最终榜单和公开 race_report。
* Review：展示已发布 review_summary 和公开 Evidence 摘要。
* Rider Directory：`/riders` 只展示有效 Rider 的公开字段，支持按关键字、技能与每页 9 条分页并进入公开主页。
* Rider Profile：展示 Rider 的公开作品、奖项和参赛资产。
* Cooperation：提供 Rider 报名、Organizer 办赛、赞助和合作入口。
* 本地视觉封面：Race、Work、Rider 卡片通过稳定 ID / slug 映射本地原创科技主题 SVG；无匹配项使用类型专属回退图，不新增数据库封面字段。
* Hash 兼容：旧原型 hash 深链会跳转到新的 Next.js 路由。

### Auth / Profile / Roles

* GitHub OAuth 路由：`/api/auth/github` 和 `/api/auth/github/callback`。
* 本地 Debug Login：仅在非 production 且显式设置 `ENABLE_DEBUG_LOGIN=true` 时可用；OAuth 未配置时不会自动登录演示账号。
* 严格 OAuth：回调读取 `/user` 与 `/user/emails`，要求至少一个 GitHub 已验证邮箱；不保存 access token，不创建本地普通登录回退。
* Profile Completion：未补全资料的用户进入 `/profile`，确认展示名、GitHub 已验证联系邮箱、服务条款与隐私政策；GitHub ID、login 和头像不可在表单修改。
* 角色申请：首次在 `/onboarding/role` 选择 Rider、Judge 或 Organizer；三类资料互相独立。Rider 完成资料后立即开通，Judge / Organizer 经 Admin 审核，Admin 不出现在注册入口。
* 服务端会话：`ary_session` 使用随机不透明 token，数据库只保存 SHA-256 hash；每条 AuthSession 独立保存唯一 `activeRole`，`AuthContext.availableRoles` 仅表示可切换资格。
* 角色切换：账号菜单或 `/role-switch` 只更新当前会话；`/console` 分流到四个独立工作台，页面、查询和服务端动作不使用多角色权限并集。
* 全局外壳：公共 Race / Works / Riders / Cooperation 始终使用公共顶栏；登录后仅把 Login 替换为“工作台”和“退出”。资料页、四角色 Console 与专业工具使用角色侧栏，RoleSwitcher 只在工作台显示有效资格；Screen Display 独立输出。

### Console / Domain Actions

* Organizer View：Race 创建/发布、pending 报名审核、参赛选手库、RaceProject 幂等生成、CAConnection 禁用、UTC 提交窗口配置/提前冻结、作品公开、赛事 Judge 池与三人批次分配、评审聚合结果发布、Award 手工发布、Report 生成/失败/编辑/重跑/发布、Projection 重建与失败隔离。
* Rider View：只展示本人个人报名或所在团队的 Race；报名入口位于公开 Race Page 弹窗。赛事空间按队长/队员区分团队管理与 Work 权限，成员各自维护 CAConnection。
* Judge View：查看 assignment 固定的作品版本、commit SHA 和哈希，并提交评分。
* Admin Console：审核 Judge / Organizer 申请，授予 Admin，停用、恢复或撤销单个角色资格；不能操作自己或停用最后一名有效 Admin，也不承载赛事业务入口。
* Screen：`/screen?raceId={raceId}` 控制单场大屏，`/screen/display/{raceId}` 输出该场展示；旧 Display 地址没有默认赛事。四模式共享暗色赛事框架，live 为默认，P0 彩排结束恢复 live；无 Projection 时使用真实静态兜底。
* Ops：P0 回归、发布检查项、灰度/正式发布证据、go/no-go、备份记录和运维入口。

### Data / APIs / Tests

* Production 使用 Prisma + PostgreSQL migration；SQLite 仅用于本地 / E2E。模型包含 UserRole、RoleApplication、三类 RoleProfile、Team、TeamMember、AuthSession、CAIngestionReceipt、WorkSubmissionVersion 和 SubmissionAuditEvent，承接多角色资格、单会话激活角色、团队参赛、可撤销会话、CA 防重放与作品提交完整性。
* Public API 覆盖 races、race detail、live、works、results、review、screen、work detail、rider detail。
* 领域测试覆盖 Race 创建/发布、重复报名、团队创建/加入/报名/共享 CA、RaceProject 幂等、activeRole 权限拒绝、公共资料门禁、角色申请/审核/资格状态、赛事角色冲突、Work 不可变版本/哈希/窗口/冻结/评审绑定、CA 合法/非法/禁用接入、Projection 失败隔离、Screen mode、Report 可见性/失败重跑/编辑发布和 P0 回归。
* Playwright E2E 除全角色 / Public / Screen 外，覆盖角色菜单资格隔离、四类资料页、四角色 Workspace、390px 移动端无横向溢出、OAuth state、随机会话、Public DTO、安全头、Ops 读取隔离、未签名 CA API 拒绝、Race Live 双分辨率，以及 Track Calibrator 权限、工作台、Draft 与发布检查。

真实赛事部署、安全配置和 go-live 硬门禁见 `../docs/ary-production-security-baseline.md`。生产启动会先运行 `npm run check:production-config`，数据库迁移使用 `npm run prisma:migrate:deploy`。

根目录旧 `app/` 静态 MVP 已删除；`design-prototype/` 保留为历史原型与视觉迁移来源。
# Race Live 本地验收

1. 在 `web` 执行 `npm.cmd run test:e2e:prepare`，再执行 `npm.cmd run dev -- --port 3000`。
2. 打开 `http://127.0.0.1:3000/api/debug/login?user=organizer`，从 Organizer Race Workspace 进入 `/screen?raceId={raceId}`；缺少 `raceId` 时不得自动选择默认赛事。
3. 从当前 Screen Console 打开 `/screen/display/{raceId}`：应看到该 Race 的 TOP3、Round 和当前 DisplayGroup（每组最多 8 名 Racer）；旧 `/screen/display` 只提示未指定赛事。
4. Organizer 只能控制自己管理的 Race；Admin 激活状态不复用赛事控制入口。所有成功操作追加 `ScreenControlAuditEvent`。
5. fallback 是独立开关，不再是 Display Mode；开启后仅当前 `/screen/display/{raceId}` 使用该 Race 的稳定 Projection/公告降级。

GRS003 是唯一事实源。GRS002 只提供迁入的 Track Profile、几何 Runtime 和视觉实现，不存在运行时数据依赖。Coach/Cockpit 不属于 ARY。

# Track Calibrator 本地验收

1. 初始化并启动：`npm.cmd run test:e2e:prepare`，然后 `npm.cmd run dev -- --port 3000`。
2. 打开 `http://127.0.0.1:3000/api/debug/login?user=organizer`，再访问 `http://127.0.0.1:3000/console/tracks/calibrator?raceId=race_bay_2026`。
3. 修改 trackId/名称/版本或点击中心线画布，点击“保存到浏览器”；刷新后应显示“已恢复浏览器本地 Draft”，编辑值和背景仍存在。
4. Runtime Preview 可切换 1/4/8 Racer、均匀/密集/起点集群/终点冲刺场景和进度；编辑后 Validation 回到 dirty，点击“运行校验”后显示 ready 或定位具体错误。
5. 自动校验 ready 后逐项完成 8 项人工核验，才可点击“发布不可变版本”；成功后 Draft 仍保留，版本历史显示 hash、引用状态和可执行的归档/删除操作。
6. 只有 pending Round 可绑定 published system Track 或本 Race Track；running/finished Round、其他 Race 私有 Track、draft/archived 版本均拒绝。任何被 Round 引用的版本都不能归档或删除。

浏览器 IndexedDB 只是未发布创作状态，清除站点数据会丢失未导出的 Draft。ARY 的事实源是服务端 TrackProfileVersion 与 `backgroundAssetRef`。production 必须把 `TRACK_ASSET_ROOT` 配到源码目录外的持久、可写目录。

## Race Live Web 操作

1. 以 Organizer 进入 `/console/organizer/races/{raceId}`，再打开带同一 `raceId` 的 Screen Console。
2. 在“大屏准备”中查看候选 Round、Track、active Entry 和稳定 Projection；缺少 Round 时在高级配置创建，随后绑定已发布 Track 并同步 approved Registration。
3. pending Round 需勾选确认后点击“准备 Race Live”；running Round 可直接准备。成功后 ScreenState 切换到该 Round、稳定 `ary_race_live` Projection 和 `live`。
4. “刷新 Race Live”只重建 Race Live 展示；原“重建 Projection”继续服务普通 `race_progress`，两者不可混用。
5. 打开 `/screen/display/{raceId}` 后无需刷新页面；它每 3 秒同步静态/Live、Projection、模式、分组和公告。CA 信号、风险和 Round 状态变化会触发 running Round 的 Race Live 刷新。

本轮 Race Live 接入的静态检查、typecheck、领域测试、production build 和定向 Screen/Organizer/Security E2E 均通过。唯一一次完整 E2E 为 56/57；服务接近内存阈值重启时有一个 Debug Rider 登录跳转用例短暂停在 `/console`，该失败用例定向复跑 1/1 通过，未重复完整 E2E。自动化验证只使用 `e2e.db`；其后对开发库执行了一次受控、非破坏性修复：恢复 Metro Raceway 明显不一致的已发布状态，并通过 Screen Console 为“湾区开心游”生成正式 Round 的新稳定 Projection，未删除旧数据。

## 赛题 PDF 与作品外部内容安全

- Organizer 创建 Race 或进入 Race Workspace 后可上传单个不超过 10 MiB 的 PDF。ARY 只在内存中完成结构检查和 ClamAV 扫描，扫描通过后转存至该 Organizer 自有的 S3/R2/OSS；生产环境不允许平台本地附件存储。
- 开发环境使用 `ATTACHMENT_STORAGE_DRIVER=memory`，文件仅存在于当前服务进程并在重启后消失。生产配置必须使用 `ATTACHMENT_STORAGE_DRIVER=organizer-s3`，并通过 Secret Manager 提供 `ORGANIZER_ATTACHMENT_STORES_JSON` 与 ClamAV 参数。
- Rider 下载先经过 ARY 资格校验，再获得最长 300 秒的对象存储签名地址。ARY 不代理长期文件副本。
- 旧 `platform_legacy` 文件先运行 `npm run attachments:migrate-to-organizer` 预检；配置外部存储后再追加 `-- --execute`。脚本仅在源/目标 SHA-256 一致且数据库指针完成切换后删除平台本地副本。
- Work 仍只提交 Repo、Commit 和 Demo URL。新提交必须由 GitHub App 验证仓库与 Commit；Demo 统一经过站内安全提示页。ARY 不 clone、构建或运行用户仓库。
- 已有 SQLite 开发库只运行 `python scripts/migrate-sqlite-race-problem-security.py` 做增量增列/增表；不得用 `db:init` 代替迁移。production 使用 `npm run prisma:migrate:deploy`。

## Registration 审核与三 Judge 本地验证

- 赛题管理已经是与 ARY 工作台一致的蓝白双栏界面：支持拖拽/选择、真实 XHR 上传进度、扫描中状态、受控安全原因、重试/重新选择和版本历史；失败不会覆盖最后一个安全修订。
- Organizer Race Workspace 只显示 pending Registration；通过后从队列移入受权参与者库，拒绝必须填写原因。参与者库是状态读取视图，不复制数据。
- 提交窗口关闭后，Organizer 维护赛事级 Judge 池并执行原子批量分配。每件版本化 Work 必须占用 slot 1–3 且对应三个不同 Judge；已有合法 Assignment 保留并补足。
- 三份评分全部提交后才计算 `avgResult`、`avgRiding` 与 overall；Organizer 发布聚合结果后 Rider 才可见，发布同时锁定 Judge 池、Assignment 与 JudgingRecord。Award 仍由 Organizer 手工发布。
- 四角色工作台及 Risk、Screen、Track、Ops 的状态动作使用 pending、实体迁移和上下文结果面板；反馈组件不替代服务端鉴权。
- 隔离领域验证可运行：

```bash
node --import tsx tests/domain.test.ts
node --import tsx tests/work-submission-domain.test.ts
node --import tsx tests/judge-allocation-domain.test.ts
```

- migration 必须按 `20260717_01_race_problem_and_repo_verification`、`20260717_02_organizer_owned_problem_storage`、`20260717_03_judge_pool_and_review_workflow` 顺序应用。第三步发现任一 Work 已超过三条 Assignment 时主动中止。
- SQLite 只能先复制到隔离文件，再设置明确的 `DATABASE_URL=file:...` 并运行 `npm run db:migrate:judge-workflow:sqlite`；helper 会拒绝直接迁移 `prisma/dev.db`。PostgreSQL 仍须在全新库和带历史基线库分别执行 `npm run prisma:migrate:deploy`，当前 Docker daemon 与 `psql` 不可用，尚无运行时迁移证据。
- 禁止为验证本功能初始化、清空或迁移 `prisma/dev.db`；SQLite 检查必须指向唯一的临时隔离文件。
- 本轮 Prisma generate/schema validate、`check:quick`、完整 `npm test` 和唯一一次 production build 通过。唯一一次完整 Playwright E2E 为 58/62；修复后只复跑失败的 4 项并取得 4/4，不能写成完整 62/62。1280/1440/1920/390 视口基线通过，验证前后 `dev.db` SHA-256 一致。
- 赛题附件生产链路仍依赖 Organizer 自有对象存储和真实 ClamAV。现有 `platform_legacy` 对象在完成 SHA-256 核验迁移前仍是遗留风险，不能据此宣称平台已不持有长期副本。
- Next 开发服务退出时仍可能输出 `controller[kState].transformAlgorithm` 告警；它目前作为运行时稳定性跟踪风险，尚未被本轮定向 4/4 证明消除。
