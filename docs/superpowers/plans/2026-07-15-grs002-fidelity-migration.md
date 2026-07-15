# GRS002 Race Live 与 Track Calibrator 保真迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 GRS002 的 Race Live 页面和 Track Calibrator 核心交互忠实迁入 GRS003，同时保留 GRS003 的唯一事实源、权限、IndexedDB Draft 和服务端不可变发布边界。

**Architecture:** Race Live 使用新的纯展示 ViewModel 和聚焦组件消费现有 Public Screen DTO；`/screen/display` 通过路由级布局退出普通 Public Site 外壳。Calibrator 使用纯函数编辑历史、预览模型和人工确认状态驱动工作台组件，服务端发布继续在现有 Action 中重新鉴权和校验，并补齐版本归档/删除生命周期。

**Tech Stack:** Next.js 15 App Router、React 19、TypeScript、Zod、Prisma、IndexedDB、Node assert 测试、Playwright。

**Execution note:** 用户要求当前工作区直接执行且未授权 commit；本计划不执行 commit、push、deploy，不重置 `web/prisma/dev.db`，也不覆盖现有 `docs/superpowers/` 未提交内容。

---

### Task 1: 修正任务状态并暴露 Track Management 入口

**Files:**
- Modify: `PLAN.md`
- Modify: `STATUS.md`
- Modify: `web/app/console/page.tsx`
- Modify: `web/e2e/track-calibrator.spec.ts`

- [ ] **Step 1: 写入口失败测试**

在 `web/e2e/track-calibrator.spec.ts` 增加 Organizer 从主 Console 发现入口的用例：

```ts
test("Organizer can discover Track Management from Console", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");
  await page.goto("/console?raceId=race_bay_2026");
  const entry = page.getByRole("link", { name: "Track Management" });
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page).toHaveURL(/\/console\/tracks\?raceId=race_bay_2026/);
  await expect(page.getByRole("link", { name: "打开 Track Calibrator" })).toBeVisible();
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm.cmd run test:e2e:prepare; npx.cmd playwright test e2e/track-calibrator.spec.ts -g "discover Track Management"`

Expected: FAIL，主 Console 找不到 `Track Management` 链接。

- [ ] **Step 3: 增加受权限约束的入口**

在 `web/app/console/page.tsx` 的 Console 侧栏中，将入口放在 `Screen Console` 附近：

```tsx
{canManageCurrentRace ? (
  <Link href={`/console/tracks?raceId=${race.id}`}>Track Management</Link>
) : null}
```

同时把 `PLAN.md`、`STATUS.md` 中“Race Live/Track Calibrator 页面完整迁入完成”的口径改为“技术与安全基线完成，页面保真和完整工具链进行中”。

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `npx.cmd playwright test e2e/track-calibrator.spec.ts -g "discover Track Management"`

Expected: PASS。

### Task 2: 扩展 Race Live 纯展示 ViewModel

**Files:**
- Create: `web/lib/race-live/presentation.ts`
- Create: `web/tests/race-live-presentation.test.ts`
- Modify: `web/package.json`

- [ ] **Step 1: 写 ViewModel 失败测试**

测试覆盖当前组过滤、TOP3、模型占比、当前组气泡和未解决 Attention：

```ts
import assert from "node:assert/strict";
import { buildRaceLivePresentation } from "../lib/race-live/presentation";
import { createRaceLiveSnapshotFixture } from "./fixtures/race-live";

const snapshot = createRaceLiveSnapshotFixture();
const view = buildRaceLivePresentation(snapshot, 1, new Date("2026-07-15T10:00:10.000Z"));
assert.equal(view.entries.length, 8);
assert.equal(view.top3.length, 3);
assert.equal(view.providerShare.codex + view.providerShare.claude + view.providerShare.other, 100);
assert.ok(view.bubbles.every((item) => view.entryIds.has(item.entryId)));
assert.ok(view.attentionItems.every((item) => item.status === "open"));
console.log("PASS builds the complete Race Live presentation model");
```

若现有 fixture 不可复用，在测试文件内构造严格满足 `AryRaceLiveSnapshotSchema` 的最小 8 人快照，不向生产模块加入 test-only API。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `node --import tsx tests/race-live-presentation.test.ts`

Expected: FAIL，`presentation.ts` 不存在。

