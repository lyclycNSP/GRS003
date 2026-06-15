# ARY CA Integration Spec

版本：v0.1
文档类型：Integration Spec
状态：草案定义中
上游入口：`ary-mvp.prd.md`
领域基线：`ary-domain-analysis.v0.3.md`

---

# 1. 当前状态

本文档用于定义 ARY MVP 的 CA 接入契约，包括实时骑行信号接入、接入状态、幂等规则、失败状态、Projection 输入和可观测性要求。GitHub Repo / 代码材料只作为作品代码入口或 Evidence 外部材料引用，不作为实时 CA 接入来源。

当前阶段先定义原始骑行状态消息草案，用于后续继续讨论和收敛。PRD 已明确产品级规则：

* 实时 CA 接入是骑行过程证据、Projection 输入和评审参考，不是参赛资格硬门禁。
* CAConnection 可在参赛过程中新增；每个 CAConnection 必须先登记和握手，后续数据才可进入有效证据链。
* RaceProject 聚合 CA 接入 failed / not_configured 表达证据缺口或接入异常，进入评审前风险提示，不自动取消 Registration 的提交、评审或 Award 资格。
* MVP 不接受事后上传 Session Summary 伪造实时 CA 证据。
* GitHub 代码材料不能替代实时 CA 接入。

后续进入架构设计时，应基于 PRD、领域基线和权限矩阵补全本文件。

后续契约至少需要覆盖：

* RaceProject / CAConnection Ingestion Status：not_configured、connected、active、failed。
* 参赛过程中 CAConnection 登记、握手和数据接收边界。
* 实时 Session 幂等接入。
* Session Summary 生成规则。
* 单个 CAConnection failed、部分 failed、全部 failed 如何影响 RaceProject 聚合状态、证据完整度和评审前风险提示。
* GitHub Repo / 代码材料如何作为 Work 或 Evidence 的外部 sourceRef，而不是 CA 接入来源。

---

# 2. CA 接入与 Agent Race 的关系

CA 是选手参加 Agent Race 的工具，也是比赛过程信号的来源。选手可以在同一场比赛中使用多个 CA，通过多个 connector 将多个 CA 接入赛事。选手在比赛中的关键骑行状态通过 connector push 到 ARY；当 ARY 需要完整 Session 快照时，从 CA 端 HTTP fetch。ARY 将原始信号和按需快照归一化、去重、聚合和投影，形成各模块需要的数据。

```text
Rider
  -> 使用 CA 完成比赛任务
  -> 一个 RaceProject 下接入一个或多个 CAConnection
  -> 各 CA connector push 关键骑行状态
  -> ARY 按需 HTTP fetch 对应 CAConnection 的 Session 快照
  -> ARY 接入层校验、幂等、归一化
  -> Riding Session / Task / Metrics
  -> Projection / Evidence / Report / Read Model
  -> Live Hall / Screen Console / Judge View / Rider Profile / Results
```

关键边界：

* CA 提供原始骑行信号，不直接写最终业务对象。
* ARY 拥有比赛事实、接入校验、Projection、Evidence、评审前风险提示和 Report 的生成规则。
* CA 数据是评判选手表现的重要数据源，但不直接替代人工评审和最终 Award。
* 一个 Registration 仍然最多对应一个 RaceProject；Registration approved 后由 ARY 幂等生成 RaceProject；RaceProject 是该选手在本场 Race 的骑行工作区，不等同于单个外部 CA Project。
* 一个 RaceProject 可以包含多个 CAConnection；每个 CAConnection 表达一个 CA / connector / 外部 CA Project 接入。
* 选手可在参赛过程中通过 ARY CA Connector 登记每个参赛 CA，形成 CAConnection；只有已登记、已握手、归属正确且未禁用的 CAConnection 后续数据可以进入 Projection、Evidence 或 Report 输入。
* connector push 只表达关键状态变化、风险、完成、阻塞解除等信号，不承担完整 Session 快照同步。
* ARY 需要完整 Session 快照时，从 CA 端 HTTP fetch；页面和评审模块读取 ARY 生成的 Projection、摘要、Evidence 或 Report。

---

# 3. CA 接入生命周期

## 3.1 CAConnection 登记与握手

CAConnection 登记与握手可发生在参赛过程中，目标是把选手准备使用的每个 CA 接入 ARY，并形成可追溯的 CAConnection 登记记录。

登记与握手规则：

* Rider 必须先拥有该 Race 的 approved Registration 和 RaceProject。
* Rider 可以为同一个 RaceProject 登记一个或多个 CAConnection。
* 每个 CAConnection 必须通过 ARY CA Connector 与 ARY 完成握手和状态校验。
* CAConnection 登记成功后，ARY 记录 `registeredAt`、`caType`、`connectorId`、`connectorVersion`、`caProjectId` 和 `ingestionStatus=connected`。
* GitHub Repo / 代码材料不能替代 CAConnection 登记。
* Race 处于 running / submitting 且尚未进入 judging 前，Rider 可继续新增 CAConnection；具体截止窗口由 Race Rules 另行定义。

