# ARY GRS003 Riding Record: Vibe Coding 与 Harness Engineering 过程记录

> 文档类型：Riding Record / Vibe Coding & Harness Engineering Log  
> 记录时间：2026-06-21  
> 项目：ARY_GRS / GRS003  
> 协作对象：用户 + Codex  
> 记录范围：本轮对话中从项目梳理、角色数据流审计、调试能力修正、页面 UI 审计到全站前端修复的完整协作过程。  
> 隐私处理：不记录任何 OAuth secret、cookie、token、临时授权 code 或本地个人敏感信息。  
> commit ID：未提交。

---

## 0. 一句话总结

本轮协作由用户持续以产品体验、角色流和调试需求发起指挥，Codex 负责阅读仓库文档、梳理开发进度、制定并执行修正计划、用 Playwright 做浏览器审计、把发现转成代码和文档更新；最终把 `web/` Next.js 应用的多角色调试、Race-scoped 数据流、Screen/Console 权限、Work 公开边界、页面按钮与全站响应式问题收口到可本地演示和可回归验证的状态。

这轮过程体现了两类工程实践：

* **Vibe Coding**：用户通过截图、页面观感、角色操作感受和“这个地方不清晰/不协调/不方便调试”的直觉反馈来驱动实现迭代。
* **Harness Engineering**：Codex 将这些直觉反馈转化为可执行 harness，包括 debug login、seed 数据、角色流 Playwright 验证、静态 smoke、领域测试、TypeScript 检查、截图审计和文档证据。

---

## 1. 起点：先理解项目和文档

### 用户指令

用户先要求：

* 阅读项目和文档，梳理开发进度。
* 确认 DEV-5 的 CA 接入文档是否规定了信息架构、CA 对象结构等内容。
* 梳理各个角色功能完成情况。
* 解释为什么 GitHub 登录后只能以 Rider 身份操作，以及如何作为 Organizer、Admin、Judge 调试。

### Codex 执行动作

Codex 读取并对齐了这些入口：

* `PLAN.md`
* `STATUS.md`
* `docs/README.md`
* `docs/ary.plan.md`
* `docs/ary-ca-integration-spec.md`
* `docs/ary-dev-1-dev-3-delivery.md`
* `docs/ary-dev-4-to-ops-delivery.md`
* `web/` 下 Next.js、Prisma、Server Actions、domain test 和 seed 数据。

### 关键判断

Codex 给出的阶段性结论是：

* 当前正式工程入口应以 `web/` 为准。
* 旧根目录 `app/` 是历史本地 MVP，后续不应再作为当前开发入口。
* DEV-4 到 DEV-7、REL-1、OPS-1 的本地闭环已迁入 `web/`。
* CA 接入已在文档中定义了 CAConnection、attestation、信号接入、Projection 输入、ReviewFlag 和失败隔离等语义，但真实生产 CAConnector 仍需后续工程化。
* 默认 GitHub 登录只暴露 Rider 操作，是因为本地调试缺少稳定的角色切换入口；应补 Debug Login harness。

### 产物

这一阶段形成了后续修正方向：

* 以 `web/` 为当前应用入口。
* 加 Debug Login 角色隔离。
* 用 Playwright 走查 Rider / Organizer / Judge / Admin 数据流。
* 把发现写入计划后再执行。

---

## 2. 第一轮 Harness：调试各角色功能

### 用户指令

用户要求：

* “帮我配置，让我能够调试各个角色的功能。”
* 随后确认可以继续执行。
* 在浏览器打开 `/debug-login` 后询问 DEV-6 功能是否做了。
* 指出 Console 没有 Screen 的入口，要求修改。

### Codex 执行动作

Codex 在 `web/` 中补齐调试 harness：

* 新增 `/debug-login` 页面。
* 新增 debug login API。
* 按角色写入调试 cookie。
* 让 Organizer / Admin / Judge / Rider 能以不同 seed 用户和不同角色覆盖进入 Console。
* 给 Console 增加 Screen Console 入口。
* 保留后端权限校验，避免只靠前端隐藏入口。