- [ ] **Step 3: 实现最小纯函数**

`web/lib/race-live/presentation.ts` 导出：

```ts
export type RaceLivePresentation = {
  groupOrder: number;
  groupCount: number;
  entryIds: Set<string>;
  entries: AryRaceLiveEntrySnapshot[];
  top3: GlobalRankingItem[];
  bubbles: RaceLiveMessageSnapshot[];
  attentionItems: RaceLiveAttentionSnapshot[];
  providerShare: { codex: number; claude: number; other: number };
  elapsedSeconds: number;
};

export function buildRaceLivePresentation(
  snapshot: AryRaceLiveSnapshot,
  activeGroupOrder: number,
  now: Date,
): RaceLivePresentation;
```

规则：当前组最多 8 人；气泡只取当前组、`displayMode="bubble"`、未过期且最多 `maxVisibleBubbles`；Attention 只取当前组未解决项并按 critical→high→medium→low、更新时间倒序；模型占比按 entry 的 `agentProviders` 计数后四舍五入，并保证合计 100；已用时从 `actualStartedAt ?? scheduledStartAt` 计算且不小于 0。

- [ ] **Step 4: 接入测试脚本并确认 GREEN**

在 `web/package.json` 的 `test` 脚本中加入 `node --import tsx tests/race-live-presentation.test.ts`。

Run: `npm.cmd test`

Expected: 新测试和现有领域测试全部 PASS。

### Task 3: 建立独立 16:9 Screen Display 外壳

**Files:**
- Create: `web/app/screen/display/layout.tsx`
- Create: `web/app/screen/display/screen-display.css`
- Modify: `web/app/layout.tsx`
- Modify: `web/app/screen/display/page.tsx`
- Modify: `web/e2e/screen-race-live.spec.ts`

- [ ] **Step 1: 写无站点导航、无滚动失败测试**

扩展两个 viewport 用例：

```ts
await expect(page.getByRole("navigation", { name: "Public site navigation" })).toHaveCount(0);
await expect(page.getByTestId("race-live-header")).toBeVisible();
await expect(page.getByTestId("race-live-minimap")).toBeVisible();
await expect(page.getByTestId("race-live-attention")).toBeVisible();
const overflow = await page.evaluate(() => ({
  x: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  y: document.documentElement.scrollHeight > document.documentElement.clientHeight,
}));
expect(overflow).toEqual({ x: false, y: false });
```

- [ ] **Step 2: 运行用例并确认 RED**

Run: `npm.cmd run test:e2e:prepare; npx.cmd playwright test e2e/screen-race-live.spec.ts`

Expected: FAIL，页面仍存在 Public Site navigation、Mini Map/Ticker 缺失或纵向溢出。

- [ ] **Step 3: 让根 Layout 支持 display 路由退出站点外壳**

由于 Next.js 子 Layout 不能移除父 Layout DOM，将站点外壳封装为读取 pathname 的客户端 `SiteChrome`：

```tsx
"use client";
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/screen/display") return <main className="screen-output-root">{children}</main>;
  return <div className="deck-shell">{/* existing header + main */}</div>;
}
```

`web/app/layout.tsx` 只保留 `<html><body><HashRedirect /><SiteChrome>{children}</SiteChrome></body></html>`。`screen-display.css` 对 `.screen-output-root`、`.screen-display` 和 `.race-live-shell` 设置固定视口、`overflow:hidden`、`box-sizing:border-box` 和 16:9 响应尺寸。

- [ ] **Step 4: 简化 ScreenDisplayPage**

删除公开输出页中的 `Console` 链接和重复标题，只保留模式标识供测试与 RaceLiveClient/降级模式渲染；管理入口继续只存在 `/screen`。

- [ ] **Step 5: 运行用例并确认 GREEN**

Run: `npx.cmd playwright test e2e/screen-race-live.spec.ts`

Expected: 两档 viewport 均 PASS，x/y overflow 均为 false。

### Task 4: 迁入 GRS002 Race Live 信息层与视觉资产

