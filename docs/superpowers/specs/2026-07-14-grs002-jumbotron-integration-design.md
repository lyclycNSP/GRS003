# GRS002 Jumbotron 接入 GRS003 设计规格

## 1. 目标

将 GRS002 已完成的 Race Live 大屏、Track Calibrator、赛道契约和几何运行时接入 GRS003，使大屏由 ARY 的 Race、Registration、RaceProject、CA、Projection 和权限数据驱动，并在 ARY 内完成赛道本地创作、服务端校验发布和不可变版本绑定，同时保留现有 Screen Console、公告、作品展示和稳定 Projection fallback。

本设计只确定接入边界、核心实体、快照契约、权限和运行规则，不实施业务代码。

## 2. 范围

### 2.1 总体包含

- 迁入 GRS002 Race Live 的可复用 React 组件、contracts、track-profile 和 track-runtime。
- 接入两条内置已发布赛道及其 Track Profile。
- 建立 GRS003 领域数据到版本化大屏快照的 Projection Builder。
- 在同一个 RaceRound 中把 Racer 分成多个 ScreenDisplayGroup，每组最多 8 个。
- 自动轮播展示组，并允许 Organizer 暂停、继续、上一组和下一组。
- 保留 live、leaderboard、works、announcement 四种展示模式。
- 支持非法快照隔离、最后稳定 Projection 和 fallback。
- 继续使用 GRS003 服务端认证、Race-scoped 授权和 Public DTO 边界。
- 迁入 GRS002 Track Calibrator，作为 ARY 内独立的 Organizer 工具页面。
- Calibrator Draft 和背景 Blob 保存在浏览器 IndexedDB；发布时由服务端重新校验并创建不可变 TrackProfileVersion。
- Race Live 与 Calibrator Preview 复用同一套 track-profile 和 track-runtime。

### 2.2 分阶段交付

第一阶段交付 Race Live、共享 Runtime、内置赛道、AryRaceLiveProjectionBuilder、自动轮播和现有 Screen 模式兼容。

第二阶段交付 Track Calibrator 页面、IndexedDB Draft、服务端发布、赛道版本管理和 Round 绑定。第二阶段不重新设计几何运行时，而是直接复用第一阶段迁入的 track-profile 和 track-runtime。

### 2.3 总体不包含

- Calibrator Draft 跨设备同步、多人协同编辑、编辑锁和冲突合并。
- Coach 角色或 Coach 授权。
- Cockpit 实体、Cockpit URL 或 Cockpit Navigation。
- WebSocket / SSE；第一阶段允许短轮询，传输层不得进入展示组件。
- 公开原始 CA 消息、Agent 对话、代码产物、内部 ReviewFlag 摘要或连接凭据。
- 仓库抓取、恶意代码扫描、Demo 沙箱或其他作品内容安全能力。

## 3. 统一术语与实体

| 统一概念 | GRS003 事实来源 | 说明 |
| --- | --- | --- |
| Race | Race | 对应 GRS002 Competition，不新增 Competition |
| RaceRound | 新增结构化实体 | 真实比赛轮次，不等于提交窗口，也不因大屏分页拆分 |
| Racer / Entry | Registration + RaceProject | 同时支持个人和团队参赛 |
| ScreenDisplayGroup | 大屏快照内的展示分组 | 同一个 Round 内的纯展示概念，每组最多 8 个 Entry |
| TrackProfileVersion | 新增不可变赛道版本 | Round 开始后不可切换 |
| ScreenProjection | Projection 的版本化大屏类型 | 保存通过契约校验的当前画面快照 |
| AttentionItem | ReviewFlag 的公开展示投影 | 只包含允许公开的事实摘要 |
| RidingMessage | CA Signal / Session 的展示投影 | 不公开原始消息和内部载荷 |

Coach 在线下通过独立 Cockpit 工具参与协作；该角色、工具和协作状态均不进入 ARY 领域模型、权限模型或大屏契约。

### 3.1 命名分层