## 3.2 实时接入阶段

实时接入阶段的目标是只接收已登记且握手成功 CAConnection 的骑行信号，并把这些信号作为比赛过程数据源。

实时接入规则：

* ARY 只接受已登记、已握手、归属正确 RaceProject、且未被禁用的 CAConnection push 骑行信号。
* 未登记、未握手、错误 RaceProject、错误 Registration 或被禁用的 CAConnection，其 push 消息不得进入有效比赛事实，只能拒收或进入隔离审计。
* 已登记 CAConnection 产生有效 Session 时，状态可从 connected 进入 active。
* 单个或全部 CAConnection failed 不触发 Registration 自动退赛；RaceProject 聚合状态用于表达接入健康度、证据完整度和评审前风险提示。
* 需要 Session 快照时，ARY 按 `caConnectionId + caSessionId` 从对应 connector HTTP fetch。

---

# 4. RaceProject 与 CAConnection

## 4.1 结构关系

```text
Registration
  -> RaceProject
       -> CAConnection 1
            -> Session A
            -> Session B
       -> CAConnection 2
            -> Session C
```

定义：

| 对象 | 说明 |
|---|---|
| Registration | 选手参加某场 Race 的报名事实，仍是参赛追溯中枢 |
| RaceProject | Registration 在本场 Race 的骑行工作区，承载聚合接入状态、聚合 Metrics 和 Projection 输入 |
| CAConnection | RaceProject 下的单个 CA 接入登记与运行实例，绑定一个 CA 类型、connector 和外部 CA Project |
| Session | CAConnection 下的一次 CA 协同过程 |

## 4.2 状态聚合规则

`CAConnection.ingestionStatus` 表达单个 CA 接入状态。完成握手后通常进入 connected；产生有效骑行 Session 后进入 active。`RaceProject.aggregateIngestionStatus` 表达该选手本场比赛的聚合接入健康度。MVP 不因为单个或全部 CAConnection 失败将 Registration 自动视为退赛。

| 场景 | RaceProject 聚合状态 | connectionHealth | Registration / 评审语义 |
|---|---|---|---|
| 没有任何 CAConnection | not_configured | no_signal | 可提交；生成无 CA 数据 / 证据缺口风险提示 |
| 至少一个 CAConnection connected，尚无 active session | connected | ok | 可等待开赛或继续接入确认 |
| 至少一个 CAConnection active | active | ok | 可继续比赛 |
| 部分 CAConnection failed，但仍有 connected / active | connected 或 active | partial_failed | 不自动退赛 |
| 全部 CAConnection failed，或规则截止时无可用连接 | failed | all_failed | 可提交和评审；生成接入异常 / 证据缺口风险提示 |

---

# 5. 原始骑行状态消息草案

## 5.1 消息用途

`RidingSignalMessage` 表达某个 Registration / RaceProject / CA Session 在某一时刻发生的关键骑行状态变化或说明性信号。它不是 Session 快照协议。

ARY 接收 `RidingSignalMessage` 前必须先校验 `ca.caConnectionId` 是否属于该 Registration / RaceProject 的已登记且握手成功 CAConnection。未登记、未握手、归属错误或被禁用 CAConnection 的消息不得进入有效 Projection、Evidence 或 Report 输入。

推荐将 push 消息分为两类：

| 类别 | 用途 | 示例 |
|---|---|---|
| event | 表达关键动作或状态变化 | 开始骑行、暂停骑行、完成任务、风险出现 |
| note | 表达说明性状态补充 | 阻塞解除说明、关键技术动作备注、需要 ARY 触发快照 fetch |

完整 Session 快照不通过 `RidingSignalMessage` 定期 push。ARY 需要快照时，应调用 CA connector 暴露的 HTTP fetch 接口。

