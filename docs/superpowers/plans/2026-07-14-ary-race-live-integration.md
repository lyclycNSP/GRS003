# ARY Race Live Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 GRS002 Race Live、赛道契约和几何运行时迁入 GRS003，并用 ARY 领域事实生成可校验、可自动轮播、可稳定降级的大屏画面。

**Architecture:** GRS003 是唯一业务事实源。`AryRaceLiveProjectionBuilder` 从 Race、RaceRound、Registration、RaceProject、Session 和 ReviewFlag 生成 `AryRaceLiveSnapshot`，经 Zod 校验后保存为 ScreenProjection；Next.js Race Live 页面只消费公开 DTO，复用迁入的 track-profile 和 track-runtime。实现不得依赖运行中的 GRS002 服务。

**Tech Stack:** Next.js 15、React 19、TypeScript strict、Prisma 6、PostgreSQL、SQLite 测试初始化、Zod 3、Node crypto、Playwright。

**Source note:** GRS002 当前工作区把 `packages/*` 标记为删除。迁移时必须从 GRS002 Git `HEAD`（`e7bf615`）读取受控源文件，禁止恢复、覆盖或提交 GRS002 的用户工作区改动。

**Git note:** 本计划中的每个任务是独立提交边界，但只有用户明确授权时才执行 commit；否则在 PROGRESS.md 记录“未提交”。

**Command note:** 除特别标注外，以下命令均在 `web` 目录的 PowerShell 中执行。

---

## File map

- `web/lib/race-live/contracts.ts`：ARY 大屏 Zod 契约和 DTO 类型。
- `web/lib/race-live/grouping.ts`：确定性 DisplayGroup、lane 和全局排名规则。
- `web/lib/race-live/projection-builder.ts`：ARY 领域事实到 ScreenProjection 的唯一业务映射。
- `web/lib/race-live/view-model.ts`：公开 DTO 到 Race Live 组件输入的纯映射。
- `web/lib/track-profile/*`：从 GRS002 迁入的赛道 Schema、bundle 和校验。
- `web/lib/track-runtime/*`：从 GRS002 迁入的纯几何编译和 HorsePose。
- `web/components/race-live/*`：迁入并适配 Next.js 的展示组件。
- `web/app/screen/display/page.tsx`：服务端读取公开快照并组合 Client Race Live。
- `web/app/screen/display/RaceLiveClient.tsx`：自动轮播、动画和组件组合。
- `web/prisma/schema.prisma`：Round、Entry、Track、Projection、ScreenState 和审计结构。
- `web/tests/race-live-*.test.ts`：契约、分组、Projection 和控制领域测试。
- `web/e2e/screen-race-live.spec.ts`：公开大屏和 Organizer/Admin 控制验收。

### Task 1: 迁入纯赛道契约与运行时

**Files:**
- Create: `web/lib/track-profile/schema.ts`
- Create: `web/lib/track-profile/validation.ts`
- Create: `web/lib/track-profile/bundle.ts`
- Create: `web/lib/track-profile/index.ts`
- Create: `web/lib/track-runtime/compile.ts`
- Create: `web/lib/track-runtime/sample.ts`
- Create: `web/lib/track-runtime/types.ts`
- Create: `web/lib/track-runtime/index.ts`
- Create: `web/tests/track-runtime.test.ts`
- Modify: `web/package.json`

- [ ] **Step 1: 写迁入前失败测试**

```ts
import assert from "node:assert/strict";
import { parseTrackProfile } from "../lib/track-profile";
import { compileTrack, sampleHorsePose } from "../lib/track-runtime";
import metro from "../public/tracks/metro-raceway/1.0.0/track.profile.json";

const profile = parseTrackProfile(metro);
const track = compileTrack(profile);
const pose = sampleHorsePose({ track, entryId: "entry-1", progress: 0.5, laneId: "lane-1", visualState: "running" });
assert.ok(Number.isFinite(pose.x));
assert.ok(Number.isFinite(pose.y));
assert.equal(pose.entryId, "entry-1");
```

- [ ] **Step 2: 运行测试并确认因模块缺失失败**

Run: `node --import tsx tests/track-runtime.test.ts`

Expected: FAIL，错误包含 `Cannot find module '../lib/track-profile'`。

- [ ] **Step 3: 从 GRS002 HEAD 迁入最小纯模块**

从 `git -C D:\000MyWorkSpace\001ActiveProjects\ARY_GRS\GRS002 show HEAD:packages/track-profile/src/<file>` 和 `HEAD:packages/track-runtime/src/<file>` 读取源代码，保留 Zod 校验、Catmull-Rom、弧长表、lane offset 和 HorsePose；修改 import 为 GRS003 本地相对路径。不得复制 GRS002 的 Vite、Vitest、IndexedDB 或应用入口。

