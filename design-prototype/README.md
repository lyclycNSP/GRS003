# ARY UX-1 高保真原型

版本：v0.3
任务：UX-1 高保真原型与设计基线
入口：`index.html`

---

# 1. 本轮定位

本目录是 UX-1 第一轮高保真原型产物。

本轮遵循 `docs/ux-hifi.taskbook.md` 中确认的原则：

```text
视觉为主，体验为先；最终产物一定是高保真原型。
```

因此，本轮重点不是完整业务流程、完整权限矩阵或完整异常状态，而是先建立 ARY 的产品第一印象、视觉气质、关键场景和可走查主路径。

---

# 2. 原型覆盖

当前原型改为按 IA 组织的 10 个高保真页面：

| 页面 | 目的 |
| --- | --- |
| Race Gallery | 建立 Gallery-first 的公开赛事入口和传播感。 |
| Race Page | 表达单场 Race 上下文、状态 CTA 和内部导航。 |
| Live Hall | 展示 Agent Racing 正在发生，突出骑手动态、成本、风险和过程 Projection。 |
| Works / Work Page | 表达作品列表、作品资产和 Evidence 摘要入口。 |
| Results | 表达 Award / final leaderboard 与过程 Projection 分离。 |
| Review | 表达赛事复盘、评审总结和公开 Evidence。 |
| Rider Profile | 表达 Rider 能力资产、作品、奖项和标签。 |
| Cooperation | 表达报名、办赛、赞助和合作转化入口。 |
| Race Console | 展示 Organizer / Rider / Judge / Admin 入口和高密度办赛控制台。 |
| Screen Display | 展示大屏输出，并把 Screen Console 控制面分开。 |

# 2.1 样例数据

样例数据入口：

```text
design-prototype/data/sample-races.json
design-prototype/data/sample-races.js
```

`sample-races.json` 服务高保真原型，不是生产 schema；`sample-races.js` 是为了让 `file://` 方式打开原型时也能直接加载数据的浏览器桥接文件。当前包含：

* 8 场样例赛事。
* 运行中赛事：`湾区开心游`、`智能投研助理`。
* 报名中赛事：`网商经营 Copilot`、`健康习惯教练`。
* 评审中赛事：`自媒体运营 Agent`。
* 已完成赛事：`创世骑行挑战赛`、`政务办事导航 Agent`。
* 即将开放赛事：`医疗随访助手`。
* Rider、Work、Live Projection、Award、Review、Profile、Console Task 样例。

当前主要页面已接入样例数据渲染，用于支撑 IA 页面中的赛事状态差异、作品资产、赛果、复盘、Rider Profile、控制台任务和 Screen Display 指标。

当前可走查的主路径：

```text
Home / Race Gallery
→ Race Page / Live Hall
→ Work / Results / Rider 资产入口
→ Screen Display
```

辅助路径：

```text
Console
→ Judge View
→ Screen Display
```

---

# 3. 视觉方向

本轮视觉关键词：

* 赛事现场感
* 公开传播
* Agent Riding 动态过程
* 专业工作台
* 大屏远距离可读
* Gallery-first
* 蓝白竞赛视觉
* 1080P 高信息密度

Public Site 的方向参考“蓝白赛马竞赛海报 / 课程赛事发布页”：强标题、速度线、赛道视觉、玻璃卡、多层信息面板和章节编号。

Console 的方向是稳定、清晰、可操作的高密度赛事控制台，不追求低信息密度的营销页式留白。

Screen Display 的方向是现场可观看的大屏输出，不是后台表格放大版。

桌面端主设计视口为 1920 x 1080。

---

# 4. 设计护栏

本轮原型保留以下护栏，避免高保真方向明显跑偏：