**Files:**
- Create: `web/app/screen/display/components/RaceLiveHeader.tsx`
- Create: `web/app/screen/display/components/RaceLiveTopThree.tsx`
- Create: `web/app/screen/display/components/RaceLiveKpis.tsx`
- Create: `web/app/screen/display/components/RaceLiveMiniMap.tsx`
- Create: `web/app/screen/display/components/RaceLiveStage.tsx`
- Create: `web/app/screen/display/components/RaceLiveAttentionTicker.tsx`
- Create: `web/app/screen/display/components/RaceLiveFooter.tsx`
- Create: `web/public/race-live/horse-blue.png`
- Modify: `web/app/screen/display/RaceLiveClient.tsx`
- Modify: `web/app/screen/display/screen-display.css`
- Modify: `web/e2e/screen-race-live.spec.ts`

- [ ] **Step 1: 写完整信息层失败断言**

```ts
await expect(page.getByTestId("race-live-top3")).toBeVisible();
await expect(page.getByTestId("race-live-kpis")).toContainText("Token");
await expect(page.getByTestId("race-live-minimap")).toBeVisible();
await expect(page.getByTestId("race-live-stage").locator("img[data-horse-sprite]"))
  .toHaveCount(2);
await expect(page.getByTestId("race-live-attention")).toContainText(/风险|违规|阻塞|暂无/);
await expect(page.getByTestId("race-live-footer")).toContainText(/Round|Group/);
await expect(page.getByTestId("race-live-stage")).not.toContainText("🐎");
```

- [ ] **Step 2: 运行用例并确认 RED**

Run: `npx.cmd playwright test e2e/screen-race-live.spec.ts -g "1920x1080"`

Expected: FAIL，组件/真实马匹资产不存在。

- [ ] **Step 3: 复制并校验 GRS002 马匹资产**

复制 `GRS002/assets/sprites/horse-blue.png` 到 `web/public/race-live/horse-blue.png`，记录源/目标 SHA-256，确保二进制一致。不得引入 Coach/Cockpit 文件。

- [ ] **Step 4: 实现聚焦组件**

组件只接受 `RaceLivePresentation`、`TrackProfile` 或明确的标量 props。`RaceLiveMiniMap` 使用 `sampleMiniMapPose`/同源中心线；`RaceLiveStage` 使用 `sampleHorsePose` 并渲染真实 `<img src="/race-live/horse-blue.png">`；气泡只使用 ViewModel 已筛选项；Ticker 不读取内部 ReviewFlag。

`RaceLiveClient` 的 live 分支改成：

```tsx
const presentation = buildRaceLivePresentation(snapshot, activeOrder, now);
return <section className="race-live-shell">
  <RaceLiveHeader snapshot={snapshot} presentation={presentation} screenState={screenState} />
  <section className="race-live-summary-row">
    <RaceLiveTopThree items={presentation.top3} />
    <RaceLiveKpis snapshot={snapshot} share={presentation.providerShare} />
  </section>
  <section className="race-live-track-row">
    <RaceLiveMiniMap profile={trackProfile} entries={presentation.entries} />
    <RaceLiveStage profile={trackProfile} track={track} entries={presentation.entries} bubbles={presentation.bubbles} backgroundAssetRef={backgroundAssetRef} />
  </section>
  <RaceLiveAttentionTicker items={presentation.attentionItems} />
  <RaceLiveFooter snapshot={snapshot} presentation={presentation} screenState={screenState} now={now} />
</section>;
```

- [ ] **Step 5: 迁入 002 构图并适配 ARY 品牌**

以 `GRS002/apps/race-live/src/RaceLive.module.css` 为尺寸/密度来源，在 `screen-display.css` 重建 grid，不直接复制 DevCompass 文案。目标为同视口五层结构、2px 以下细边框、白/浅蓝面板和蓝色赛事强调；禁止 emoji、占位图和站点导航。

- [ ] **Step 6: 运行用例与截图对照**

Run: `npx.cmd playwright test e2e/screen-race-live.spec.ts`

然后分别生成 1366×768、1920×1080 截图到 `web/output/playwright/grs002-fidelity/`，与 `GRS002/artifacts/race-live/` 同尺寸截图并排检查构图、裁切、字体、边距、边框和滚动。

Expected: 自动用例 PASS，人工对照无关键区域缺失或裁切。

### Task 5: 增加 Calibrator 编辑历史、预览模型和人工确认

**Files:**
- Create: `web/lib/track-calibrator/editor-history.ts`
- Create: `web/lib/track-calibrator/preview.ts`
- Create: `web/tests/track-calibrator-editor.test.ts`
- Modify: `web/lib/track-calibrator/draft-types.ts`
- Modify: `web/tests/track-calibrator-draft.test.ts`
- Modify: `web/package.json`

