# ARY DEV-4到OPS-1交付与验收记录

版本：v0.2
文档类型：Implementation Delivery
状态：已交付（本地 MVP 口径）
关联任务：`DEV-4`、`DEV-5`、`DEV-6`、`DEV-7`、`REL-1`、`OPS-1`
上游入口：`ary.plan.md`、`ary-qa-plan.md`、`ary-release-ops-plan.md`、`ary-ca-integration-spec.md`、`ary-permission-matrix.md`
实现入口：`../app/index.html`
测试入口：`../app/domain.test.js`
后续工程化：见 `../STATUS.md` 的"风险与阻塞"和 `../PLAN.md` 的"下一步"

---

# 1. 交付结论

本轮在仓库中新增`app/`本地MVP应用，把`ary.plan.md`中`DEV-4`到`DEV-7`、`REL-1`和`OPS-1`落为可运行、可测试、可复核的赛事闭环。

| 任务 | 本轮产物 | 完成判断 |
|---|---|---|
| `DEV-4`报名/RaceProject/Work/Judge结构流程 | Race发布、报名、审核、RaceProject幂等生成、Work提交、JudgeAssignment和JudgingRecord | 可用浏览器和领域测试走通 |
| `DEV-5`CA接入/Projection/Live Hall | CAConnection登记与握手、合法信号接入、非法信号隔离、ReviewFlag、Projection生成和失败隔离 | 可验证“合法进入投影、非法进入隔离、失败不污染事实” |
| `DEV-6`Screen Console/大屏联调 | live、leaderboard、works、announcement、fallback五种大屏模式 | 可在本地界面切换和验证稳定Projection fallback |
| `DEV-7`Report/Review/Results | Award/Leaderboard、Report生成/失败/编辑/发布、Results/Review/Public Works联动 | 可验证未发布Report不公开、`rider_report`默认私有 |
| `REL-1`赛事彩排/灰度/正式发布 | P0回归按钮、发布检查项、release-ready快照 | 可形成本地彩排和go/no-go证据记录 |
| `OPS-1`赛事值守/回滚/赛后归档 | 备份、事故、fallback和归档入口 | 可记录赛事当天运维证据和赛后归档动作 |

当前仓库没有正式后端、数据库、OAuth、部署环境或生产CAConnector，因此本轮“完整实现”按本地MVP口径完成：提供无依赖静态应用、可测试领域动作和验收记录。生产发布仍需要后续接入真实应用栈和基础设施。

---

# 2. 应用结构

| 文件 | 作用 |
|---|---|
| `../app/index.html` | 单页本地工作台，覆盖Overview、Race、CA、Screen、Reports、Public、Ops、Admin八个视图。 |
| `../app/styles.css` | 工作台视觉和响应式布局。 |
| `../app/domain.js` | 无DOM领域层，包含状态、选择器和全部赛事动作。 |
| `../app/app.js` | 浏览器渲染、表单、按钮动作、`localStorage`持久化。 |
| `../app/domain.test.js` | Node领域测试，覆盖关键验收边界。 |
| `../app/README.md` | 运行方式、验证命令和实现边界。 |

运行方式：

```text
直接打开`app/index.html`
```

本地状态保存在浏览器`localStorage`中，左侧`Reset Seed`可恢复种子状态。

---

# 3. DEV-4实现

## 3.1 流程落点

`app/domain.js`实现以下动作：

* `publishRace`
* `submitRegistration`
* `approveRegistration`
* `ensureRaceProject`
* `submitWork`
* `assignJudge`
* `submitJudgingRecord`
* `publishAward`

核心不变量：

| 不变量 | 实现方式 |
|---|---|
| 一个User对同一Race最多一个Registration | `submitRegistration`查找已有报名并幂等返回，不重复创建。 |
| Registration approved后自动生成RaceProject | `approveRegistration`调用`ensureRaceProject`。 |
| 一个Registration最多一个RaceProject | `ensureRaceProject`先查找已有项目，存在则返回原项目。 |
| 一个Registration最多一个主Work | `submitWork`按`registrationId`查找并更新同一Work。 |
| Judge只能提交自己的JudgingRecord | `submitJudgingRecord`校验`assignment.judgeUserId===actorId`。 |

## 3.2 UI落点

`app/index.html#race`提供：

* Race发布按钮。
* 报名列表和审核按钮。
* Work提交表单。
* JudgeAssignment列表。
* JudgingRecord提交表单。

---

# 4. DEV-5实现

## 4.1 CAConnection和信号接入

`domain.js`实现：

* `registerCAConnection`
* `handshakeCAConnection`
* `disableCAConnection`
* `ingestRidingSignal`
* `rebuildProjection`

接入边界：

| 场景 | 处理 |
|---|---|
| 已登记、已握手、归属正确、未禁用CAConnection | 信号进入Session、Evidence、Metrics和Projection输入。 |
| 未登记CAConnection | 进入`quarantinedSignals`，不生成Evidence。 |
| 未握手CAConnection | 进入`quarantinedSignals`，不进入Projection。 |
| RaceProject或Registration归属错误 | 进入`quarantinedSignals`。 |
| CAConnection失败 | 更新连接状态，生成`ingestion_exception` ReviewFlag，不阻断Work、评审和Award。 |
| 重复`idempotencyKey` | 幂等忽略，不重复生成事实。 |