- [ ] **Step 4: 迁入两条发布赛道资产**

Create:

```text
web/public/tracks/metro-raceway/1.0.0/background.webp
web/public/tracks/metro-raceway/1.0.0/track.profile.json
web/public/tracks/coastal-circuit/1.0.0/background.webp
web/public/tracks/coastal-circuit/1.0.0/track.profile.json
```

资产从 GRS002 已提交版本读取，并校验 profile 中背景文件名、trackId、version 和 checksum 一致。

- [ ] **Step 5: 接入 npm test 并验证**

将 `node --import tsx tests/track-runtime.test.ts` 加入 `web/package.json` 的 `test` 脚本。

Run: `npm.cmd test`

Expected: 原有测试及新 Track Runtime 测试全部 PASS。

### Task 2: 定义 ARY 大屏契约与确定性分组

**Files:**
- Create: `web/lib/race-live/contracts.ts`
- Create: `web/lib/race-live/grouping.ts`
- Create: `web/tests/race-live-contracts.test.ts`
- Modify: `web/package.json`

- [ ] **Step 1: 写失败测试覆盖 9/16/17/36 Entry**

```ts
for (const [count, expected] of [[9, 2], [16, 2], [17, 3], [36, 5]] as const) {
  const entries = Array.from({ length: count }, (_, index) => ({ entryId: `entry-${index + 1}`, displayOrder: index + 1 }));
  const groups = createScreenDisplayGroups("round-1", entries);
  assert.equal(groups.length, expected);
  assert.ok(groups.every((group) => group.entryIds.length <= 8));
  assert.deepEqual(groups, createScreenDisplayGroups("round-1", entries));
}
```

- [ ] **Step 2: 运行并确认函数缺失**

Run: `node --import tsx tests/race-live-contracts.test.ts`

Expected: FAIL，错误包含 `createScreenDisplayGroups is not a function` 或模块缺失。

- [ ] **Step 3: 实现严格契约**

在 `contracts.ts` 导出：

```ts
export const ARY_RACE_LIVE_SCHEMA = "ary.race-live.v1" as const;
export const ScreenDisplayGroupSchema = z.object({
  groupId: z.string().min(1),
  order: z.number().int().positive(),
  entryIds: z.array(z.string().min(1)).min(1).max(8)
}).strict();
export const AryRaceLiveSnapshotSchema = z.object({
  schemaVersion: z.literal(ARY_RACE_LIVE_SCHEMA),
  raceId: z.string().min(1),
  roundId: z.string().min(1),
  sequence: z.number().int().positive(),
  generatedAt: z.string().datetime({ offset: true }),
  totalEntryCount: z.number().int().nonnegative(),
  entries: z.array(AryRaceLiveEntrySnapshotSchema),
  displayGroups: z.array(ScreenDisplayGroupSchema),
  globalRanking: z.array(GlobalRankingItemSchema),
  ridingMessages: z.array(RaceLiveMessageSnapshotSchema),
  attentionItems: z.array(RaceLiveAttentionSnapshotSchema)
}).strict();
```

Schema 必须拒绝 `coachId`、`cockpitId`、内部 user ID、connectorId、signingKeyId 和未知顶层字段。

- [ ] **Step 4: 实现确定性分组与 lane**

`createScreenDisplayGroups(roundId, entries)` 按 `displayOrder`、`entryId` 排序，每 8 个切组，`groupId` 使用 `${roundId}:group:${order}`；`assignGroupLanes()` 按组内顺序产生 `lane-1` 至 `lane-8`。

- [ ] **Step 5: 验证契约和类型**

Run:

```powershell
npm.cmd test
if ($LASTEXITCODE -eq 0) { npm.cmd run typecheck }
```

Expected: 全部 PASS，TypeScript 无隐式 any。

### Task 3: 新增 Round、Track 和 Screen 持久化模型

**Files:**
- Modify: `web/prisma/schema.prisma`
- Create: `web/prisma/migrations/20260714_race_live_foundation/migration.sql`
- Modify: `web/scripts/init-sqlite.py`
- Modify: `web/prisma/seed.ts`
- Test: `web/tests/race-live-domain.test.ts`

- [ ] **Step 1: 写失败测试验证结构化 Round 和 Entry**

```ts
const round = await prisma.raceRound.create({ data: {
  id: "round-test", raceId: "race_bay_2026", name: "Round 1", order: 1,
  status: "pending", scheduledStartAt: new Date(), scheduledEndAt: new Date(Date.now() + 3600000),
  trackProfileVersionId: "track-version-metro-1"
}});
assert.equal(round.order, 1);
```

- [ ] **Step 2: 运行并确认 Prisma Client 尚无模型**

Run:

