# ARY Track Calibrator Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 GRS002 Track Calibrator 迁入 ARY，以浏览器 IndexedDB 保存本地 Draft，并通过受保护服务端入口校验、上传和发布不可变 TrackProfileVersion。

**Architecture:** Calibrator 是 GRS003 Next.js 中独立的 Client 模块，不是独立服务。编辑状态与背景 Blob 只保存在浏览器；服务端发布动作重新鉴权、计算 SHA-256、执行 Track Profile/Geometry 校验、暂存资产并在数据库事务中创建不可变版本。Race Live 和 Calibrator Preview 复用第一份计划迁入的 track-profile 与 track-runtime。

**Tech Stack:** Next.js 15、React 19、TypeScript strict、IndexedDB、Prisma 6、Zod、Node crypto/fs、Server Actions、Playwright。

**Dependency:** 必须先完成 `2026-07-14-ary-race-live-integration.md` 的 Task 1 和 Task 3，使共享 Runtime、TrackProfile 和 TrackProfileVersion 已存在。

**Git note:** 只有用户明确授权时才执行 commit；否则在 PROGRESS.md 记录“未提交”。

**Command note:** 除特别标注外，以下命令均在 `web` 目录的 PowerShell 中执行。

---

## File map

- `web/lib/track-calibrator/draft-repository.ts`：IndexedDB Draft/Blob/报告仓储接口与实现。
- `web/lib/track-calibrator/publish.ts`：发布输入校验、服务端编排和不可变规则。
- `web/lib/track-assets/store.ts`：资产存储 Port。
- `web/lib/track-assets/local-store.ts`：本地/测试持久目录实现。
- `web/app/console/tracks/page.tsx`：已发布版本和本地工具入口。
- `web/app/console/tracks/calibrator/page.tsx`：权限壳。
- `web/app/console/tracks/calibrator/TrackCalibratorClient.tsx`：编辑器组合。
- `web/components/track-calibrator/*`：Canvas、Inspector、Preview、Validation 和 Publish UI。
- `web/tests/track-publish.test.ts`：服务端发布、权限、原子性和不可变测试。
- `web/e2e/track-calibrator.spec.ts`：IndexedDB 恢复、预览和发布流程。

### Task 1: 迁入 IndexedDB Draft Repository

**Files:**
- Create: `web/lib/track-calibrator/draft-types.ts`
- Create: `web/lib/track-calibrator/draft-repository.ts`
- Create: `web/tests/track-calibrator-draft.test.ts`
- Modify: `web/package.json`

- [ ] **Step 1: 写失败测试**

使用浏览器组件/E2E 测试覆盖保存 Profile、背景 Blob、Validation Report、刷新恢复和显式删除；Node 单元测试只测序列化边界，不引入 fake-indexeddb 新依赖。

- [ ] **Step 2: 定义仓储接口**

```ts
export interface CalibratorDraftRepository {
  getDraft(draftId: string): Promise<CalibratorDraft | null>;
  saveDraft(draft: CalibratorDraft, background?: Blob): Promise<void>;
  getBackground(assetId: string): Promise<Blob | null>;
  deleteDraft(draftId: string): Promise<void>;
  exportDraftBundle(draftId: string): Promise<Blob>;
}
```

- [ ] **Step 3: 从 GRS002 HEAD 迁入 IndexedDB 逻辑**

读取 `HEAD:apps/track-calibrator/src/storage/indexeddb-track-repository.ts`，改造成 ARY 命名和接口；DB 名使用 `ary-track-calibrator`，stores 使用 `drafts`、`backgrounds`、`validationReports`、`metadata`。禁止访问服务端 Prisma。

- [ ] **Step 4: 验证浏览器恢复**

Run:

```powershell
npm.cmd run test:e2e:prepare
if ($LASTEXITCODE -eq 0) { npx.cmd playwright test e2e/track-calibrator.spec.ts --grep "draft recovery" }
```

Expected: 保存后刷新仍恢复相同 trackId、版本和背景；删除站点 IndexedDB 后显示无本地 Draft。

### Task 2: 迁入 Calibrator Canvas、Preview 与校验

**Files:**
- Create: `web/components/track-calibrator/CanvasEditor.tsx`
- Create: `web/components/track-calibrator/ProfileInspector.tsx`
- Create: `web/components/track-calibrator/TrackPreview.tsx`
- Create: `web/components/track-calibrator/ValidationPanel.tsx`
- Create: `web/app/console/tracks/calibrator/TrackCalibratorClient.tsx`
- Create: `web/app/console/tracks/calibrator/page.tsx`
- Modify: `web/app/globals.css`
- Test: `web/e2e/track-calibrator.spec.ts`