- [ ] **Step 1: 写编辑历史失败测试**

```ts
const history = createEditorHistory(profile);
const moved = pushEditorChange(history, { ...profile, direction: "counterclockwise" });
assert.equal(undoEditorChange(moved).present.direction, profile.direction);
assert.equal(redoEditorChange(undoEditorChange(moved)).present.direction, "counterclockwise");
assert.equal(reverseTrackDirection(profile).centerline.points[0], profile.centerline.points.at(-1));
console.log("PASS supports deterministic Calibrator edit history");
```

再测试 `buildPreviewModel(profile, { horseCount:8, scenario:"clustered", progress:0.5, visualState:"running" })` 返回 8 个主赛道 pose 和 8 个 Mini Map pose。

- [ ] **Step 2: 写 Draft 人工确认失败测试**

扩展 strict schema：

```ts
manualValidation: {
  confirmations: Record<ManualValidationKey, boolean>;
  notes: string;
  confirmedAt?: string;
}
```

断言旧 Draft 缺少该字段时向后兼容补默认值，未知确认键仍被拒绝；序列化/反序列化不丢失状态。

- [ ] **Step 3: 运行并确认 RED**

Run: `node --import tsx tests/track-calibrator-editor.test.ts; node --import tsx tests/track-calibrator-draft.test.ts`

Expected: FAIL，新模块/字段不存在。

- [ ] **Step 4: 实现纯函数和严格类型**

`editor-history.ts` 提供 `createEditorHistory`、`pushEditorChange`、`undoEditorChange`、`redoEditorChange`、`reverseTrackDirection`。`preview.ts` 提供场景进度分布和共享 Runtime pose。`draft-types.ts` 定义固定人工确认键，并在 parse 时只对 legacy Draft 注入全 false 默认值。

- [ ] **Step 5: 运行并确认 GREEN**

把新测试加入 `npm test`，运行：`npm.cmd test`。

Expected: 全部 PASS。

### Task 6: 重建 Calibrator 工作台交互

**Files:**
- Modify: `web/app/console/tracks/calibrator/TrackCalibratorClient.tsx`
- Modify: `web/components/track-calibrator/CanvasEditor.tsx`
- Modify: `web/components/track-calibrator/ProfileInspector.tsx`
- Modify: `web/components/track-calibrator/TrackPreview.tsx`
- Modify: `web/components/track-calibrator/ValidationPanel.tsx`
- Create: `web/components/track-calibrator/CalibratorToolbar.tsx`
- Create: `web/components/track-calibrator/ManualValidationPanel.tsx`
- Create: `web/components/track-calibrator/PublishedVersionsPanel.tsx`
- Modify: `web/lib/track-calibrator/draft-repository.ts`
- Modify: `web/e2e/track-calibrator.spec.ts`
- Modify: `web/app/globals.css`

- [ ] **Step 1: 写工作台交互失败测试**

Playwright 新用例验证：导入 Draft 控件、撤销/重做/反转、1/8 马、场景、速度、Scrubber、人工确认清单以及编辑后校验失效：

```ts
await expect(page.getByTestId("import-draft")).toBeVisible();
await page.getByTestId("reverse-direction").click();
await page.getByTestId("undo-track-change").click();
await page.getByTestId("redo-track-change").click();
await page.getByTestId("preview-horse-count").selectOption("8");
await page.getByTestId("preview-scenario").selectOption("clustered");
await page.getByTestId("preview-progress").fill("0.72");
await expect(page.getByTestId("track-preview-entry")).toHaveCount(8);
await page.getByTestId("validate-track").click();
await page.getByTestId("track-name").fill("Edited after validation");
await expect(page.getByTestId("validation-state")).toHaveText("dirty / not validated");
```

- [ ] **Step 2: 运行并确认 RED**

Run: `npm.cmd run test:e2e:prepare; npx.cmd playwright test e2e/track-calibrator.spec.ts`

Expected: FAIL，新控件不存在。

- [ ] **Step 3: 用 history.present 替换散落 profile 状态**