## 4.2 Projection

`rebuildProjection`成功时生成稳定`race_progress`投影；失败模拟时写入`status=failed`投影，但保留最近稳定Projection，且不修改Race、Registration、Work、Award等事实对象。

UI落点：

* `#ca`页面可登记握手、接收合法信号、隔离非法信号、模拟Projection失败。
* `#public`和`#screen`读取稳定Projection或fallback。

---

# 5. DEV-6实现

`Screen Console`位于`app/index.html#screen`，支持：

| 模式 | 数据来源 |
|---|---|
| `live` | 稳定Projection中的赛事过程条目 |
| `leaderboard` | 已发布Award/Leaderboard |
| `works` | 已发布公开Work |
| `announcement` | 已发布公告 |
| `fallback` | 最近稳定Projection或静态展示 |

大屏fallback不会修改事实数据，只更新`screenDisplays[raceId]`中的展示模式和fallback策略。

---

# 6. DEV-7实现

`domain.js`实现：

* `publishAward`
* `generateReport`
* `editReport`
* `publishReport`
* `buildLeaderboard`
* `publicReports`

报告规则：

| 类型 | 规则 |
|---|---|
| `rider_report` | 必须带`subjectRegistrationId`；发布后仍为`private`，默认不进Public Site。 |
| `race_report` | 不允许带`subjectRegistrationId`；发布后可公开。 |
| `review_summary` | 不允许带`subjectRegistrationId`；发布后进入Public Review。 |

UI落点：

* `#reports`可发布Award、生成Report、模拟Report失败、人工编辑并发布。
* `#public`只展示已发布Results、Review和公开Work。

---

# 7. REL-1和OPS-1实现

## 7.1 REL-1

`runP0Regression`串联以下P0路径：

```text
发布Race
-> Rider报名
-> Organizer审核
-> RaceProject幂等生成
-> CAConnection登记和握手
-> 合法CA信号接入
-> Projection重建
-> Work提交
-> Judge分配
-> JudgingRecord提交
-> Award发布
-> race_report/review_summary生成和发布
-> Screen Console展示
-> 备份记录
-> P0检查项完成
```

`#ops`页面提供发布检查项，可记录P0回归、staging彩排、大屏彩排、回滚准备和go/no-go证据。

## 7.2 OPS-1

`domain.js`实现：

* `createBackup`
* `recordIncident`
* `archiveRace`

UI落点：

* 备份记录列表。
* 事故记录列表。
* 归档按钮，归档时自动生成`post_race_archive`备份记录。

---

# 8. 验收验证

已执行：

```bash
node --check app/domain.js
node --check app/app.js
node app/domain.test.js
node app/layout-check.js
```

测试结果：

| 测试 | 结果 |
|---|---|
| DEV-4重复报名幂等 | 通过 |
| DEV-4审核后RaceProject幂等生成 | 通过 |
| DEV-5非法CA信号隔离且不生成Evidence | 通过 |
| DEV-5合法CA信号进入Session/Evidence，重复信号幂等忽略 | 通过 |
| DEV-5CA失败不阻断Work、Judge、Award | 通过 |
| DEV-5Projection失败隔离并保留稳定fallback | 通过 |
| DEV-7`rider_report`私有、`review_summary`公开 | 通过 |
| DEV-7Report生成失败不覆盖已发布公开Report | 通过 |
| REL-1/OPS-1P0回归形成发布和备份证据 | 通过 |
| 本地HTTP浏览器只读烟测 | 通过，确认`app/index.html`可打开、标题为`ARY Local MVP`、八个视图和`Run P0`按钮存在 |
| 桌面/平板/移动八视图布局扫描 | 通过，未发现可见元素重叠、横向撑破或默认输入溢出 |

---

# 9. 未完成项和边界

本轮未做：

* 真实GitHub OAuth。
* 服务端API、服务端鉴权和数据库迁移。
* 真实CAConnector网络接入、connector凭证和HTTP snapshot fetch。
* 真实staging、production部署、灰度流量和回滚执行。
* 完整浏览器点击自动化截图验收。

这些项目需要在正式技术栈、部署环境和CAConnector凭证明确后继续实现。当前本地MVP已经为这些后续工程提供领域动作、验收测试和页面入口。

浏览器验证边界：本轮通过临时本地HTTP服务完成只读烟测；内置浏览器控制层在点击`Run P0`时超时，因此点击后的P0闭环以`node app/domain.test.js`中的领域测试作为可靠验收证据。

---

# 10. 后续判断

`DEV-4`到`DEV-7`、`REL-1`和`OPS-1`在当前仓库阶段均已有可演示产物、可审查实现、验收记录和风险边界。下一步应进入正式工程化：

* 选择正式应用技术栈。
* 将`app/domain.js`迁移为后端领域服务或共享领域包。
* 增加服务端鉴权、数据库约束、迁移脚本和端到端浏览器测试。
* 接入真实GitHub OAuth和CAConnector。
* 建立staging/production发布流水线。