### 关键设计

调试入口设计为本地可用、生产关闭：

* `ENABLE_DEBUG_LOGIN=true` 且非生产环境时生效。
* Rider 使用 `user_rider_1`，只暴露 `rider`。
* Judge 使用 `user_judge_1`，只暴露 `judge`。
* Organizer 使用 `user_org_1`，只暴露 `organizer`。
* Admin 使用 `user_org_1`，只暴露 `admin`。
* 每次 debug 登录覆盖旧角色，避免多角色串扰。

### 产物

相关文件包括：

* `web/app/debug-login/page.tsx`
* `web/app/api/debug/login/route.ts`
* `web/lib/auth.ts`
* `web/app/console/page.tsx`
* `web/app/screen/page.tsx`

---

## 3. 第二轮 Harness：角色数据流审计

### 用户指令

用户追问现有数据流：

* 作品提交后是否到 Organizer 处，由 Organizer 分配给 Judge？
* Judge 评审完是否给回 Organizer？
* Organizer 是否判断公开哪些？
* 榜单在哪里发布？

随后用户要求：

* “你用 Playwright 试一下每个角色的数据流和操作逻辑是否符合文档，将问题记录下来。”
* “将以上需要调整内容写进计划。”
* 然后明确要求执行计划。

### Codex 审计结论

Playwright 角色流审计发现的问题被整理为计划：

* Console 未完全 Race-scoped，可能跨 Race 混用 registration、work、assignment、award。
* Award 可以出现跨 Race 数据完整性问题。
* 非公开 Work detail 有公开泄露风险。
* Rider / Judge 不应看到 Screen 控制台控制入口。
* Judge 提交评分后反馈不足。
* Debug Login 角色隔离不足。

### 用户批准执行的计划

用户粘贴并批准了《角色数据流与调试能力修正计划》，核心调整包括：

* Console 改为 Race-scoped。
* 修复 Award 跨 Race 数据完整性。
* 修复非公开 Work 详情泄露。
* Screen Console 权限与入口收口。
* Judge 提交反馈。
* Debug Login 角色隔离。
* 添加相关领域测试、静态 smoke 和 Playwright 验证。

### Codex 实施结果

Codex 完成了：

* `getConsoleSnapshotForUser(userId, raceId?)` 以当前 Race 为上下文。
* `/console` 支持主活动 Race 和 `?raceId=` 切换。
* Rider 报名和 Work 提交只使用当前 Race registration。
* Judge 只看到当前 Race assignments。
* Organizer/Admin 只在当前 Race 下管理 submissions、assignments、awards、screen。
* `publishAward()` 校验 registration 与 work 是否属于目标 race。
* Public Work detail 只返回 `visibility=public` 且 `status=published` 的作品。
* Results 只在关联 Work 公开且已发布时展示资产链接。
* Rider/Judge 直接访问 `/screen` 不显示控制表单。
* Judge 提交后展示保存状态、judging record、assignment 状态和提交时间。

### 验证

这一阶段使用了：

* `npm run check:static`
* `npm test`
* `npx tsc --noEmit`
* Playwright 角色流手动走查

领域测试覆盖了：

* Award 拒绝跨 Race registration。
* Award 拒绝不属于 registration 的 work。
* Console snapshot 只返回当前 Race 的 registration 和 judge assignments。
* Public Results 不链接非公开 Work。
* Public Work detail 不展示非公开作品。

---

## 4. 第三轮：目录清理与文档改写

### 用户指令

用户询问：

* 根目录下 `app/` 文件夹有什么用，没有用是否可以删除。

随后用户确认：

* “删除，并改写文档。”

### Codex 判断

Codex 判断：

* 根目录旧 `app/` 是历史本地 MVP。
* 当前正式集成应用为 `web/`。
* 保留旧 `app/` 会误导后续开发者和 agent。

