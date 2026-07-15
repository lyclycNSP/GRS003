# PROGRESS

## 2026-07-14 Racer 作品提交完整性基线

- 问题：既有 CA attestation 只保护实时骑行证据，Work 仍是可变投影，缺少明确提交窗口、不可变版本、代码 commit 身份、冻结后评审绑定和提交审计；CA 安全不能证明 Racer 作品提交链安全。
- 解决方式：新增 WorkSubmissionVersion 和 SubmissionAuditEvent；在 Serializable 事务中校验本人/报名/窗口、递增版本、计算 `ary.work-submission.v1` canonical SHA-256、更新 Work 投影并追加审计；补全 Organizer 全场冻结、Admin 受限重开、Judge/Award/Public 固定版本、legacy 兼容、Console 页面和领域/Playwright 回归。
- 后续避免：任何评审、作品公开或关联作品 Award 都必须先确认窗口已冻结且存在真实版本；CA 证据链、作品提交链、仓库内容安全分别验收。新增 URL 类型需补 loopback、私网、保留地址、编码分隔符和跨角色 Server Action 负向测试。
- 验证限制：本地静态、37 条领域/契约测试、TypeScript、production build、Playwright 14/14、独立 SQLite 初始化/Seed 和 production config preflight 已通过；本机无可用 Docker/PostgreSQL，`prisma migrate deploy` 待一次性数据库环境补验。
- git commit ID：`4ea4bab`。

## 2026-07-13 SQLite Prisma Client 生成脚本 Windows 兼容修正

- 问题：安全基线分支中的 `generate-sqlite-client.mjs` 通过 `execFileSync("npx", ...)` 生成本地 SQLite Client；该写法在 Windows 找不到无扩展名的 `npx`，改用 `npx.cmd` 后又因 Node 24 不能直接 `execFileSync` 批处理文件而返回 `EINVAL`。
- 解决方式：不再依赖 shell shim，改为使用 `process.execPath` 执行项目本地 `node_modules/prisma/build/index.js`，同时在静态烟测中增加跨平台命令入口约束。
- 后续避免：跨平台 Node 脚本调用项目 CLI 时优先执行依赖的 JS 入口；不要假设 `npx`、`npm` 或 `.cmd` 能被 `execFileSync` 在所有平台直接解析。
- git commit ID：`91d963a`。

## 2026-06-21 全站前端页面视觉审计

- 问题：多处从高保真静态布局迁入的页面在移动端仍带有旧的横向尺寸假设，`body` 后续样式覆盖了 `overflow-x: hidden`，导致 Race、Live Hall、Rider、Console 等页面在窄屏出现横向空白、卡片窄列和文字拥挤。
- 解决方式：用 Playwright CLI 批量截取 17 个页面的桌面/移动视口，并补充 Organizer/Rider/Judge/Admin 四个 Console 移动视口；恢复全局横向裁剪，补齐 Route Page 下 Race、Live、Rider、Right Dashboard、Profile Card、Leaderboard/Event Stream 的响应式栅格和卡片密度规则。
- 后续避免：新增页面或迁移旧原型时，至少跑一次 1365x768 与 390x844 截图；移动全页截图宽度若超过 430px，应先查全局横向溢出而不是只调局部卡片。
- git commit ID：未提交。

## 2026-06-21 Work Detail 页面按钮与排版修正

- 问题：`/works/adaptive-bay-route-agent` 顶部操作入口使用默认文本链接，缺少返回 Works 入口；旧定位残留导致按钮与作品卡片重叠，移动端证据卡与作品卡横向拥挤。
- 解决方式：为作品详情页补充 `返回 Works` 按钮，给详情页添加作用域样式，统一链接按钮、标题、卡片字号和长 URL 换行；清除旧 hero 定位残留，并补充窄屏单列布局。
- 后续避免：详情页这类从静态高保真迁移来的页面，新增内容后必须用桌面和移动 Playwright 截图复查旧绝对定位是否仍在影响文档流。
- git commit ID：未提交。