## 5.2 基础字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| schemaVersion | string | 是 | 消息 schema 版本，当前建议 `ary.ca.riding_signal.v0.1` |
| messageId | string | 是 | connector 生成的消息 ID |
| idempotencyKey | string | 是 | 幂等键，用于重复 push 去重 |
| sequence | number | 建议 | 同一 CA Session 内递增序号 |
| timestamp | datetime | 是 | connector 观察到该状态的时间 |
| race.raceId | string | 是 | 赛事 ID |
| race.taskId | string | 是 | 比赛任务 ID，如 `DEV-12`、`PRD-2` |
| rider.registrationId | string | 是 | 选手本场比赛报名 ID |
| rider.raceProjectId | string | 是 | Registration 对应的 RaceProject ID |
| ca.caType | enum | 是 | `codex`、`claude_code`、`other` |
| ca.caConnectionId | string | 是 | RaceProject 下的单个 CA 接入实例 ID |
| ca.connectorId | string | 是 | connector 实例 ID |
| ca.connectorVersion | string | 建议 | connector 版本 |
| ca.caProjectId | string | 是 | 外部 CA Project 标识 |
| ca.caSessionId | string | 是 | 外部 CA Session 标识 |
| signal.type | enum | 是 | 骑行信号类型 |
| signal.kind | enum | 是 | `event` 或 `note` |
| signal.phase | enum | 建议 | `idle`、`riding`、`paused`、`finished` |
| signal.taskStatus | enum | 建议 | `not_started`、`in_progress`、`blocked`、`completed` |
| signal.progressPercent | number | 建议 | 0 到 100 的任务进度估计 |
| counters.tokens | number | 可选 | 消息发生时 connector 已观察到的累计 token；完整值以 HTTP fetch 快照为准 |
| counters.sessionCount | number | 可选 | 消息发生时 connector 已观察到的累计 session 数；完整值以 HTTP fetch 快照为准 |
| counters.messageCount | number | 可选 | 消息发生时 connector 已观察到的消息数；完整值以 HTTP fetch 快照为准 |
| counters.toolCallCount | number | 可选 | 消息发生时 connector 已观察到的工具调用数；完整值以 HTTP fetch 快照为准 |
| counters.allRidingMessageLength | number | 可选 | 消息发生时 connector 已观察到的累计骑行消息长度；完整值以 HTTP fetch 快照为准 |

## 5.3 signal.type 候选值

| signal.type | 说明 |
|---|---|
| riding_started | 开始骑行 |
| riding_paused | 暂停骑行 |
| riding_resumed | 恢复骑行 |
| riding_finished | 结束骑行 |
| task_started | 开始任务 |
| task_progress | 任务推进说明，仅用于表达阻塞解除、关键状态说明或需要 ARY 关注的非周期性进展；不用于定期进度推送 |
| task_completed | 完成任务 |
| task_blocked | 任务阻塞 |
| session_started | CA Session 开始 |
| session_completed | CA Session 结束 |
| cost_updated | 成本更新 |
| risk_detected | 风险出现 |
| milestone_reached | 里程碑完成 |
| validation_run | 测试、构建或验证运行 |
| artifact_linked | 代码、PR、Demo 等材料关联 |

## 5.4 样例 JSON

```json
{
  "schemaVersion": "ary.ca.riding_signal.v0.1",
  "messageId": "msg_01JZARY0001",
  "idempotencyKey": "codex:race_2026_demo:reg_008:conn_codex_001:session_abc:seq_42",
  "sequence": 42,
  "timestamp": "2026-06-14T10:18:32Z",
  "race": {
    "raceId": "race_2026_demo",
    "taskId": "DEV-12"
  },
  "rider": {
    "registrationId": "reg_008",
    "raceProjectId": "rp_008"
  },
  "ca": {
    "caConnectionId": "conn_codex_001",
    "caType": "codex",
    "connectorId": "codex_connector_001",
    "connectorVersion": "0.1.0",
    "caProjectId": "codex_project_xyz",
    "caSessionId": "codex_session_abc"
  },
  "signal": {
    "kind": "note",
    "type": "task_progress",
    "phase": "riding",
    "taskStatus": "in_progress",
    "progressPercent": 43,
    "noteReason": "unblocked"
  },
  "counters": {
    "tokens": 12344,
    "sessionCount": 23,
    "messageCount": 318,
    "toolCallCount": 57,
    "allRidingMessageLength": 122222
  },
  "technicalActions": [
    {
      "type": "file_changed",
      "count": 8
    },
    {
      "type": "test_run",
      "count": 3,
      "latestStatus": "failed"
    },
    {
      "type": "command_executed",
      "count": 12
    }
  ],
  "summary": {
    "currentGoal": "Implement DEV-12 registration eligibility gate",
    "latestActivity": "Added status transition check and ran tests",
    "riskLevel": "medium",
    "riskReason": "One failing test remains near task deadline"
  }
}
```

该样例表达一次非周期性的任务进展说明：选手从阻塞中恢复，connector 附带当时已观察到的 counters。若 ARY 需要完整 Session 过程快照，应随后调用 HTTP fetch 接口。

## 5.5 状态失败消息样例