### Codex 执行动作

Codex 删除旧 `app/` 并同步文档：

* 删除 `app/README.md`
* 删除 `app/app.js`
* 删除 `app/domain.js`
* 删除 `app/domain.test.js`
* 删除 `app/index.html`
* 删除 `app/layout-check.js`
* 删除 `app/styles.css`

同步更新：

* `README.md`
* `PLAN.md`
* `STATUS.md`
* `docs/README.md`
* 多个 DEV / QA / OPS 相关文档
* `PROGRESS.md`

### 工程意义

这是一次 harness 边界收口：

* 降低入口歧义。
* 让后续验证和运行命令集中到 `web/`。
* 避免历史 MVP 与正式集成应用同时被误认为当前入口。

---

## 5. 第四轮：UI 视觉与响应式 Vibe Coding

### 用户反馈方式

用户通过截图连续指出具体体验问题：

* Header 导航文字、Login / Workspace 链接简陋。
* Race Page、Works、Results 的按钮像默认链接。
* Debug Login 大标题遮挡角色卡片，影响分角色调试。
* Console 功能区之间缝隙太小。
* 首页卡片之间间隙和字体不协调。
* 中文和英文混排时字距过大。
* Rider View 中 approved / connected / submitted 状态按钮过大。
* CA 部分不清楚填什么，输入框大小不一致，功能不明确。
* Race 管理缺少“赛事名”小标题和必填标记。
* 发布报告处按钮堆积，不知道字段用途。
* Work Detail 页面缺少按钮，字体显示需要调整。
* 最后要求用同样方式检查所有前端页面，调整大小、排布和文字问题。

### Codex 的处理方式

Codex 没有把这些反馈当作单点样式补丁，而是转成多轮浏览器审计：

1. 使用 Playwright 打开实际页面。
2. 截图桌面与移动视口。
3. 对比用户截图和当前页面。
4. 修改 CSS 和少量 JSX。
5. 复跑截图确认。
6. 跑静态 smoke、TypeScript 和领域测试。

### 关键 UI 修复

#### Debug Login

* 大标题不再覆盖角色卡。
* 角色卡片使用一致的按钮样式。
* Organizer / Admin / Rider / Judge 入口更清晰。

#### 首页 / Works / Race Cards

* Race Page / Works / Results 链接改为统一胶囊按钮。
* 卡片间距增大，避免多个功能区贴在一起。
* 字体从过宽字距调整为更紧凑的 Arial + 中文字体组合。
* 中英文混排减少 letter-spacing。

#### Console

* 功能区 gap 增大。
* Organizer 报名审核、CAConnection 状态、Report 发布区分组更清晰。
* Race 管理表单增加字段 label、必填 `*` 和 hint。
* Report / Award / Projection 操作拆成更清晰的步骤卡。
* Rider CA Signal 和 Work Submit 表单统一输入尺寸，并解释字段用途。
* Rider 状态 pill 从巨大状态块改成更克制的状态标识。

#### Work Detail

用户指定页面：

```text
http://127.0.0.1:3001/works/adaptive-bay-route-agent
```

Codex 修复：

* 补充 `返回 Works` 按钮。
* 将 `打开 Demo`、`查看 Repo`、`Rider Profile`、`Race Page`、`返回 Works` 统一为按钮组。
* 为 `page-work-detail` 添加作用域样式。
* 修复旧定位残留导致按钮和卡片重叠。
* 调整标题、卡片、Evidence 面板、长 URL 换行。
* 补充移动端单列布局。

#### 全站前端审计

用户最后要求：

* “用同样的方式检查一遍所有前端页面，调整大小、排布有问题的组件、文字等内容。”

Codex 覆盖页面：

