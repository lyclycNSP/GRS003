# GRS002 大屏与 Track Calibrator 保真迁移设计

## 1. 背景与问题

GRS003 已接入 GRS002 的 Track Profile、Track Runtime、Race Live Projection、分组轮播、Screen Control、浏览器 IndexedDB Draft 和服务端不可变 TrackProfileVersion 发布链路，但当前交付只覆盖能力与安全基线，没有完成 GRS002 页面和交互的保真迁移。

现状存在三类缺口：

1. `/screen/display` 继承 ARY 网站导航，内容超出单个 16:9 视口，不能直接作为现场投屏页面；
2. Race Live 缺少 GRS002 的赛事头部、完整 TOP3/KPI、小地图、真实马匹资产、消息气泡、风险 Ticker 和现场页脚；
3. Track Calibrator 路由虽存在，但主 Console 没有入口，且工具只实现基础画布、元数据、固定八马预览、自动校验、本地 Draft 和服务端发布，未达到 GRS002 工作台能力。

本设计把“技术基线已迁入”和“页面/交互保真迁移完成”分开。实施完成前，`RACE-LIVE-1` 和 `TRACK-CAL-1` 不应继续被描述为完整页面迁移完成。

## 2. 目标

### 2.1 Race Live

* 保留 GRS002 的 16:9 构图、信息密度、现场可读性和赛事氛围；
* 品牌统一为 `Agent Racing Yard`，不保留 `DevCompass Racing` 品牌；
* 页面不包含 Public Site 全局导航，不产生横向或纵向滚动；
* 同一 Round 中按每组最多 8 名 Racer 自动轮播；
* 主赛道和 Mini Map 使用同一个 Track Runtime；
* 数据只读取 GRS003 的公开 Screen DTO，不恢复 GRS002 mock 数据源。

### 2.2 Track Calibrator

* 在 Organizer/Admin Console 中提供明确的 Track Management 和 Track Calibrator 入口；
* 恢复 GRS002 的中心线、方向、起终点、Lane、Checkpoint、Message Zone、No-bubble Zone 编辑能力；
* 恢复预览控制、自动校验、人工视觉确认和版本目录；
* 保持“浏览器本地 Draft + 服务端不可变发布”；
* 继续使用 GRS003 的授权、checksum、幂等发布和内容寻址背景资产边界。

## 3. 非目标

* 不恢复 GRS002 的独立 Vite 服务；
* 不引入 GRS002 mock racing data 作为运行时数据源；
* 不引入 Coach/Cockpit 角色、状态或页面；
* 不增加运行中 Round 的赛道热更新；
* 不改变 CA ingestion、作品提交完整性或 Judge/Award 链路；
* 不以重写 GRS003 服务端领域模型换取视觉保真。

## 4. 总体方案

采用“迁移 GRS002 展示与交互层，保留 GRS003 事实源与安全边界”的方式。

```text
GRS002 展示/交互来源
├── Race Live 构图、组件、样式和视觉资产
└── Track Calibrator 编辑、预览、校验和版本管理交互
                 │
                 ▼
GRS003 Next.js 集成应用
├── Public Screen DTO / RaceLiveSnapshot
├── ScreenState / 自动轮播 / 稳定 Projection
├── TrackProfileVersion / Track Runtime
├── IndexedDB CalibratorDraft
├── Server Actions / Organizer 与 Admin 权限
└── checksum / 幂等发布 / 内容寻址资产
```

不得建立 GRS003 对 GRS002 运行中服务或目录的依赖。需要的组件、样式和资产应迁入 `web/` 并适配现有类型和应用边界。

## 5. Race Live 页面设计

### 5.1 页面边界

`/screen/display` 是独立现场输出，不使用普通 Public Site Layout。页面根节点占满 `100vw × 100vh`，以 16:9 为第一目标，支持 1366×768 和 1920×1080 两档验收。页面内部按视口缩放，禁止依靠页面滚动查看关键区域。

Screen Console 继续位于 `/screen`，Organizer/Admin 控件不得出现在观众大屏上。

### 5.2 信息结构

页面按从上到下五层组织：