- [ ] **Step 1: 写权限与编辑失败测试**

测试未登录/Rider/Judge 不能打开工具；Organizer 只能带 managed raceId；拖拽中心线、lane、checkpoint、zone 后 Draft 变脏且旧 Validation 清空。

- [ ] **Step 2: 迁入组件和纯编辑逻辑**

从 GRS002 `apps/track-calibrator/src/features` 迁入 canvas-editor、preview、validation 和 publishing 的本地部分；删除 Vite 入口、本地“发布即事实”逻辑和 GRS002 角色 Mock。

- [ ] **Step 3: 复用共享 Runtime**

Preview 只调用：

```ts
const compiled = compileTrack(profile);
const pose = sampleHorsePose({ track: compiled, entryId, progress, laneId, visualState });
```

不得复制路径采样、lane offset 或 HorsePose 算法。

- [ ] **Step 4: 验证编辑和预览**

Run: `npx.cmd playwright test e2e/track-calibrator.spec.ts --grep "edit|preview"`

Expected: 编辑、8 马预览、校验失效和恢复 PASS。

### Task 3: 建立 TrackAssetStore 和服务端输入边界

**Files:**
- Create: `web/lib/track-assets/store.ts`
- Create: `web/lib/track-assets/local-store.ts`
- Create: `web/lib/track-calibrator/publish-input.ts`
- Modify: `web/lib/runtime-config.ts`
- Modify: `web/scripts/check-production-config.mjs`
- Test: `web/tests/track-publish.test.ts`

- [ ] **Step 1: 写失败测试覆盖恶意和超限输入**

拒绝 SVG、HTML、错误 MIME、超过 20 MiB、宽高超过 4096、Profile JSON 超过 1 MiB、checksum 伪造、路径遍历文件名和未知 Schema 主版本。

- [ ] **Step 2: 定义资产 Port**

```ts
export interface TrackAssetStore {
  stage(input: { publishRequestId: string; bytes: Uint8Array; extension: "webp" | "png" | "jpg" }): Promise<StagedTrackAsset>;
  finalize(staged: StagedTrackAsset, key: string): Promise<{ assetRef: string }>;
  discard(staged: StagedTrackAsset): Promise<void>;
}
```

- [ ] **Step 3: 实现本地/测试存储**

`LocalTrackAssetStore` 只允许写入 `TRACK_ASSET_ROOT` 的解析后子路径，使用随机暂存名和原子 rename；禁止使用客户端文件名拼路径。`.gitignore` 忽略本地资产根目录。

- [ ] **Step 4: 生产预检**

production 必须配置持久化 `TRACK_ASSET_ROOT` 或后续等价对象存储 adapter；目录不存在、不可写或落在源码目录时 preflight 失败。不得把背景 Base64 写入数据库。

- [ ] **Step 5: 验证输入测试**

Run: `$env:DATABASE_URL='file:./e2e.db'; node --import tsx tests/track-publish.test.ts`

Expected: 所有非法输入被拒绝，存储根目录外无文件产生。

### Task 4: 实现受保护、幂等、不可变发布