```json
{
  "schemaVersion": "ary.ca.riding_signal.v0.1",
  "messageId": "msg_01JZARY0002",
  "idempotencyKey": "codex:race_2026_demo:reg_008:connection_failed:20260614T102000Z",
  "timestamp": "2026-06-14T10:20:00Z",
  "race": {
    "raceId": "race_2026_demo",
    "taskId": "DEV-12"
  },
  "rider": {
    "registrationId": "reg_008",
    "raceProjectId": "rp_008"
  },
  "ca": {
    "caConnectionId": "conn_codex_001",
    "caType": "codex",
    "connectorId": "codex_connector_001",
    "connectorVersion": "0.1.0",
    "caProjectId": "codex_project_xyz",
    "caSessionId": "codex_session_abc"
  },
  "signal": {
    "kind": "event",
    "type": "risk_detected",
    "phase": "paused",
    "taskStatus": "blocked"
  },
  "ingestion": {
    "status": "failed",
    "statusReason": "ca_session_permission_denied",
    "lastSyncedAt": "2026-06-14T10:20:00Z",
    "scope": "ca_connection"
  }
}
```

该样例只表示 `conn_codex_001` 这个 CAConnection 接入失败。若同一 RaceProject 下仍有其他 CAConnection 处于 connected 或 active，RaceProject 聚合状态可保持 connected 或 active；若全部 CAConnection failed 或规则截止时无可用连接，RaceProject 聚合状态进入 failed，并生成接入异常 / 证据缺口风险提示，但 Registration 不自动退赛。

---

# 6. Session 快照 fetch

当 ARY 需要完整 Session 快照时，由 ARY 主动向 CA connector 发起 HTTP fetch。fetch 的返回值用于补齐或重建 Metrics、Evidence、Projection 和 Report 输入。

ARY 发起 fetch 前必须确认 `caConnectionId` 是该 RaceProject 下已登记且握手成功的 CAConnection。未登记、未握手、归属错误或被禁用 CAConnection 的 snapshot 不得进入有效比赛数据。

```text
GET /ary/ca/connections/{caConnectionId}/sessions/{caSessionId}/snapshot
```

建议返回结构：

```json
{
  "schemaVersion": "ary.ca.session_snapshot.v0.1",
  "fetchedAt": "2026-06-14T10:18:36Z",
  "ca": {
    "caConnectionId": "conn_codex_001",
    "caType": "codex",
    "caProjectId": "codex_project_xyz",
    "caSessionId": "codex_session_abc"
  },
  "session": {
    "startedAt": "2026-06-14T09:02:11Z",
    "endedAt": null,
    "lastActiveAt": "2026-06-14T10:17:58Z",
    "messageCount": 318,
    "toolCallCount": 57,
    "tokens": 12344,
    "allRidingMessageLength": 122222
  },
  "task": {
    "taskId": "DEV-12",
    "taskStatus": "in_progress",
    "progressPercent": 43
  },
  "technicalActions": [
    {
      "type": "file_changed",
      "count": 8
    },
    {
      "type": "test_run",
      "count": 3,
      "latestStatus": "failed"
    }
  ],
  "summary": {
    "currentGoal": "Implement DEV-12 registration eligibility gate",
    "latestActivity": "Added status transition check and ran tests",
    "riskLevel": "medium",
    "riskReason": "One failing test remains near task deadline"
  }
}
```

快照 fetch 约束：

* fetch 由 ARY 主动触发，可用于 Live Hall 刷新、Projection 重建、评审摘要生成和 Report 输入补齐。
* push 消息中的 counters 是事件附带观测值，不作为完整快照。
* CA connector 应支持基于 `caConnectionId + caSessionId` 获取当前快照。
* ARY 应对 fetch 结果做版本记录或时间戳记录，避免用较旧快照覆盖较新 Projection 输入。

---

# 7. ARY 投影出口

ARY 接收原始 `RidingSignalMessage` 后，至少投影出以下数据：

| 投影 / 数据 | 用途 |
|---|---|
| CAConnection Ingestion Status | 展示单个 CA 接入状态、定位 connector 异常 |
| RaceProject Aggregate Ingestion Status | 聚合多个 CAConnection 状态，驱动接入健康度、证据完整度和评审前风险提示 |
| Session | 记录 CAConnection 下的 CA Session 生命周期 |
| Session Summary | 生成 Evidence 的 session_summary 来源 |
| Riding Metrics | 分 CAConnection 和 RaceProject 聚合两层生成成本、进度、风险、基础骑行能力摘要 |
| race_progress_projection | Live Hall / Screen Console 的赛事过程进度 |
| registration_status_projection | Rider View / Organizer View 的参赛状态 |
| cost_projection | Live Hall / Screen Console 成本展示 |
| risk_projection | Live Hall / Organizer View 风险展示 |
| event_stream_read_model | Live Hall / Screen Console 关键事件流 |
| screen_feed_projection | 大屏展示聚合 feed |
| Evidence | 评审、报告、Rider Profile 的能力证据 |
| Report 输入 | rider_report、race_report、review_summary 的素材 |

这些投影可以重算，且不作为最终赛果事实源。最终赛果仍读取 Award、Report 或 leaderboard_read_model。