* `/`
* `/works`
* `/works/adaptive-bay-route-agent`
* `/works/work-localjoy/judge`
* `/races/bay-area-happy-trip`
* `/races/bay-area-happy-trip/live`
* `/races/bay-area-happy-trip/works`
* `/races/genesis-dogfood-race/results`
* `/races/bay-area-happy-trip/review`
* `/riders/mira-chen`
* `/cooperation`
* `/profile`
* `/console`
* `/debug-login`
* `/screen`
* `/screen/display`
* `/ops`

并额外覆盖：

* Organizer Console
* Rider Console
* Judge Console
* Admin Console

### 全站审计发现与修复

主要问题：

* 多个页面仍残留旧静态高保真原型的横向尺寸假设。
* `body { overflow: auto; }` 覆盖了早期 `overflow-x: hidden`，导致移动端截图出现横向空白。
* Race、Live Hall、Rider、Console 等移动端卡片出现窄列、空白过大或文字拥挤。

修复：

* 恢复全局横向裁剪。
* `deck-shell` 改为横向 clip、纵向 visible。
* Route Page 下 Race、Live、Rider、Right Dashboard、Profile Card、Leaderboard、Event Stream 加响应式规则。
* 移动端 Race state、Live metrics、Event stream、Profile layout 改为单列。
* 入口链接统一为按钮风格。

### 验证

全站 UI 审计阶段执行：

* 17 个页面桌面截图。
* 17 个页面移动截图。
* 4 个角色 Console 移动截图。
* 移动截图宽度校验：所有页面截图宽度为 390，无横向溢出。
* `npm run check:static`：通过。
* `npx tsc --noEmit`：通过。
* `npm test`：20 个领域测试全部 PASS。

---

## 6. Harness Engineering 视角复盘

### 6.1 用户做的 Harness 指挥

用户没有只要求“改好看一点”，而是持续把体验反馈转成可验证任务：

| 用户动作 | Harness 意义 |
| --- | --- |
| 要求阅读项目和文档 | 建立任务边界，避免盲改 |
| 追问 DEV-5 / DEV-6 是否完成 | 对照计划与实现，不让文档和代码漂移 |
| 要求配置多角色调试 | 建立可复现角色 harness |
| 要求 Playwright 走每个角色数据流 | 将产品流程变成浏览器验收 |
| 要求把问题写进计划再执行 | 先审计、再规划、再实现 |
| 通过截图指出 UI 问题 | 用真实视觉反馈驱动迭代 |
| 要求全站同样方式检查 | 把局部修复升级为系统审计 |

### 6.2 Codex 提供的 Harness

Codex 提供的工程支架包括：

* Debug Login 角色隔离。
* Seed 数据与角色用户绑定。
* Race-scoped Console snapshot。
* Domain tests。
* Static smoke。
* TypeScript check。
* Playwright CLI 截图审计。
* 移动截图宽度校验。
* `STATUS.md` / `PROGRESS.md` 记录。

### 6.3 关键工程判断

本轮有几个关键判断：

1. **先统一入口，再继续开发**  
   删除旧 `app/`，避免 agent 和开发者误跑历史 MVP。

2. **调试入口要角色隔离**  
   Organizer/Admin 使用同一 seed 用户也必须只暴露当前调试角色，否则权限问题会被多角色串扰掩盖。

3. **数据流必须 Race-scoped**  
   Console、Award、Assignment、Public Results 都必须以当前 Race 为边界，否则演示时会出现跨赛事污染。

4. **UI 问题要用截图验证**  
   单看 CSS diff 不足以确认效果；必须用桌面和移动真实截图复查。

5. **移动端横向空白先查全局 overflow**  
   不应只调单个卡片，移动全页截图宽度异常通常说明全局布局或旧绝对定位仍在影响文档流。

---

## 7. Vibe Coding 视角复盘

### 7.1 用户提供的 Vibe 信号

用户通过自然语言和截图提供了高密度的体验信号：