并入后不保留一套与 ARY 重复的 GRS002 业务模型。命名按三层管理：

1. **ARY 领域实体**：数据库和业务事实使用 Race、RaceRound、Registration、RaceProject、RaceRoundEntry、ReviewFlag、ScreenProjection、ScreenState 和 TrackProfileVersion。
2. **大屏只读 DTO**：渲染契约使用 AryRaceLiveSnapshot、RaceLiveRaceSnapshot、RaceLiveRoundSnapshot、AryRaceLiveEntrySnapshot、RaceLiveMessageSnapshot、RaceLiveAttentionSnapshot 和 RaceLiveKpiSnapshot。
3. **通用赛道运行时**：保留 TrackProfile、TrackBundle、CompiledTrack、TrackSample、HorsePose、LaneDefinition、Checkpoint、MessageZone、NoBubbleZone、compileTrack()、sampleHorsePose() 和 validateTrackGeometry()。

Competition、RacingEntry 和 JumbotronAuthorizationContext 不作为新的 ARY 持久化实体。Competition 映射到 Race；RacingEntry 的领域身份由 RaceRoundEntry 表达；授权继续使用 GRS003 AuthContext 和服务端 Race-scoped 校验。

## 4. 领域模型

### 4.1 RaceRound

RaceRound 表示一场 Race 内的真实比赛轮次：

```text
RaceRound
├── id
├── raceId
├── name
├── order
├── status: pending | running | finished
├── scheduledStartAt
├── scheduledEndAt
├── actualStartedAt?
├── actualEndedAt?
├── trackProfileVersionId
└── createdAt / updatedAt
```

约束：

- `raceId + order` 唯一。
- 同一 Race 最多一个 running Round。
- finished Round 不可重新开启。
- Round 开始后固定 TrackProfileVersion。
- Round 生命周期与作品提交窗口、JudgeAssignment 和 Award 生命周期相互独立。

### 4.2 RaceRoundEntry

RaceRoundEntry 将 Registration 放入 Round，并保存稳定展示身份：

```text
RaceRoundEntry
├── id
├── raceRoundId
├── registrationId
├── raceProjectId
├── displayOrder
└── createdAt
```

Lane 不作为跨组全局身份。Projection Builder 根据 ScreenDisplayGroup 内顺序稳定分配 `lane-1` 至 `lane-8`。

约束：

- `raceRoundId + registrationId` 唯一。
- Registration 必须属于相同 Race，且状态为 approved。
- 必须存在对应 RaceProject。
- 一个 Round 可以包含超过 8 个 Racer。

### 4.3 TrackProfileVersion

```text
TrackProfile
├── ownerRaceId? // null 表示 Admin 管理的系统内置赛道
├── createdByUserId
└── TrackProfileVersion
    ├── id
    ├── trackId
    ├── schemaVersion
    ├── version
    ├── status: published | archived
    ├── profileJson
    ├── backgroundAssetRef
    ├── checksum
    ├── validationReportJson
    └── publishedAt
```

约束：

- `trackId + version` 唯一。
- Race Live 只接受 published 版本。
- profile 与背景作为同一发布单元校验和启用。
- 数据库存储资产引用与 checksum，不保存大型 Base64 图片。
- 已被 pending/running Round 使用的版本不可归档。
- Organizer 创建的 TrackProfile 必须绑定其 managed Race；系统内置赛道由 Admin 管理，可供所有 Race 选择。
- 浏览器 Draft 不是服务端领域实体，未发布前不进入 Prisma 数据库或 Public API。

### 4.4 Calibrator 本地 Draft

Calibrator 作为 ARY Next.js 内的独立 Client 页面运行，但不建立独立服务。建议入口：

```text
/console/tracks?raceId=<raceId>
/console/tracks/calibrator?raceId=<raceId>
```

IndexedDB 保存：

```text
CalibratorDraft
├── draftId
├── targetRaceId
├── trackId
├── proposedVersion
├── profileJson
├── backgroundAssetId
├── dirty
├── lastValidationReport
└── updatedAt

BackgroundAsset
├── assetId
├── blob
├── contentType
├── width / height
├── size
└── checksum
```