```powershell
npm.cmd run test:e2e:prepare
if ($LASTEXITCODE -eq 0) {
  $env:DATABASE_URL='file:./e2e.db'
  node --import tsx tests/race-live-domain.test.ts
}
```

Expected: FAIL，TypeScript/Prisma 报告 `raceRound` 不存在。

- [ ] **Step 3: 添加模型与约束**

新增 `RaceRound`、`RaceRoundEntry`、`TrackProfile`、`TrackProfileVersion`、`ScreenControlAuditEvent`；为 `Projection` 增加 `schemaVersion`、`sequence`、`generatedAt`、`sourceWatermark`、`payloadHash`；为 `ScreenState` 增加轮播、Projection 和审计关联字段，并将 fallback 从 mode 中分离。

必须建立：

```prisma
@@unique([raceId, order])
@@unique([raceRoundId, registrationId])
@@unique([trackId, version])
@@unique([raceId, type, sequence])
```

- [ ] **Step 4: 编写 PostgreSQL migration 和 SQLite 初始化**

Migration 必须把已有 `ScreenState.mode='fallback'` 转换为 `mode='live'`、`fallbackEnabled=true`，再添加 mode 约束所需字段；legacy Projection 新字段保持 nullable，不能伪造 sequence。

- [ ] **Step 5: Seed 内置 Track 与演示 Round**

Seed 两个 published TrackProfileVersion，并为 `race_bay_2026` 创建一个 pending/running 演示 Round 和 approved Registration 对应的 RaceRoundEntry。

- [ ] **Step 6: 验证 Schema、SQLite 和升级文件**

Run:

```powershell
npm.cmd run test:e2e:prepare
$env:DATABASE_URL='file:./e2e.db'; npm.cmd test
$env:DATABASE_URL='postgresql://ary:ary@127.0.0.1:5432/ary?schema=public'; npx.cmd prisma validate
```

Expected: SQLite 初始化/Seed 和领域测试 PASS；Prisma schema valid。PostgreSQL `migrate deploy` 只在一次性数据库可用时执行并记录证据。

### Task 4: 实现 AryRaceLiveProjectionBuilder

**Files:**
- Create: `web/lib/race-live/projection-builder.ts`
- Create: `web/tests/race-live-projection.test.ts`
- Modify: `web/lib/domain.ts`
- Modify: `web/package.json`

- [ ] **Step 1: 写失败测试覆盖映射、安全过滤和稳定版本**

测试必须断言个人/团队 Entry 正确、全局 TOP3 不随当前组变化、ReviewFlag 不泄露 `judgeVisibleSummary/sourceRefJson`、同 Round 进度不倒退、失败构建不覆盖 stable Projection。

- [ ] **Step 2: 运行失败测试**

Run: `$env:DATABASE_URL='file:./e2e.db'; node --import tsx tests/race-live-projection.test.ts`

Expected: FAIL，`buildAryRaceLiveProjection` 未定义。

- [ ] **Step 3: 实现构建器接口**

```ts
export async function buildAryRaceLiveProjection(
  ctx: AuthContext | null,
  input: { raceId: string; roundId: string; now?: Date }
): Promise<Result>;
```

实现必须在 Serializable 事务中锁定/递增 sequence、读取同 Race/Round 的 approved Entry、聚合 Session tokens/lastActiveAt、生成 allowlisted Attention、计算 payloadHash，调用 `AryRaceLiveSnapshotSchema.parse()` 后才创建 stable Projection。

- [ ] **Step 4: 明确进度策略**

新增纯函数 `deriveEntryProgress()`，只读取已经定义的 RaceProject metrics 投影字段；字段缺失时返回 0/stale，不从自由文本、Work 内容或 Agent 对话猜测进度。与上一 stable Projection 合并时保持 `roundProgress` 和 `overallProgress` 单调。

- [ ] **Step 5: 运行领域测试**

Run: `$env:DATABASE_URL='file:./e2e.db'; npm.cmd test`

Expected: 全部 PASS。

### Task 5: 实现轮播控制和权限审计