1. **赛事头部**：ARY 品牌、赛事副标题、LIVE 状态、当前 Round/Group、已用时、在线 Racer、轮播状态；
2. **排名与 KPI**：实时 TOP3、平均进度、Token 总量、Codex/Claude 参与占比；
3. **赛道舞台**：左侧 Mini Map 和 1–8 编号图例，右侧主赛道、真实马匹资产、Lane、排名编号和安全消息气泡；
4. **Attention Ticker**：展示当前组高优先级风险、违规和阻塞事件；
5. **现场页脚**：LIVE、主题、Organizer、当前 Round/Group、下一组倒计时和系统时间。

### 5.3 组件边界

Race Live 客户端只负责轮询、时钟和组轮播计算。展示拆成聚焦组件：

* `RaceLiveHeader`：赛事状态和时钟；
* `RaceLiveTopThree`：当前组 TOP3；
* `RaceLiveKpis`：进度与模型使用指标；
* `RaceLiveMiniMap`：同源简化赛道；
* `RaceLiveStage`：背景、马匹、编号和气泡；
* `RaceLiveAttentionTicker`：风险/违规事件；
* `RaceLiveFooter`：赛事上下文和轮播状态。

组件只消费展示 ViewModel，不直接查询数据库或解析内部 Projection。

### 5.4 数据流

服务端继续输出严格 allowlist Public Screen DTO。客户端每 3 秒轮询一次，解析成功后替换稳定快照；本地 1 秒时钟只用于已用时、系统时间和自动轮播显示。

```text
Public Screen DTO
→ Zod 边界校验
→ RaceLiveViewModel
→ 当前 display group
→ Header / TOP3 / KPI / Mini Map / Stage / Ticker / Footer
```

同一 Round 的 `displayGroups` 每组最多 8 人。自动轮播继续由 `ScreenState.rotationEpochAt`、`rotationIntervalSeconds` 和 `autoRotateEnabled` 计算，Organizer/Admin 控制仍写入现有 Screen Control 和审计链路。

### 5.5 降级

* 轮询失败或返回无效 DTO 时保持最近一次成功快照；
* Track Profile 或背景资产不可用时显示明确的全屏降级状态，不渲染残缺赛道；
* 当前组没有 Racer 时显示空组状态，不伪造参赛者；
* 消息没有安全位置时允许隐藏，不覆盖头部、KPI、TOP3 或 Ticker；
* Public 响应不得包含内部 Projection、actor、审计事件、管理理由或其他组的私有数据。

## 6. Track Calibrator 页面设计

### 6.1 入口与权限

Organizer/Admin Console 侧栏增加 `Track Management`。`/console/tracks` 保留版本列表和 pending Round 绑定入口，并提供明显的 `Track Calibrator` 操作。Organizer 只能管理其 managed Race，Admin 可跨 Race；服务端动作每次重新鉴权。

### 6.2 工作台结构

Calibrator 使用工作台式布局：

1. **顶部工具栏**：导入背景、导入 Profile/Draft、保存、撤销、重做、Validate、发布；
2. **主编辑区**：背景、Centerline 控制点、Lane、起终点、Checkpoint、Message Zone、No-bubble Zone；
3. **右侧 Inspector**：Metadata、Geometry、Direction、Start/Finish、Lane、Checkpoint 和 Zone；
4. **Runtime Preview**：1/8 马、场景、视觉状态、速度、Progress Scrubber 和 Mini Map；
5. **Validation**：Schema、Geometry、Bubble 和人工视觉确认；
6. **Local Draft**：IndexedDB 保存/恢复、导入导出和删除；
7. **Published Versions**：内容 Hash、使用状态、复制新 Draft、归档和删除。

### 6.3 编辑状态

编辑历史使用可测试的纯函数维护 `past / present / future`。任何内容修改都必须：

* 更新 `updatedAt`；
* 清除旧自动校验结果；
* 清除人工视觉确认；
* 将发布状态恢复为 `editing`；
* 生成新的幂等发布请求 ID。

中心线和 Zone 支持画布选择、添加、拖拽、数值修改和删除。Inspector 支持方向、平滑度、起终点与视觉偏移、Lane offset、Checkpoint 和 Zone 属性编辑。

### 6.4 预览与校验

Calibrator Preview 与 Race Live 必须继续共享 GRS003 Track Runtime。预览支持：

* 1 匹或 8 匹；
* 均匀分布、密集队形、起点聚集、终点冲刺；
* `running`、`blocked`、`pit_stop`、`finished`、`stale`；
* 0.5x、1x、2x；
* 0%–100% Progress Scrubber；
* 主画布与 Mini Map 同源位置。