规则：

- Draft 只属于当前浏览器站点数据，清理 IndexedDB 会删除未发布草稿。
- 页面应提供 Profile JSON 和完整草稿包导出，作为本地备份。
- 发布版本只读；继续编辑时复制为新的本地 Draft 和新版本号。
- Calibrator Preview 必须直接调用共享 track-runtime，不维护第二套坐标和 HorsePose 算法。
- 服务端返回的已发布版本元数据可以被本地 Draft 引用，但浏览器不能原地覆盖已发布版本。

### 4.5 服务端发布

发布流程：

```text
IndexedDB Draft + Background Blob
  → Organizer 发起发布
  → 服务端 Race-scoped 鉴权
  → 文件类型、大小、尺寸和 checksum 校验
  → Track Profile Zod + Geometry Validation
  → 背景资产写入暂存区
  → 数据库事务创建 TrackProfile / TrackProfileVersion
  → 资产转为正式引用
  → 返回不可变发布版本
```

约束：

- 不新增匿名或公开写入 REST API；通过受保护 Server Action 或同等服务端入口发布。
- 服务端必须重新计算 checksum，不信任浏览器提交的 checksum 和 Validation Report。
- `trackId + version` 冲突时拒绝覆盖，提示创建新版本。
- Profile 与背景必须作为同一发布单元成功；失败时不得产生可绑定的半成品版本。
- 数据库事务失败后，暂存资产应尽力清理；未清理成功的对象进入孤儿资产回收，不对 Public 暴露。
- 发布成功不自动修改 running Round，也不自动绑定到任何 Round。
- Organizer 只能向其 managed Race 发布 race-owned Track；Admin 可以发布和维护系统内置 Track。

## 5. 大屏快照契约

### 5.1 AryRaceLiveSnapshot

```ts
interface AryRaceLiveSnapshot {
  schemaVersion: "ary.race-live.v1";
  raceId: string;
  roundId: string;
  sequence: number;
  generatedAt: string;

  race: RaceLiveRaceSnapshot;
  round: RaceLiveRoundSnapshot;
  runtimeConfig: RaceLiveRuntimeConfig;
  kpi: RaceLiveKpiSnapshot;

  totalEntryCount: number;
  entries: AryRaceLiveEntrySnapshot[];
  displayGroups: ScreenDisplayGroup[];
  globalRanking: GlobalRankingItem[];
  ridingMessages: RaceLiveMessageSnapshot[];
  attentionItems: RaceLiveAttentionSnapshot[];
}
```

完整快照包含本 Round 全部 Entry。每次只把当前 ScreenDisplayGroup 的 Entry 传给赛道几何运行时；TOP3、KPI 和全局排名仍按全部 Entry 计算。

### 5.2 ScreenDisplayGroup

```ts
interface ScreenDisplayGroup {
  groupId: string;
  order: number;
  entryIds: string[]; // 1 到 8 个
}
```

分组规则：

1. 按 RaceRoundEntry.displayOrder 和稳定 ID 排序。
2. 每 8 个切分一组。
3. 相同 RoundEntry 集合必须生成相同分组和 groupId。
4. Entry 增删后重新生成 Projection；运行中的 Round 默认禁止随意增删 Entry。
5. Lane 在组内按顺序稳定映射为 `lane-1` 至 `lane-8`。

### 5.3 AryRaceLiveEntrySnapshot

```ts
interface AryRaceLiveEntrySnapshot {
  entryId: string;
  registrationId: string;
  raceProjectId: string;

  participantType: "individual" | "team";
  entrantDisplayName: string;
  teamId?: string;
  participantCount: number;
  onlineParticipantCount: number;

  rank: number;
  roundProgress: number;
  phaseProgress?: number;
  overallProgress: number;
  reachedProgressAt: string;

  raceStatus: "idle" | "running" | "blocked" | "finished";
  dataStatus: "fresh" | "stale";
  riskLevel: "none" | "low" | "medium" | "high" | "critical";

  agentProviders: Array<"codex" | "claude" | "other">;
  costTokens?: number;
  updatedAt: string;
}
```

