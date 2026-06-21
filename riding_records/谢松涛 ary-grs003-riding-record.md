# ARY GRS003 Riding Record

文档类型：Riding Record  
状态：已完成  
关联Race：`race_gba_happy_tour_2026`  
关联Registration：`reg_rider_001`  
关联RaceProject：`rp_rider_001`  
关联CAConnection：`conn_codex_main_001`、`conn_codex_backup_001`  
生成日期：2026-06-21  

说明：本文记录ARY项目中一名Rider从报名、接入CA、提交Work、接受评审到赛后报告发布的完整骑行过程，用于呈现RaceProject、CAConnection、Evidence、Projection、Work、Judge、Award和Report之间的追溯关系。

---

# 1.输入Race约束与Riding目标

Rider首先向Agent输入赛事目标：在`湾区开心游`Race中完成一个面向游客的三条路线推荐Demo，要求同时覆盖早茶、海岸、夜景三类场景，并能在Works页面公开展示。

## Rider输入

```text
我要参加湾区开心游赛道，作品先叫GBA WanderMate。
目标是做一个轻量Demo：用户选择预算、时间和偏好后，系统给出三条湾区路线。
需要有可公开Demo、Repo、作品摘要和骑行过程证据。
```

## Agent执行

Agent把任务拆成四个阶段：

| 阶段 | 目标 | 输出 |
|---|---|---|
| `plan` | 梳理赛题、用户场景和提交要求 | 任务拆解、风险清单 |
| `build` | 生成Demo页面和路线推荐逻辑 | Demo、Repo提交 |
| `verify` | 跑通基础交互、修正布局和文案 | 验证记录 |
| `submit` | 整理Work、Evidence和公开摘要 | Work草稿、提交记录 |

## Rider判断

Rider确认“作品先可演示，再补精细推荐算法”的策略可接受，并要求Agent在每个阶段推送关键骑行信号，不做周期性流水刷屏。

## Harness表现

Harness记录初始目标、任务拆分和第一条`riding_started`信号；此时RaceProject尚未接入有效Session，聚合状态为`connected`。

---

# 2.Registration审核与RaceProject生成

Rider完成GitHub登录和资料补全后提交报名。Organizer审核通过后，ARY为该Registration幂等生成RaceProject。

## Rider输入

```text
我已用GitHub登录并补完资料，请帮我进入赛道工作区。
```

## Agent执行

Agent在Race Console中完成以下动作：

| 动作 | 结果 |
|---|---|
| `submitRegistration` | 创建`reg_rider_001`，状态为`submitted` |
| `approveRegistration` | 审核通过，状态变为`approved` |
| `ensureRaceProject` | 生成`rp_rider_001`，重复调用仍返回同一个项目 |

## Rider判断

Rider确认工作区已经出现，且同一Race不会重复报名、重复生成多个RaceProject。

## Harness表现

Harness记录`RegistrationApproved`和`RaceProjectBound`，并把`rp_rider_001`作为后续CAConnection、Work和Evidence的追溯中枢。

---

# 3.CAConnection登记与握手

Rider为本场Race登记两个CAConnection：主连接负责主要开发，备份连接用于排查和修复。

## Rider输入

```text
主CA用Codex，项目标识是codex-gba-wandermate。
我还想加一个备份Codex连接，方便后面做布局和验证修复。
```

## Agent执行

Agent登记并握手两个连接：

| CAConnection | 用途 | 状态 |
|---|---|---|
| `conn_codex_main_001` | 主开发Session | `active` |
| `conn_codex_backup_001` | 备份修复Session | `connected` |

握手通过后，ARY只接受这两个连接中归属正确、未禁用、已握手的信号。GitHub Repo只作为Work代码材料引用，不替代实时CA接入。

## Rider判断

Rider确认主连接进入`active`后可以开始产生有效Evidence；备份连接只保持`connected`，暂不影响整体健康度。

## Harness表现

Harness把RaceProject聚合状态更新为`active`，connectionHealth为`ok`。未登记连接的信号会进入隔离审计，不进入Projection或Report输入。

---

# 4.接收RidingSignal并生成Session Summary

主连接开始推送关键状态变化，ARY把信号归一化为Session、Evidence和Projection输入。

## Agent执行

首条有效信号如下：

