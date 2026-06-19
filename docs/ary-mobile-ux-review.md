# ARY Mobile UX Review v0.1

> 审计对象：`app/index.html` + `app/styles.css` + `app/app.js` + `app/layout-check.js`
> 范围：8 视图端到端交互走查（不修改任何代码）
> 视口：360×640（mobile）/ 768×1024（tablet）
> 工具：CSS @media 静态分析 + DOM 结构 + IA 规范对照

## 1. 走查范围与视口

- **方法**：基于 `app/styles.css` 的 3 个断点（`@media (max-width: 1060px / 700px / 480px)`）+ `app/index.html` 的 8 个 `<section class="view">` 结构 + `app/app.js` 的 `renderEmpty` / `renderError` 调用点（39 处命中）做静态推导，不启动浏览器。
- **命中规则**：
  - 360×640：触发全部三个断点（<1060 / <700 / <480）
  - 768×1024：仅触发第一个断点（<1060），处于断点 1 区间
- **断点边界总结**：
  - `<1060`：side-rail 从左 sticky 改为顶部静态；nav 4 列；metric 2 列；所有 `.span-3..8` 改 span 12
  - `<700`：workspace padding 26→16；topbar / section-head / panel-head 改竖排；nav 2 列；metric 1 列；form-row / screen-grid 改单列；table min-width 760→**780px**（更宽！）
  - `<480`：empty-state padding 32→24；error-state 改 flex-wrap + retry 改 100% width
- **既有保护**：
  - `html { min-width: 320px }` ✅
  - `<meta name="viewport" content="width=device-width, initial-scale=1">` ✅
  - `.table-wrap { overflow-x: auto }` 让宽表横向滚动而非溢出页面 ✅
  - 所有输入控件 `overflow-wrap: anywhere` 防止长字段撑爆 ✅
  - t1 已加 empty-state / error-state 模式 + `renderEmpty` 19 处 + `renderError` 1 处 ✅

## 2. 8 视图走查表

| 视图 | 360×640 | 768×1024 | 主要问题 |
|---|---|---|---|
| **Overview** | OK（功能） | OK | 顶部 status-strip 多个 chip 在窄屏会换行 2-3 行；metric 单列后高度约 472px，屏占大但内容可读 |
| **Race** | OK（功能）+ 强制横向滚动 | OK | `id="registration-table"` 6 列（Rider/Status/RaceProject/CA/Work/Action）table min-width 780px，360 视口必须横向滚动才能看完一行；`button-row` 2 按钮换行 OK |
| **CA** | OK（功能） | OK | `button-row` 3 按钮（Accept/Reject/Fail Projection）在 360 挤为 2-3 行；`.projection-entry` 已在 <700 改单列 ✅；4 个 panel 全部 span-12 堆叠 |
| **Screen** | OK（视觉冲击强） | OK | `.screen-stage min-height: 420px` 在 360 占 ~66% 视口高度（dramatic 但合理）；`h3` clamp(28,5vw,62) 在 360 = 28px（已踩下限）✅ |
| **Reports** | OK（功能） | OK | 上下两块 layout-grid + 1 全宽 editor panel；`report-list` 在错误态会显示 `renderError` 卡片（line 411），<480 时 retry 按钮换行 ✅ |
| **Public** | OK（功能） | **浪费** | 3 个 span-4 卡片在 768（<1060）被强制 span-12 堆叠，浪费约 50% 横向空间；卡片内容简短本可一屏展示 3 列 |
| **Ops** | OK（功能） | OK | `button-row` 3 按钮（Mark Release/Record Incident/Archive Race）360 换行 OK；3 个 panel span-5/4/3 全部 span-12 堆叠 |
| **Admin** | OK（功能）+ 强制横向滚动 | OK | 4 列表（User/GitHub/Profile/Roles），GitHub URL 长字段靠 `overflow-wrap:anywhere` 防溢出 ✅；`role-toggle` chip 28px **远低于** 44pt 触达标准 |

> 走查结论：**8 视图全部能跑通**（导航可达、表单可填、内容可读），但有 1 个 P0 + 5 个 P1 + 4 个 P2 问题需修复。**0** 个 P0 阻塞核心流程。

## 3. 问题清单（按优先级）

### 3.1 P0（影响核心流程）

无。所有 8 视图在 360×640 与 768×1024 均可完成核心任务（导航、表单提交、列表查看、空态展示）。

### 3.2 P1（影响体验）