## 2026-06-20 根目录旧 app 清理

- 问题：根目录旧 `app/` 静态 MVP 与当前正式集成应用 `web/` 并存，容易让开发者误判当前入口。
- 解决方式：删除根目录旧 `app/`，并将 README、PLAN、STATUS 和相关 docs 的当前实现/测试入口改为 `web/`；历史交付文档保留旧 app 语义但标注为已删除的历史记录。
- 后续避免：新增或迁移工程入口时，同步更新 `docs/README.md`、根 README、PLAN、STATUS 和对应交付文档，避免保留会被误执行的旧路径。
- git commit ID：未提交。
# 2026-07-14 Race Live Integration

- 问题：GRS002 工作树的 packages 已删除；迁移必须避免覆盖用户改动。解决：只从 GRS002 Git HEAD 读取受控源文件和二进制资产，并校验 WebP SHA-256。
- 问题：旧 Screen 将 fallback 混作 mode。解决：fallback 改为独立布尔状态，mode 仅保留 live/leaderboard/works/announcement。
- 问题：公共 Race API 复用了内部 Projection 对象。解决：API 路由显式剥离 Projection/ScreenState；Race Live 使用专用 Zod DTO 查询。
- 避免复发：新增严格 `.strict()` 快照契约、敏感字段负向测试、两尺寸 Race Live E2E、Screen 控制权限与审计测试。
- Git commit：`87b3e30`。

## 2026-07-14 Race Live 与 Track Calibrator 迁入

* 问题：GRS002 的大屏和赛道标定原为独立服务，Coach/Cockpit 语义与 ARY 领域边界混杂；大屏还需要同一 Round 分组轮播、控制审计和公开 DTO 边界。
* 解决：将 TrackProfile/Runtime、Race Live Projection/Screen Control 和 Track Calibrator 迁入 GRS003 Next.js；Coach/Cockpit 排除在 ARY 外。Calibrator Draft/背景只保存在浏览器 IndexedDB，服务端发布重新做权限、MIME/尺寸、SHA-256、几何和幂等校验，形成不可变 TrackProfileVersion，并允许 pending Round 显式绑定。
* 避免复发：公开 Screen 只返回 allowlist DTO；Projection 只接收当前 Race 的 approved Entry；未知 ReviewFlag 不公开；发布资产路径只使用服务端生成 key；production 强制配置源码目录外可写的 TRACK_ASSET_ROOT。
* 验证：`check:static`、完整 `npm test`、TypeScript、PostgreSQL Client 生成、production build、production config preflight、Playwright 18/18 和 `git diff --check` 均通过；一次性 PostgreSQL 16 全新库 5 个 migration 全部 deploy 成功，模拟已有 Race Live 基线后重新应用 Track publish migration 也成功并确认 5 个新增列。
* git commit ID：`87b3e30`。

## 2026-07-15 xst 风险评审中心并入

* 问题：`origin/xst` 基于较早主线开发，和作品不可变版本、团队参赛、Race Live / Track Calibrator 在 Console、领域动作、查询和 Prisma schema 上产生冲突；原分支还缺少 PostgreSQL migration，且 Rider 页面顶部会从整场 `allFlags` 泄露其他参赛者的风险统计与焦点。
* 解决：保留现有提交完整性和团队语义，接入 Organizer 处置、Rider 整改、Judge 只读上下文；有效 CA 信号在同一事务中关闭对应接入风险；新增向后兼容的 `20260715_risk_review_center` migration，并在 Query 与页面聚合两层限制非管理角色只能看到自身或已分配作品风险。
* 避免复发：跨分支合并 ReviewFlag 时同时检查角色可见集合、顶部派生统计和数据库 migration，不能只检查处置卡片是否按角色隐藏。
* 验证：静态检查、Prisma schema、完整领域/契约测试、TypeScript、production config/build、Playwright 18/18、一次性 PostgreSQL 16 migration deploy 均通过；Rider/Judge 的 `allFlags` 负向测试完成红绿验证。
* git commit ID：未提交。