`TrackCalibratorClient` 以 `EditorHistory<TrackProfile>` 为唯一编辑状态。统一 `applyChange(next)` 清除自动校验、人工确认和 published hash，并更新发布请求 ID。撤销/重做同样使旧校验失效。

- [ ] **Step 4: 扩展工作台组件**

`CanvasEditor` 增加选中点和键盘可达删除；`ProfileInspector` 增加 direction、smoothing、startFinish、Lane offset、Checkpoint/Zone 属性编辑；`TrackPreview` 使用 `buildPreviewModel`，提供 horse count/scenario/state/speed/progress 和 Mini Map；`ValidationPanel` 展示分类 issues；`ManualValidationPanel` 渲染固定确认项。

- [ ] **Step 5: 增加安全 Draft 导入**

为 repository 增加：

```ts
importDraftBundle(file: Blob): Promise<{ draft: CalibratorDraft; background: Blob | null }>;
```

先解析外层 `format/version`，再用 `parseCalibratorDraft` 校验 draft，校验 base64/MIME/size 后才返回；调用方全部成功后才替换当前状态，失败只显示错误，不覆盖现有 Draft。

- [ ] **Step 6: 实现工作台布局并确认 GREEN**

在 `globals.css` 中使用顶部工具栏、主画布+Inspector、Preview+Validation、Draft+Published Versions 的响应式 grid。运行：`npx.cmd playwright test e2e/track-calibrator.spec.ts`。

Expected: 权限、原有 Draft/发布和新增工作台用例全部 PASS。

### Task 7: 强化发布校验并补版本归档/删除

**Files:**
- Modify: `web/lib/track-calibrator/publish.ts`
- Create: `web/lib/track-calibrator/version-lifecycle.ts`
- Modify: `web/app/actions.ts`
- Modify: `web/lib/queries.ts`
- Modify: `web/app/console/tracks/page.tsx`
- Modify: `web/app/console/tracks/calibrator/page.tsx`
- Modify: `web/app/console/tracks/calibrator/TrackCalibratorClient.tsx`
- Create: `web/tests/track-version-lifecycle.test.ts`
- Modify: `web/e2e/track-calibrator.spec.ts`
- Modify: `web/package.json`

- [ ] **Step 1: 写领域失败测试**

覆盖：缺人工确认拒绝发布；被 Round 引用的 published 版本拒绝归档；未引用 published 可归档；只有未引用 archived 可删除；Organizer 不能操作其他 Race，Admin 可跨 Race。

```ts
assert.equal((await archiveTrackProfileVersion(organizerCtx, usedVersionId)).ok, false);
assert.equal((await archiveTrackProfileVersion(organizerCtx, unusedVersionId)).ok, true);
assert.equal((await deleteArchivedTrackProfileVersion(organizerCtx, unusedVersionId)).ok, true);
console.log("PASS enforces Track Profile version lifecycle");
```

- [ ] **Step 2: 运行并确认 RED**

Run: `node --import tsx tests/track-version-lifecycle.test.ts`

Expected: FAIL，生命周期函数不存在。

- [ ] **Step 3: 扩展发布输入**

`publishTrackProfileVersionAction` 接收 `validationReportJson` 和 `manualValidationJson`。`publish.ts` 使用 Zod 解析并要求自动校验 valid、固定人工确认全部 true，然后仍重新执行服务端 Profile/几何/背景校验。保存到既有 `validationReportJson`，不得信任客户端报告代替服务端校验。

- [ ] **Step 4: 实现归档/删除领域动作**

`version-lifecycle.ts` 中：

```ts
export async function archiveTrackProfileVersion(ctx: AuthContext | null, versionId: string): Promise<Result>;
export async function deleteArchivedTrackProfileVersion(ctx: AuthContext | null, versionId: string): Promise<Result>;
```

事务内读取 version+track+raceRounds，执行 managed Race/Admin 校验；引用计数非零拒绝；归档同时把 `profileJson.status` 和行 `status` 改为 `archived`；删除只允许 archived 且无引用。新增 Server Actions 刷新 `/console/tracks`。

- [ ] **Step 5: 将版本列表传入 Calibrator**

查询返回版本 Hash、status、publishedAt 和引用 Round 摘要；`PublishedVersionsPanel` 展示并提供复制/归档/删除操作。不可操作项显示原因，不用未处理异常反馈。

- [ ] **Step 6: 运行领域和 E2E 并确认 GREEN**