* 首页保持 Gallery-first，不做后台功能索引。
* Public Header 只承载 Races / Works / Riders / Cooperation；未登录态显示 Login，已登录态才额外显示 Workspace / Console Entry。
* 首页顶部不额外强调 Series / Gallery title；当前展示对象由 Hero 内居中的 live Race title 表达。
* Home Hero 的阅读顺序固定为：居中赛事标题 → 下划线式 Live Race 切换器 → 赛题 → 指标和主 CTA；切换器不重复显示赛事名，当前对象由标题表达。
* Home Hero 必须与 Featured Race 合体，首屏直接展示赛事名、赛题、状态、时间、人数、作品数和主 CTA，不用泛品牌口号替代赛事信息。
* Home / Race Gallery 的 Hero / Featured Races 必须直接支持 live Race 切换，不另设独立 Live Now 框；Latest Results 和 Past Races 避免重复同一批赛事。
* 首页右侧辅助入口默认收起为窄 Rail；用户点击后从右侧打开 Drawer，展示 Open Registration、Latest Results、Past Races 和 Cooperation 四个模块。
* Home / Race Gallery 不设置独立 Leaderboards 模块；过程榜留在 Live Hall，最终榜留在 Results，首页只保留具体作品和 Rider 资产入口。
* Race 是公开端和工作台的核心上下文。
* Console Entry 不抢占公开端主视觉。
* Public 主导航不放 Console / Screen；管理端通过独立 Workspace 入口进入，Screen Display 从 Screen Console 语境进入。
* Results 保持单场赛果页，不混入其他报名中、评审中或即将开放赛事。
* Works 必须呈现公开作品列表、筛选 / 排序和作品详情入口。
* 实时 CA 接入是骑行过程证据和评审参考，不是参赛资格硬门禁。
* GitHub Repo 不表达为实时 CA 接入替代物。
* CA 未接入、空骑行或接入异常表达为证据缺口 / 评审风险提示，不表达为自动退赛或提交阻断。
* Projection 只表达过程展示，不表达最终事实源。
* 原始 CA Session 默认不公开。
* Screen Console 是控制面，Screen Display 是展示输出面。
* 页面可见文案只呈现赛场、作品、榜单、Rider 和现场内容，不使用 PRD 口吻、需求说明、功能解释或实现术语。
* 二级页面标题不使用口号式大字，只使用对象名、赛事名、Rider 名和状态摘要。
* 后续页面新增或整改前，先使用 `.agents/skills/hifi-ui-page-workflow/SKILL.md` 的页面工作流，明确 IA 合约、数据面和已通过页面的视觉 / 交互惯例。
* 样例数据不足时，先按 Domain Model 补足 `data/sample-races.json` 和 `data/sample-races.js`，再设计页面层级；不得用宣传口号、需求描述或假字段填补信息空洞。
* 新页面完成后，必须回看首页已通过惯例：对象标题、下划线切换、右侧 Drawer / Rail、低噪状态标签、高密度但有呼吸的 1080P 布局、蓝白竞赛视觉和 CTA 层级。

更细的权限、状态机、异常恢复和接口约束留给后续架构、开发和 QA 阶段完善。

---

# 5. 验收关注点

本轮评审建议重点看：

* ARY 是否一眼区别于普通 Hackathon 平台或后台系统。
* Home / Race Gallery 是否有公开赛事传播力。
* 原型是否符合 `ary-mvp.ia.md` 的页面层级，而不是只做场景展板。
* 1920 x 1080 视口下信息密度是否足够承载 ARY 的多信息点。
* Live Hall 是否有实时赛事观看感。
* Console 是否具备专业工作台气质。
* Works、Results、Review、Rider Profile 是否能表达资产沉淀。
* Screen Display 是否具备现场大屏冲击力和远距离可读性。
* Public 观看路径是否可以用高保真原型讲清楚。

本轮验证截图：

```text
design-prototype/ary-design-prototype-data-home-1080p.png
design-prototype/ary-design-prototype-data-results-1080p.png
```

本轮不建议重点评审：

* 全量权限细节。
* 全量异常状态。
* 完整接口字段。
* 完整业务状态机。
* P1 / P2 平台化能力。