- [ ] **P1-1**：`.button` 实际 `min-height: 38px`，未达 44pt 触达标准。影响范围：所有 `data-action` 按钮 + 提交按钮。位于 `app/styles.css:329`。建议改为 `min-height: 44px`（或在 `min-height: 38px` 上额外加 `padding-block: 6px`）。
- [ ] **P1-2**：`.nav-list a` 实际 `min-height: 38px`，同样未达 44pt。位于 `app/styles.css:113`。建议同上。
- [ ] **P1-3**：mobile 下 nav 占首屏过大。`<700px` 时 side-rail 静态展开 = brand + 2×4 nav + user/role selects + 2 buttons ≈ 600px 视口前全是 chrome，用户需滚动约 1.5 屏才能看到 Overview 内容。位于 `app/styles.css:854-876`。建议：`<700` 时 nav 收为单行横向滚动条（overflow-x:auto）或加汉堡折叠。
- [ ] **P1-4**：mobile 下无 sticky 快捷导航。`<1060px` 起 `.side-rail { position: static }`（line 822），移动端用户切换视图需滚回顶部。位于 `app/styles.css:822`。建议：mobile 下提供一个 bottom-fixed 简化 tab bar（5-8 个 nav 入口）。
- [ ] **P1-5**：wide table 强制横向滚动。Race（6 列）/ Admin（4 列）表格 `min-width: 780px`（line 888），360 视口下用户在 `.table-wrap` 内横向扫，体验差。位于 `app/styles.css:887-889`。建议：<700 时表格改为 stacked-card（每行 = 一个 mini-card）或保留横向滚动 + 顶部加 "← →" 提示。

### 3.3 P2（nice-to-have）

- [ ] **P2-1**：`<700` 下 `.section-head` 改竖排（line 859-863），主操作按钮从右浮动到下方，视觉权重下降。Race / CA / Ops / Reports 的 primary CTA（如 Publish Race / Accept Signal / Mark Release Ready / Publish Award）变弱。建议：mobile 下 primary 按钮保持第一屏可见。
- [ ] **P2-2**：tablet 768 区间（700-1060）的浪费。Public view 3×span-4 在 768 完全能容纳 3 列，但 CSS 强制 span-12。位于 `app/styles.css:835-846`。建议：增加 `<860` 区间让 span-3/4 保留多列。
- [ ] **P2-3**：`.button.small` min-height: 32px、`.chip` 28px、`.role-toggle` 28px、`.segmented button` 34px 全部低于 44pt。即使作为次要操作，也建议至少 36px（视觉 + 错误容忍）。
- [ ] **P2-4**：`.screen-stage` 暗色背景在 mobile 强光环境下可读性下降。建议加 `@media (prefers-color-scheme: dark)` 分支或允许 light-mode override。

## 4. 改进建议（不动手）

- **触达尺寸系统化**：建立 `--touch-min: 44px` CSS 变量，所有可点击元素引用，避免散落硬编码。
- **mobile 优先断点策略**：当前断点 1060/700/480 是 desktop-first；建议改为 360/768/1024 mobile-first + `min-width` 渐进增强，与 PRD §3.2 mobile 优先一致。
- **表格转卡片**：<700 时把 4-6 列的 table 转为 stacked key-value 卡片（如 Admin 4 列 → 每用户一张小卡：User / GitHub / Profile / Roles 4 行）。可保持信息密度同时避免横向滚动。
- **bottom tab bar**：mobile 下用 `position: fixed; bottom: 0` 提供 5-8 个核心视图入口 + role select 浮层，避免滚顶切换。
- **focus-visible 增强**：mobile 软键盘弹出时，自动 scroll 到第一个 invalid / focused input，减少手动滚动。
- **保留 viewport-meta 不加 maximum-scale**：当前仅 `width=device-width, initial-scale=1`，对低视力用户友好，不要再加 `user-scalable=no` / `maximum-scale=1`。

## 5. 不在本期范围

- **真实设备测试**：iOS Safari / Android Chrome 需真机 + 真网络，本审计仅基于静态 CSS 推导。
- **浏览器自动化截图**：当前 Playwright 链路不通（per `docs/ary-dev-4-to-ops-delivery.md` §9 "未完成项"）。`design-prototype/` 也未跑通 headless Chrome（per t2a race-detail task 备注）。
- **触屏手势 / 滑动操作 / 长按菜单**：本期未涉及。
- **暗色模式 / 高对比度模式**：仅在 P2-4 顺带提及。
- **无障碍完整审计**（a11y axe-core / NVDA / VoiceOver）：仅做了 `aria-labelledby` / `role="status"` / `role="alert"` 的存在性检查。

---

**走查人**：general agent (v0.1 static audit)
**走查时间**：2026-06-19
**改动**：仅新建 `docs/ary-mobile-ux-review.md`，未触碰 `app/` / `design-prototype/` 任何源文件。

VERDICT: PASS