Run: `npm.cmd test`

Run: `npm.cmd run test:e2e:prepare; npx.cmd playwright test e2e/track-calibrator.spec.ts`

Expected: 全部 PASS，失败发布不产生新版本或孤立资产。

### Task 8: 文档、全量验证与状态收口

**Files:**
- Modify: `web/README.md`
- Modify: `PLAN.md`
- Modify: `STATUS.md`
- Modify: `PROGRESS.md`
- Preserve: `docs/superpowers/specs/2026-07-15-grs002-fidelity-migration-design.md`
- Preserve: `docs/superpowers/plans/2026-07-15-grs002-fidelity-migration.md`

- [ ] **Step 1: 更新本地浏览器验收步骤**

README 写明 Organizer Debug Login、Console→Track Management→Calibrator、`/screen` 控制台、`/screen/display` 独立投屏、两档 viewport 和预期状态变化。

- [ ] **Step 2: 更新 PROGRESS 经验记录**

记录本次根因：此前把能力/安全基线误写成页面完整迁移；解决方式：以 GRS002 验收截图和源码为展示/交互事实源；避免复发：迁移任务必须分别验收领域、交互、视觉和可发现入口。commit ID 写“未提交”。

- [ ] **Step 3: 运行静态与领域门禁**

Run: `npm.cmd run check:static`

Run: `npm.cmd test`

Run: `npm.cmd run typecheck`

Expected: 全部 exit 0。

- [ ] **Step 4: 运行构建门禁**

Run: `npm.cmd run build`

Expected: production build exit 0。

- [ ] **Step 5: 运行完整浏览器门禁**

Run: `npm.cmd run test:e2e`

Expected: 全部 Playwright 场景通过；记录实际数量，不沿用旧 18/18 数字。

- [ ] **Step 6: 按风险决定 PostgreSQL migration 验证**

若 Task 7 未改 Prisma schema，只运行现有 migration deploy smoke；若实际引入 schema 变化，则在一次性 PostgreSQL 16 测试库验证全新库与既有基线升级。不得触碰用户 `dev.db`。

- [ ] **Step 7: 进行同视口视觉复核**

用 Playwright 抓取 1366×768 和 1920×1080 的 GRS003 Race Live，并与 GRS002 对应验收截图并排查看。检查：无导航/滚动、五层信息完整、马匹非 emoji、舞台不裁切、文字远距离可读、Calibrator 工具栏和 Inspector 不拥挤。

- [ ] **Step 8: 根据新证据收口状态**

只有上述检查实际通过后，才把 `PLAN.md`、`STATUS.md` 更新为“Race Live 页面与 Track Calibrator 核心工具链保真迁移完成”；否则保留“进行中”并记录具体失败项。

### Task 9: 修复 Race Live 初始时钟 hydration 不一致

**Files:**
- Modify: `web/lib/race-live/presentation.ts`
- Modify: `web/tests/race-live-presentation.test.ts`
- Modify: `web/app/screen/display/page.tsx`
- Modify: `web/app/screen/display/RaceLiveClient.tsx`

- [x] **Step 1: 写初始时钟失败测试**

在 presentation 测试中要求 ISO 时间被解析为固定毫秒值，非法值被拒绝：

```ts
assert.equal(parseRaceLiveInitialNow("2026-07-15T05:06:39.762Z").toISOString(), "2026-07-15T05:06:39.762Z");
assert.throws(() => parseRaceLiveInitialNow("invalid"));
```

- [x] **Step 2: 运行并确认 RED**

Run: `node --import tsx tests/race-live-presentation.test.ts`

Expected: FAIL，`parseRaceLiveInitialNow` 尚未导出。

- [x] **Step 3: 实现共享初始时钟**

`ScreenDisplayPage` 在服务端生成一次 `initialNow` ISO 字符串并传入 `RaceLiveClient`。Client 的 `useState` 只从该 prop 初始化，挂载后的 interval 继续使用客户端当前时间。

- [x] **Step 4: 验证 GREEN 与真实浏览器**

Run: `node --import tsx tests/race-live-presentation.test.ts`

Run: `npm.cmd run typecheck`

使用新鲜 Projection 打开 `/screen/display`，确认浏览器控制台没有 hydration mismatch，Header、TOP3、赛道和 Footer 均可见。