### 5.4 进度语义

- `roundProgress`：唯一驱动当前 Round 马匹位置和 Round 排名。
- `phaseProgress`：当前 Phase 完成度，Phase 切换时允许重置。
- `overallProgress`：跨 Phase、跨 Round 的项目总完成度，只允许单调增加。
- Projection Builder 必须基于明确 CA / RaceProject 事实生成进度；展示层不得自行分析 Session 原始 JSON。
- 同一 Round 的新 Projection 不得让已接受的 `roundProgress` 倒退。
- stale 只表示数据不新鲜，不得自动解释为 blocked。

### 5.5 Attention 与 Riding Message

- ReviewFlag 可以投影为 risk、obstacle 或 violation。
- Attention source 支持 participant、organizer 和 system。
- `judgeVisibleSummary` 不直接公开；大屏只接收经过 allowlist 的事实摘要。
- CA Signal、Session 原始载荷、Agent 对话、connectorId、signingKeyId 和内部用户 ID 不进入公开快照。
- 当前组 Entry 的消息可显示气泡；全局 high/critical Attention 可以进入 ticker。
- 没有安全气泡位置时降级到 ticker，不遮挡主要赛道信息。

## 6. Projection 与数据流

```text
Race / RaceRound / Registration / RaceProject
CAConnection / Session / ReviewFlag
                │
                ▼
      Screen Projection Builder
                │
       Zod + 领域规则校验
                │
                ▼
     stable ScreenProjection payload
                │
                ▼
       Public Screen Snapshot DTO
                │
                ▼
  Race Live Controller + track-runtime
```

ScreenProjection 在现有 Projection 基础上增加：

```text
schemaVersion
sequence
generatedAt
sourceWatermark
payloadHash
```

约束：

- `raceId + type + sequence` 唯一。
- sequence 在同一 Race 生命周期内单调递增，切换 Round 不重置。
- payload 通过 Zod 和领域校验后才能标记 stable。
- 失败 Projection 不覆盖 stableVersionId。
- Public API 使用显式字段 allowlist，不返回 Projection 内部错误、ReviewFlag 内部摘要或 Actor 信息。

## 7. 自动轮播与 ScreenState

ScreenState 调整为：

```text
mode: live | leaderboard | works | announcement
fallbackEnabled
fallbackReason?
activeDisplayGroupOrder
autoRotateEnabled
rotationIntervalSeconds
rotationEpochAt
rotationPausedAt?
activeProjectionId?
lastStableProjectionId?
updatedByUserId?
updatedAt
```

规则：

- fallback 是数据源降级状态，不是 mode。
- 自动轮播默认启用，所有屏幕基于同一 rotationEpochAt 和 interval 计算当前组，不按轮播节拍持续写数据库。
- Organizer 点击暂停时固化当前 group order。
- Organizer 点击上一组、下一组或继续时更新 active group 和 rotation epoch。
- 只有一个分组时不轮播。
- 新 Projection 改变分组数量时，对 active group 做合法化并重置 rotation epoch。
- leaderboard、works 和 announcement 模式不参与 Racer 分组轮播。

## 8. 权限

| 操作 | Public/Rider/Judge | Organizer | Admin |
| --- | --- | --- | --- |
| 查看公开大屏 | 允许 | 允许 | 允许 |
| 查看 Screen 状态 | 只读公开状态 | 管理的 Race | 所有 Race |
| 暂停/继续自动轮播 | 禁止 | 管理的 Race | 所有 Race |
| 上一组/下一组 | 禁止 | 管理的 Race | 所有 Race |
| 调整轮播间隔 | 禁止 | 管理的 Race | 所有 Race |
| 切换展示模式 | 禁止 | 管理的 Race | 所有 Race |
| 发布现场公告 | 禁止 | 管理的 Race | 所有 Race |
| 启用 fallback | 禁止 | 管理的 Race | 所有 Race |
| 使用 Calibrator 编辑本地 Draft | 禁止 | 管理的 Race | 所有 Race |
| 发布 race-owned Track 版本 | 禁止 | 管理的 Race | 所有 Race |
| 发布系统内置 Track 版本 | 禁止 | 禁止 | 允许 |
| 跨赛事应急接管 | 禁止 | 禁止 | 必须填写原因 |