* “按钮看起来有点简陋。”
* “debug login 的字体挡住了我分角色进入调试。”
* “两个功能区之间缝隙很小。”
* “首页的间隙也需要调整。”
* “一些区块内的各部分字体不是很和谐，尤其是中英文同时出现。”
* “approved 这些按钮太大。”
* “CA 部分填什么内容不清晰，功能不明确，输入框大小不一致，且挤在一起。”
* “发布报告处按钮堆积，也不知道每个字段要填什么。”
* “这个页面补充按钮，调整字体显示。”
* “用同样的方式检查一遍所有前端页面。”

这些不是传统 issue 模板，但它们精确指出了用户在真实使用中的摩擦点。

### 7.2 Codex 对 Vibe 的工程化翻译

| Vibe 反馈 | 工程翻译 |
| --- | --- |
| 简陋 | 链接缺少组件化按钮样式 |
| 挡住 | 标题层级和文档流定位错误 |
| 缝隙小 | section/card gap 不足 |
| 字体不和谐 | letter-spacing、font-family、line-height 不适合中英文混排 |
| 状态按钮过大 | status pill 与 card body 层级混淆 |
| 不知道填什么 | form label、hint、必填标记和分组缺失 |
| 页面挤 | grid minmax、移动端单列、overflow 控制不足 |
| 全站检查 | 需要批量截图审计，而不是单页补丁 |

### 7.3 最终形成的协作模式

这轮形成了一个稳定循环：

```text
用户截图/体验反馈
  -> Codex 定位页面和执行路径
  -> Playwright 截图复现
  -> CSS/JSX/领域逻辑小步修改
  -> Playwright 复查
  -> static smoke / tsc / npm test
  -> STATUS / PROGRESS 记录
```

---

## 8. 最终产物索引

### 代码与应用

* `web/app/debug-login/page.tsx`
* `web/app/api/debug/login/route.ts`
* `web/app/console/page.tsx`
* `web/app/screen/page.tsx`
* `web/app/works/[slug]/page.tsx`
* `web/app/works/[slug]/judge/page.tsx`
* `web/app/globals.css`
* `web/lib/auth.ts`
* `web/lib/domain.ts`
* `web/lib/queries.ts`
* `web/prisma/seed.ts`
* `web/tests/domain.test.ts`
* `web/scripts/static-smoke.mjs`

### 文档与记录

* `PLAN.md`
* `STATUS.md`
* `PROGRESS.md`
* `docs/README.md`
* `docs/ary-role-flow-playwright-audit.md`
* `docs/ary-ca-integration-spec.md`
* `docs/ary-dev-4-to-ops-delivery.md`
* `docs/ary-release-ops-plan.md`
* `docs/ary-web-next-step-checklist.md`

### 删除的历史入口

* 根目录旧 `app/` 本地 MVP 已删除。
* 当前正式开发和调试入口为 `web/`。

---

## 9. 验证记录

本轮多次使用以下检查：

```powershell
cd web
npm run check:static
npx tsc --noEmit
npm test
```

最后一次全站 UI 审计后结果：

* `npm run check:static`：通过，检查 17 个 route pages 和 14 个 API routes。
* `npx tsc --noEmit`：通过。
* `npm test`：通过，20 个领域测试全部 PASS。
* Playwright：17 个页面桌面/移动截图完成。
* Playwright：4 个角色 Console 移动截图完成。
* 移动宽度校验：所有页面截图宽度为 390，无横向溢出。

---

## 10. 后续建议

1. 将 Playwright 页面截图审计固化为脚本，至少覆盖 1365x768 和 390x844。
2. 将 Debug Login 继续保持为本地-only harness，生产环境必须关闭。
3. 将真实 GitHub OAuth、真实 CAConnector、生产部署流水线作为下一阶段工程化重点。
4. 为 Rider / Organizer / Judge / Admin 的核心流增加可重复 E2E，而不是只依赖人工 Playwright 操作。
5. 对 `web/app/globals.css` 做一次后续结构整理，把静态原型遗留样式、Next 集成修正和页面族样式分层，降低后续 UI 修改风险。