**Files:**
- Create: `web/lib/track-calibrator/publish.ts`
- Modify: `web/app/actions.ts`
- Modify: `web/lib/domain.ts`
- Modify: `web/prisma/schema.prisma`
- Create: `web/prisma/migrations/20260714_track_publish_idempotency/migration.sql`
- Modify: `web/scripts/init-sqlite.py`
- Test: `web/tests/track-publish.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖 Organizer 非 managed Race 拒绝、Admin system Track、重复 `publishRequestId` 幂等返回同一版本、`trackId+version` 不覆盖、服务端重算 SHA-256、几何失败不创建版本、资产成功但事务失败不产生可绑定版本。

- [ ] **Step 2: 增加发布请求身份**

为 TrackProfileVersion 增加唯一 `publishRequestId`、`profileHash`、`backgroundHash`、`publishedByUserId`；建立 Actor relation 和索引。

- [ ] **Step 3: 实现发布动作**

```ts
export async function publishTrackProfileVersion(
  ctx: AuthContext | null,
  input: { publishRequestId: string; raceId?: string; profileJson: string; background: File }
): Promise<Result>;
```

顺序必须是鉴权 → 边界校验 → checksum → Zod/geometry → stage → Serializable transaction → finalize。任何失败都保留浏览器 Draft；底层异常不回传路径或堆栈。

- [ ] **Step 4: 实现补偿和孤儿清理记录**

事务失败调用 `discard()`；discard 失败写非公开运维事件，资产不进入 Public 引用。不得删除其他版本引用的正式资产。

- [ ] **Step 5: 验证发布测试**

Run: `$env:DATABASE_URL='file:./e2e.db'; npm.cmd test`

Expected: 全部 PASS。

### Task 5: 实现 Track 管理与 Round 显式绑定

**Files:**
- Create: `web/app/console/tracks/page.tsx`
- Modify: `web/app/console/page.tsx`
- Modify: `web/app/actions.ts`
- Modify: `web/lib/domain.ts`
- Modify: `web/lib/queries.ts`
- Test: `web/tests/track-publish.test.ts`

- [ ] **Step 1: 写失败测试**

测试 Organizer 只能查看/选择 system Track 和本 Race Track；pending Round 可绑定 published 版本；running/finished Round、draft/archived Track 均拒绝。

- [ ] **Step 2: 实现查询 DTO**

公开/Console DTO 只返回 trackId、name、version、status、preview/asset URL、checksum 和 publishedAt；不返回本地路径、发布 Actor 内部 ID 或 Validation 原始内部错误。

- [ ] **Step 3: 实现绑定动作**

```ts
export async function bindTrackVersionToRound(
  ctx: AuthContext | null,
  input: { raceRoundId: string; trackProfileVersionId: string }
): Promise<Result>;
```

只允许 pending Round，要求 same-race owner 或 system Track，并追加审计事件。

- [ ] **Step 4: 增加管理页面**

显示本地 Calibrator 入口、已发布版本、归属、checksum、绑定中的 Round 和不可变状态；不在列表页读取 IndexedDB。

- [ ] **Step 5: 验证**

Run:

```powershell
$env:DATABASE_URL='file:./e2e.db'
npm.cmd test
if ($LASTEXITCODE -eq 0) { npm.cmd run typecheck }
```

Expected: PASS。

### Task 6: 接通浏览器发布反馈和失败恢复

**Files:**
- Create: `web/components/track-calibrator/PublishPanel.tsx`
- Modify: `web/app/console/tracks/calibrator/TrackCalibratorClient.tsx`
- Modify: `web/app/actions.ts`
- Test: `web/e2e/track-calibrator.spec.ts`

- [ ] **Step 1: 写 E2E 失败测试**

覆盖本地保存 → 刷新恢复 → 校验 → 发布 → 服务端版本出现；重复版本失败后 Draft 仍存在；无权限直接构造发布请求被拒绝。

- [ ] **Step 2: 实现发布状态机**

UI 状态固定为 `editing | validating | ready | publishing | published | failed`；失败保留 Draft 和背景，不自动清理 IndexedDB；成功后展示服务端版本/hash，并提供“复制为新 Draft”。

- [ ] **Step 3: 增加明确反馈**

字段错误定位到 Profile/Background/Geometry/Permission/Version；不得展示服务器路径、SQL、Prisma 错误或堆栈。

- [ ] **Step 4: 运行 E2E**

Run:

```powershell
npm.cmd run test:e2e:prepare
if ($LASTEXITCODE -eq 0) { npx.cmd playwright test e2e/track-calibrator.spec.ts }
```

Expected: 全部 Calibrator 场景 PASS。

### Task 7: 文档、兼容与完整质量门

**Files:**
- Modify: `web/README.md`
- Modify: `docs/ary-domain-analysis.v0.3.md`
- Modify: `docs/ary-permission-matrix.md`
- Modify: `docs/ary-production-security-baseline.md`
- Modify: `PLAN.md`
- Modify: `STATUS.md`
- Modify: `PROGRESS.md`

- [ ] **Step 1: 文档化数据真实性边界**

明确 IndexedDB Draft 仅是未发布创作状态；服务端 TrackProfileVersion 和资产引用才是 ARY 事实源；清站点数据会丢失未导出 Draft；发布版本不可覆盖。

- [ ] **Step 2: 文档化本地浏览器验收**

写出 Organizer 登录、选择 Race、打开 Calibrator、保存/刷新、预览、校验、发布、绑定 pending Round 和 Race Live 加载新版本的准确 URL、按钮与预期状态。

- [ ] **Step 3: 运行完整质量门**

```powershell
npm.cmd run check:static
$env:DATABASE_URL='file:./e2e.db'; npm.cmd test
npm.cmd run typecheck
$env:DATABASE_URL='postgresql://ary:ary@127.0.0.1:5432/ary?schema=public'; npm.cmd run prisma:generate
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run check:production-config
```

Expected: 可用环境中的命令全部退出 0。一次性 PostgreSQL 必须验证全新库和已有 Race Live 基线库升级；没有数据库时如实记录未验收。

- [ ] **Step 4: 收口状态**

同步 PLAN、STATUS、PROGRESS；未获 commit 授权时写“未提交”，不得为了满足计划自行 commit、push 或 deploy。