**Files:**
- Create: `web/lib/race-live/rotation.ts`
- Modify: `web/lib/domain.ts`
- Modify: `web/app/actions.ts`
- Modify: `web/app/screen/page.tsx`
- Test: `web/tests/race-live-controls.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖 Public/Rider/Judge 拒绝、Organizer 仅 managed Race、Admin 跨 Race 必须原因、暂停/继续/上一组/下一组重置 epoch、单组不轮播、审计事件追加。

- [ ] **Step 2: 实现纯轮播计算**

```ts
export function resolveActiveGroup(input: {
  groupCount: number;
  activeOrder: number;
  autoRotateEnabled: boolean;
  rotationEpochAt: Date;
  intervalSeconds: number;
  now: Date;
}): number;
```

函数不得访问时间全局变量；interval 限制为 5 到 120 秒。

- [ ] **Step 3: 实现服务端动作**

增加 `pauseScreenRotation`、`resumeScreenRotation`、`moveScreenDisplayGroup`、`configureScreenRotation`，复用 `requireManagedRace`；Admin 对非 managed Race 操作时要求 reason。每次成功写 `ScreenControlAuditEvent`。

- [ ] **Step 4: 更新 Screen Console**

展示组数、当前组、自动轮播状态、间隔、上一组/下一组/暂停/继续；按钮只按服务端能力展示，直接构造请求仍必须被领域层拒绝。

- [ ] **Step 5: 验证测试**

Run:

```powershell
$env:DATABASE_URL='file:./e2e.db'
npm.cmd test
if ($LASTEXITCODE -eq 0) { npm.cmd run typecheck }
```

Expected: PASS。

### Task 6: 迁入 Race Live UI 并接入公开快照

**Files:**
- Create: `web/components/race-live/*`
- Create: `web/app/screen/display/RaceLiveClient.tsx`
- Create: `web/lib/race-live/view-model.ts`
- Modify: `web/app/screen/display/page.tsx`
- Modify: `web/lib/queries.ts`
- Modify: `web/app/globals.css`
- Test: `web/e2e/screen-race-live.spec.ts`

- [ ] **Step 1: 写 Playwright 失败测试**

测试公开 Display 可见赛道、最多 8 匹马、组自动切换、全局 TOP3 保持、页面不出现 coach/cockpit/内部 ID/原始 CA 字段。

- [ ] **Step 2: 运行并确认当前简单 Screen 不满足**

Run:

```powershell
npm.cmd run test:e2e:prepare
if ($LASTEXITCODE -eq 0) { npx.cmd playwright test e2e/screen-race-live.spec.ts }
```

Expected: FAIL，缺少 `data-testid="race-live-stage"`。

- [ ] **Step 3: 迁入展示组件**

从 GRS002 `apps/race-live/src/components` 和纯 feature 中迁入 Header、TOP3、KPI、RaceStage、MiniMap、AttentionTicker、Footer、bubble layout 和 horse motion；删除 Coach、Cockpit Navigation、Round Control 和 Vite mock role 入口。

- [ ] **Step 4: 接入 Next.js 数据边界**

服务端 `getPublicRaceLiveSnapshot()` 只 select/parse stable ScreenProjection；Client 只接收 `AryRaceLiveSnapshot`、Track Profile 和公开 ScreenState。外部资源链接遵循安全头，错误不回传 payloadJson。

- [ ] **Step 5: 实现同步自动轮播**

RaceLiveClient 用 `rotationEpochAt` 和 interval 计算 active group；页面计时器只触发重新渲染，不写数据库。组切换时清空上一组临时气泡和插值缓存。

- [ ] **Step 6: 验证两个目标尺寸**

Run: `npx.cmd playwright test e2e/screen-race-live.spec.ts`

Expected: 1920×1080、1366×768 均 PASS，无横向溢出。

### Task 7: 兼容、文档和完整质量门

**Files:**
- Modify: `web/e2e/screen.spec.ts`
- Modify: `web/README.md`
- Modify: `docs/ary-domain-analysis.v0.3.md`
- Modify: `docs/ary-permission-matrix.md`
- Modify: `docs/ary-dev-4-to-ops-delivery.md`
- Modify: `PLAN.md`
- Modify: `STATUS.md`
- Modify: `PROGRESS.md`

- [ ] **Step 1: 扩展原有 Screen 回归**

确保 leaderboard、works、announcement、fallback 和只读权限继续通过；新增 legacy Projection 不进入新版 Race Live 的断言。

- [ ] **Step 2: 更新文档**

记录命名分层、Projection Builder 数据方向、同 Round DisplayGroup、Organizer owns/Admin overrides、Coach/Cockpit 非目标、两条内置 Track 和浏览器验收步骤。

- [ ] **Step 3: 运行完整质量门**

```powershell
npm.cmd run check:static
$env:DATABASE_URL='file:./e2e.db'; npm.cmd test
npm.cmd run typecheck
$env:DATABASE_URL='postgresql://ary:ary@127.0.0.1:5432/ary?schema=public'; npm.cmd run prisma:generate
npm.cmd run build
npm.cmd run test:e2e
```

Expected: 所有本地门禁退出码 0。PostgreSQL migration 必须在一次性全新库和既有基线库执行；数据库不可用时明确记录为未验收，不声称完成。

- [ ] **Step 4: 收口状态**

只有全部实际通过的检查才能写入 STATUS；PROGRESS 记录问题、解决方式、避免复发方式和 commit ID，未获 commit 授权时写“未提交”。