自动校验覆盖 Schema、Geometry 和 Bubble。人工确认覆盖单马全程、8 马重叠、Lane 越界、起终点、Mini Map 一致性、气泡遮挡和 16:9 缩放。自动校验与人工确认全部通过后才允许发布。

### 6.5 Draft 与发布

编辑内容、背景 Blob、校验报告、人工确认和发布请求 ID 保存在浏览器 IndexedDB。导入 Draft 必须通过客户端 schema 校验；导入失败不得覆盖当前 Draft。

发布继续使用现有 Server Action。服务端重新执行：

* Organizer/Admin 授权；
* Profile schema 和 Track Runtime 几何校验；
* 背景 MIME、尺寸和 checksum 校验；
* 自动校验与人工确认完整性校验；
* 幂等请求与不可变版本唯一性校验。

失败时保留 Draft 和错误信息，不产生 TrackProfileVersion 或孤立背景资产。成功后 Published Version 不可原地修改，只能复制为新 Draft。

### 6.6 版本管理

版本列表展示 Track ID、版本、Profile Hash、Background Hash、发布时间和 Round 使用状态。

* published 且未被使用的版本可归档；
* 被 pending/running Round 引用的版本禁止归档；
* archived 且未被引用的版本可删除；
* 删除必须是服务端受权动作；
* 历史 Round 仍可读取其已绑定版本。

## 7. 错误与反馈

所有业务错误使用页面内可见反馈，不依赖未处理异常：

* 导入错误指出文件类型、schema 或背景匹配问题；
* 校验结果按错误/警告分类并定位字段；
* 发布错误保留 Draft，并显示是否为权限、内容、版本冲突或网络问题；
* 归档/删除冲突指出引用该版本的 Round；
* IndexedDB 不可用时阻止声称已保存，并允许导出当前内存 Draft；
* Race Live 降级页不泄露内部异常堆栈。

## 8. 测试与验收

### 8.1 测试先行

新增行为遵循 Red-Green-Refactor。纯函数和 ViewModel 先写领域/组件测试，再实现页面；浏览器交互先增加失败的 Playwright 用例，再实现交互。

### 8.2 Race Live

* 1366×768 和 1920×1080 均无页面滚动；
* 不显示 Public Site 全局导航和管理控件；
* 赛事头部、TOP3、KPI、Mini Map、Stage、Ticker 和 Footer 同时存在；
* 当前组最多展示 8 人，自动轮播切换到下一组；
* Mini Map 与主赛道使用相同进度；
* DTO 失败时保持最近稳定快照；
* 公开响应不包含内部或敏感字段；
* 与 GRS002 验收截图进行同视口并排人工复核。

### 8.3 Track Calibrator

* Organizer/Admin 能从 Console 发现并打开入口，无权用户被服务端拒绝；
* 中心线、Lane、Checkpoint 和 Zone 编辑后旧校验失效；
* 撤销/重做和方向反转可复现；
* 1/8 马、场景、状态、速度和 Scrubber 驱动预览；
* 自动校验和人工确认缺一不可发布；
* IndexedDB Draft 可保存、刷新恢复、导入、导出和删除；
* 发布失败不产生半成品，成功产生不可变版本；
* 被使用版本不能归档，只有未引用 archived 版本可删除。

### 8.4 完整质量门

完成声明前运行：

```powershell
npm.cmd run check:static
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
```

若数据库模型或服务端版本动作发生变化，还需在一次性 PostgreSQL 测试库运行 `prisma migrate deploy`，并验证全新库和既有基线升级。不得重置用户的 `dev.db`。

## 9. 文档状态修正

实施开始时，将 `PLAN.md` 和 `STATUS.md` 中当前“完整迁入完成”的表述修正为：

* 技术与安全基线已完成；
* Race Live 页面保真与完整 Calibrator 工具链进行中；
* staging/production 仍未验收。

只有本设计全部验收项实际通过后，才能恢复“页面与交互保真迁移完成”的状态。

## 10. 已确认决策

* 采用 GRS002 展示/交互层 + GRS003 事实源/安全边界；
* Race Live 保留 002 构图、信息密度与交互，品牌改为 Agent Racing Yard；
* 大屏为独立 16:9 输出，不显示站点导航；
* Calibrator 恢复完整工作台入口和核心工具链；
* Coach/Cockpit 不进入 ARY；
* 浏览器本地 Draft + 服务端不可变发布保持不变；
* 不新增独立服务或 GRS002 运行时依赖。