权限原则：

- Organizer owns，Admin overrides，其他角色只读。
- Organizer 必须通过 managedRaceIds 的精确匹配。
- Admin 不作为日常控制角色；跨赛事接管和强制 fallback 必须填写原因。
- 所有写操作在服务端再次鉴权，前端隐藏按钮不构成授权。
- 关键控制动作追加 ScreenControlAuditEvent，不覆盖历史事件。

## 9. 接入架构

采用“迁入纯运行时包和组件 + AryRaceLiveProjectionBuilder”，不使用 iframe、Git 子模块或跨仓运行时依赖。

```text
GRS003 domain
  → AryRaceLiveProjectionBuilder
  → AryRaceLiveSnapshot
  → RaceLiveViewModelMapper
  → Race Live components
  → track-profile + track-runtime

Organizer browser
  → Track Calibrator + IndexedDB Draft
  → protected publish action
  → TrackProfileVersion + asset storage
```

边界：

- Next.js 负责路由、服务端查询、鉴权、Public API 和 Server Actions。
- AryRaceLiveProjectionBuilder 读取 GRS003 领域事实，计算进度、排名、展示分组和公开摘要，经校验后保存 ScreenProjection；它不消费任何运行中的 GRS002 服务数据。
- RaceLiveViewModelMapper 只处理 DTO 到展示组件输入的纯映射，不读取数据库或重新解释业务事实。
- Race Live React 组件只消费已验证 View Model。
- Track Calibrator 是同一 Next.js 部署中的独立 Client 模块，不是独立服务。
- track-profile 和 track-runtime 保持纯 TypeScript、确定性、无网络和数据库依赖。
- 赛道背景等静态资产由 GRS003 资产目录或对象存储提供。
- 轮询、未来 SSE/WebSocket 和重连逻辑封装在 Snapshot Gateway Adapter 中。

## 10. 错误与降级

- Snapshot schema 不兼容：拒绝新快照，保留最后稳定画面并显示非敏感异常标记。
- sequence 重复或倒退：忽略。
- roundProgress 倒退：保留已接受进度并记录 Projection 构建错误。
- Track Profile 缺失或 checksum 不匹配：不启用新 Projection，使用最后稳定赛道版本。
- 当前 Projection 失败：保持原 mode，开启 fallback 数据源，不强制切换成 fallback 页面。
- 没有 stable Projection：使用静态公告/公开作品的最小安全画面。
- 分组为空：展示“等待 Racer 数据”，不伪造参赛者。
- Entry 超过新鲜度阈值：标记 stale，停止前进动画。
- Public DTO 构建失败：返回安全错误，不返回 payloadJson、数据库错误或内部路径。
- IndexedDB 保存失败：保留内存 Draft，提示导出本地备份，不尝试直接发布未知状态。
- 服务端发布校验失败：保留本地 Draft，返回字段级问题，不创建 TrackProfileVersion。
- 资产上传成功但数据库事务失败：版本不可见，暂存资产进入清理流程。

## 11. 测试与验收

### 11.1 契约和领域测试

- Race 到 Snapshot 的 ID 映射稳定。
- 个人和团队 Registration 都能生成 Entry。
- 9、16、17、36 个 Entry 分别生成 2、2、3、5 个展示组，每组不超过 8 个。
- 相同输入产生相同 groupId、顺序和 lane。
- 全局 TOP3 不因当前展示组改变。
- Round 内进度、sequence 和 overallProgress 单调规则生效。
- ReviewFlag 公开投影不泄露 judgeVisibleSummary 和 sourceRefJson。
- 非法 Snapshot、Track Profile 和重复 sequence 被拒绝。
- failed Projection 不覆盖 stable Projection。