```json
{
  "schemaVersion": "ary.ca.riding_signal.v0.1",
  "messageId": "msg_riding_0001",
  "idempotencyKey": "codex:race_gba_happy_tour_2026:reg_rider_001:conn_codex_main_001:session_001:seq_1",
  "sequence": 1,
  "timestamp": "2026-06-21T10:05:00+08:00",
  "race": {
    "raceId": "race_gba_happy_tour_2026",
    "taskId": "DEV-2"
  },
  "rider": {
    "registrationId": "reg_rider_001",
    "raceProjectId": "rp_rider_001"
  },
  "ca": {
    "caConnectionId": "conn_codex_main_001",
    "caType": "codex",
    "connectorId": "codex_connector_001",
    "connectorVersion": "0.1.0",
    "caProjectId": "codex-gba-wandermate",
    "caSessionId": "session_001"
  },
  "signal": {
    "kind": "event",
    "type": "task_started",
    "phase": "riding",
    "taskStatus": "in_progress",
    "progressPercent": 12
  },
  "counters": {
    "tokens": 4200,
    "sessionCount": 1,
    "messageCount": 34,
    "toolCallCount": 9,
    "allRidingMessageLength": 18500
  },
  "summary": {
    "currentGoal": "完成GBA WanderMate第一版公开Demo",
    "latestActivity": "已创建路线卡片和基础偏好控制",
    "riskLevel": "low",
    "riskReason": "核心交互仍较轻量，但Demo范围清晰"
  }
}
```

## Rider判断

Rider确认这条信号只表达关键进展，不上传完整原始Session。完整快照由ARY在需要时通过connector fetch。

## Harness表现

Harness生成`session_summary`类型Evidence，公开端只展示摘要；原始CA Session默认不公开。

---

# 5.处理无效CA信号与接入异常

开发过程中出现一次来自未登记连接的信号，以及一次备份连接权限失效。

## Agent执行

ARY执行两类处理：

| 场景 | 处理结果 |
|---|---|
| 未登记`conn_unknown_404`推送信号 | 写入`quarantinedSignals`，不生成Evidence |
| `conn_codex_backup_001`权限失效 | 标记单连接`failed`，生成`ingestion_exception`ReviewFlag |

## Rider判断

Rider确认备份连接失败不影响主连接继续比赛，也不取消Work提交、评审或Award资格。

## Harness表现

Harness维持RaceProject聚合状态为`active`，connectionHealth变为`partial_failed`，并在评审前风险提示中标出“备份CAConnection接入异常，主Session证据仍可用”。

---

# 6.Projection重建与Live Hall展示

ARY根据有效Session、Metrics和Work草稿重建`race_progress_projection`，供Live Hall和Screen Console读取。

## Agent执行

Agent触发Projection重建，输出以下摘要：

| Projection项 | 内容 |
|---|---|
| 进度 | Demo结构完成，路线推荐逻辑进入验证 |
| 成本 | token累计约`18600`，工具调用`41`次 |
| 风险 | 备份连接失败；主连接正常 |
| 事件流 | `task_started`、`milestone_reached`、`validation_run` |

## Rider判断

Rider确认Live Hall可以看到公开摘要，但看不到原始对话、未公开评分或未发布Report。

## Harness表现

Harness记录Projection可重建且不作为最终结果事实源；一次Projection重建失败后，Screen Console仍读取最近稳定Projection作为fallback。

---

# 7.提交Work并关联公开材料

Rider完成第一版Demo后提交Work。

## Rider输入

```text
作品名定为GBA WanderMate。
简介写三条湾区路线已经上墙：早茶、海岸、夜景，预算和交通都标清。
Demo和Repo都可以公开。
```

## Agent执行

Agent提交并更新Work：

| 字段 | 记录值 |
|---|---|
| `workId` | `work_gba_wandermate` |
| `title` | `GBA WanderMate` |
| `status` | `submitted` |
| `visibility` | `public` |
| `demoUrl` | 已关联公开Demo入口 |
| `repoUrl` | 已关联作品代码仓库 |

## Rider判断

Rider确认Work是作品资产，不只是一次提交记录；后续Award和Report都可以追溯到Registration和Work。

## Harness表现

Harness生成`artifact_linked`信号，并把Work作为Evidence来源之一。Works页面公开展示Work摘要、Demo、Repo和可公开骑行摘要。

---

# 8.JudgeAssignment与评审前风险提示

Organizer把Work分配给两位Judge，同时保留评审前风险提示。

## Agent执行

| JudgeAssignment | Judge | 分配来源 |
|---|---|---|
| `ja_gba_001` | `judge_001` | `organizer_001` |
| `ja_gba_002` | `judge_002` | `organizer_001` |

评审前提示：

| 风险 | 级别 | 说明 |
|---|---|---|
| `ingestion_exception` | medium | 备份CAConnection失败，主连接正常 |
| `missing_deep_metrics` | low | 当前只使用基础成本和进度指标 |

## Rider判断

Rider接受这些风险作为评审上下文，不要求系统自动扣分或取消资格。

## Harness表现

Harness将风险提示展示给Organizer和Judge，但不写入最终Award事实；Judge仍需基于作品、摘要和评分项人工判断。

---

# 9.JudgingRecord、Award和Leaderboard发布