### 11.2 权限测试

- Public、Rider、Judge 不能操作大屏。
- Organizer 只能操作 managed Race。
- Organizer 精确 ID 匹配，拒绝子串或跨赛事授权。
- Admin 可以应急接管，但无原因时拒绝。
- 控制动作产生追加式审计事件。

### 11.3 自动轮播测试

- 多个 Display 实例根据相同 rotation epoch 得到相同当前组。
- 到达 interval 后自动切换下一组并循环。
- 暂停后组不变化。
- 上一组/下一组更新 group order 并重置 epoch。
- 只有一个组时不轮播。
- Projection 改变分组数量后 active group 保持合法。

### 11.4 浏览器与视觉验收

- 1920×1080 和 1366×768 无溢出。
- 8 匹马、标签、气泡和小地图使用同一 CompiledTrack。
- 个人与团队名称正确显示。
- 组切换期间不混入上一组马匹、气泡或 lane 状态。
- mode 切换、公告和 fallback 保持现有 Screen E2E 行为。
- Public 响应不包含内部用户 ID、审计事件、原始 CA 载荷或私有 ReviewFlag。

### 11.5 Calibrator 与发布验收

- Draft、背景 Blob 和 Validation Report 刷新后可从 IndexedDB 恢复。
- Draft 可导出备份；清理站点数据后未发布 Draft 不再存在。
- Centerline、lane、checkpoint 和 zone 编辑继续复用 GRS002 已有交互和验证。
- Calibrator Preview 与 Race Live 对相同 Track Profile 和输入输出相同 HorsePose。
- Organizer 不能为未管理 Race 发布 Track。
- 服务端拒绝非法 Schema、异常几何、伪造 checksum、超限图片和重复版本号。
- 发布失败不删除本地 Draft，不产生可绑定的半成品版本。
- 发布成功后 TrackProfileVersion 不可更新或覆盖。
- pending Round 可以显式选择允许使用的发布版本；running/finished Round 不可换 Track。

## 12. 数据迁移与兼容

- 现有 Race 默认不自动伪造 RaceRound；由 Organizer 显式创建或 Seed 创建演示 Round。
- 现有 ScreenState 迁移时将 mode=fallback 转换为 mode=live + fallbackEnabled=true。
- 现有 stable Projection 保持可读，但没有 schemaVersion/sequence 的记录视为 legacy，不直接送入新版 Race Live。
- 内置 GRS002 Track Profile 作为明确的 published v1 资产导入，不把浏览器 IndexedDB 当作生产事实源。
- Calibrator 的 IndexedDB 只保存未发布创作状态；发布后的服务端版本和资产引用才是 ARY 事实源。
- 原有 leaderboard、works、announcement 页面和 Public API 保持兼容。

## 13. 已确认决策

1. 同一个 Round 内按 ScreenDisplayGroup 分批展示，每组最多 8 个 Racer；不为大屏分页创建额外 Round。
2. 自动轮播默认启用。
3. Organizer 负责所管理 Race 的日常大屏控制；Admin 只做全局应急接管。
4. Coach 和 Cockpit 与 ARY 平台无关，不进入本次模型、契约或权限。
5. 采用 AryRaceLiveProjectionBuilder + 迁入纯运行时包/组件，不采用 iframe 或子模块；GRS002 不再作为运行时数据服务。
6. Race Live 与 Track Calibrator 都迁入同一个 ARY Next.js 部署，但保持独立模块边界。
7. Calibrator 使用浏览器 IndexedDB 保存本地 Draft，通过受保护服务端入口校验并发布不可变 TrackProfileVersion。
8. 第一阶段暂缓实时推送、Draft 跨设备同步、多人编辑和原始 CA 消息公开展示。