两位Judge完成评分，Organizer发布Award和Leaderboard。

## Agent执行

| Judge | `scoreResult` | `scoreRiding` | 评论摘要 |
|---|---:|---:|---|
| `judge_001` | 88 | 91 | 目标清晰，Demo完成度高，能说明纠偏过程 |
| `judge_002` | 84 | 89 | 路线场景完整，后续可增强真实地图数据 |

Award发布：

| Award | Rank | 关联 |
|---|---:|---|
| 最佳AgentRider | 1 | `reg_rider_001` |
| 最佳作品 | 2 | `work_gba_wandermate` |

## Rider判断

Rider确认最终赛果读取Award和Leaderboard，不读取过程Projection。

## Harness表现

Harness生成`leaderboard_read_model`，Results页面显示最终榜单；过程榜和最终榜单在数据语义上分离。

---

# 10.Report生成、人工编辑与公开边界

ARY生成三类Report草稿：`rider_report`、`race_report`和`review_summary`。

## Agent执行

| Report | 状态 | 公开边界 |
|---|---|---|
| `report_rider_001` | `published` | 默认私有，仅Rider可见 |
| `report_race_gba_001` | `published` | 可公开进入Results |
| `report_review_gba_001` | `published` | 可公开进入Review |

一次Report生成失败后，Agent保留已发布版本不覆盖，并通过人工编辑发布新的review summary。

## Rider判断

Rider确认个人报告不自动公开；公开端只展示已发布且允许公开的Race Report和Review Summary。

## Harness表现

Harness记录Report失败、重跑、人工编辑和发布状态，证明Report失败不污染已发布公开内容。

---

# 11.Screen Console与赛事归档

现场大屏先展示Live模式，赛后切换到Leaderboard和Works模式，归档时生成备份记录。

## Agent执行

| Screen模式 | 数据来源 |
|---|---|
| `live` | 最近稳定Projection |
| `leaderboard` | 已发布Award和Leaderboard |
| `works` | 已公开Work |
| `fallback` | Projection失败时使用最近稳定展示 |

赛后归档包含：

* Race基础信息。
* Registration、RaceProject和Work索引。
* Evidence摘要和ReviewFlag。
* Award、Leaderboard和已发布Report。
* Projection重建记录和fallback记录。

## Rider判断

Rider确认归档不公开原始CA Session，只沉淀可追溯摘要和已公开资产。

## Harness表现

Harness生成`post_race_archive`备份记录，并把Race状态推进到`archived`。

---

# 12.Riding过程汇总表

| 序号 | 阶段 | Rider输入 | Agent输出 | Harness记录 | 验收判断 |
|---:|---|---|---|---|---|
| 1 | 目标输入 | 定义`GBA WanderMate` | 任务拆分和风险清单 | `riding_started` | 通过 |
| 2 | 报名审核 | 登录、补资料、报名 | `RegistrationApproved`、`RaceProjectBound` | `rp_rider_001` | 通过 |
| 3 | CA接入 | 登记主连接和备份连接 | 两个CAConnection，主连接`active` | 聚合状态`active` | 通过 |
| 4 | 实时骑行 | 关键进展信号 | Session Summary和Evidence | `session_summary` | 通过 |
| 5 | 异常处理 | 备份连接失败 | ReviewFlag，不阻断参赛 | `partial_failed` | 通过 |
| 6 | Projection | 重建Live数据 | `race_progress_projection` | 最近稳定Projection | 通过 |
| 7 | Work提交 | 提交Demo和Repo | 公开Work | `artifact_linked` | 通过 |
| 8 | 评审准备 | 接受风险提示 | JudgeAssignment | 风险提示进入Judge上下文 | 通过 |
| 9 | 赛果发布 | 等待评审结果 | Award和Leaderboard | 最终榜单读取模型 | 通过 |
| 10 | Report | 生成报告 | 私有Rider Report、公开Review | Report状态轨迹 | 通过 |
| 11 | 归档 | 确认公开边界 | 赛事归档 | `post_race_archive` | 通过 |

---

# 13.结论

这份骑行记录验证了ARY的核心产品语义：

* Registration approved后幂等生成RaceProject。
* 一个RaceProject可接入多个CAConnection。
* 只有已登记、已握手、归属正确且未禁用的CAConnection信号进入有效Evidence和Projection。
* CA接入异常只形成评审前风险提示，不自动取消提交、评审或Award资格。
* Work是公开作品资产，Evidence可引用Work、Session Summary和JudgingRecord。
* Projection服务Live Hall和Screen Console，不作为最终赛果事实源。
* Award、Leaderboard和已发布Report承载最终公开结果。
* 原始CA Session默认不公开，公开端只展示摘要、公开Work、已发布Award和公开Report。
