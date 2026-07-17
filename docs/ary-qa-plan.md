# ARY MVP QA Plan

版本：v0.5
文档类型：QA Plan
上游入口：`ary-mvp.prd.md`
领域基线：`ary-domain-analysis.v0.3.md`
权限矩阵：`ary-permission-matrix.md`
当前测试入口：`../web/tests/domain.test.ts`（运行方式：`cd ../web && npm test`）

---

# 1. 文档目的

本文定义 ARY MVP 的测试覆盖范围、关键测试类型和 P0 回归要求。PRD 保留产品验收目标；本文负责把验收目标转成可执行测试范围。

测试原则：

* 优先保证首场赛事完整闭环。
* 优先覆盖权限、CA 实时接入、Projection、Report、大屏和公开展示。
* 所有测试必须遵守实时 CA 接入规则：CA 接入状态不作为参赛资格硬门禁；未登记、未握手、归属错误或被禁用的 CA 数据不得污染 Projection、Evidence 或 Report；不接受事后上传 Session Summary 伪造实时 CA 证据。
* 角色测试必须区分“用户拥有的有效资格”与“当前会话激活角色”；页面、API 和 Server Action 均不得使用多个角色的权限并集。

角色与认证 P0 覆盖：GitHub 主验证邮箱、缺配置与无验证邮箱失败；公共资料门禁；Rider 自助开通；Judge/Organizer 审核、驳回、重提和撤回；Admin 授予与最后 Admin 保护；会话角色持久化、多设备隔离、角色停用后的会话失效；四类独立工作台的跨角色拒绝；赛事级 Rider 与 Organizer/Judge 双向冲突及 Organizer+Judge 共存/自行分配；公开 Rider DTO 不泄漏账号和资格内部字段。

## 1.1 日常开发验证分级

| 等级 | 典型变更 | 默认验证 |
| --- | --- | --- |
| L0 | 不超过 3 个文件、100 行的文案、CSS、链接或明确单点修复，且不触及高风险边界 | `git diff --check`；TypeScript 变更追加 typecheck；必要时单页 HTTP 检查 |
| L1 | 单模块、小范围交互或组件修改，无权限和数据边界变化 | `npm.cmd run check:quick`，再加相关单测或一个定向 E2E |
| L2 | 跨页面或共享组件修改，业务边界稳定 | 相关领域测试、`check:quick`、定向 E2E；通常跳过 build 和完整 E2E |
| L3 | 登录、会话、权限、Server Action、Schema、迁移、数据库、生产配置、安全或跨子系统重构 | 隔离领域测试、static、typecheck、build、定向 E2E；实现稳定后集中执行一次完整 E2E |
| 发布 / 里程碑 | 合并、部署、版本交付或明确要求完整验收 | 完整领域测试、static、typecheck、build、production config、migration 与完整 E2E |

执行规则：

* 测试失败时先复跑失败用例或失败 spec；修复稳定后再按等级决定是否执行完整回归，禁止每个小修复都重复执行完整 E2E。
* L0/L1 和纯单测不停止开发服务。只有 Prisma generate 或浏览器 E2E 确实需要时才进行一次受控停机，并在整轮验证后统一恢复。
* `npm run test:e2e` 仍是完整门禁，会先准备隔离测试库再运行全部场景。定向调试可先运行一次 `npm run test:e2e:prepare`，随后连续使用 `npm run test:e2e:run -- e2e/<spec>.spec.ts`，避免重复 prepare。
* `test:e2e:run` 本身不会准备或重建数据库；只能在确认 `prisma/e2e.db` 已由本轮 prepare 创建后使用。当前仍保持 Playwright `workers: 1`，避免共享测试库并发写入。
* 领域和 E2E 一律使用隔离的 `e2e.db`。未经用户明确确认，禁止对 `web/prisma/dev.db` 运行 `db:init`、`init-sqlite` 或其他重建流程。
* 完整 E2E 默认只在 L3 实现稳定后、里程碑、发布或 CI 中执行一次；日常 L0-L2 不以完整 E2E 作为固定门禁。

---

# 2. 测试覆盖

## 2.1 赛事生命周期测试

覆盖流程：

```text
创建赛事
-> 发布赛事
-> 用户报名
-> 审核报名
-> ARY 自动生成 RaceProject
-> 实时 CA 接入
-> 开赛
-> 作品提交
-> 评审分配
-> 评审提交
-> 发布赛果
-> 发布评审总结
-> 归档赛事
```

验收点：

* Race status 可以按预期流转。
* Rider 报名弹窗覆盖个人报名、创建团队、通过当前 Race 邀请码加入；建队/入队/提交在服务端校验报名窗口、2–10 人上限、角色冲突和唯一参赛。队长与队员权限分离，团队提交后资料和名单锁定。
* Registration approved 后 RaceProject 自动幂等生成，Registration、RaceProject、Work、JudgeAssignment、JudgingRecord、Award、Report 可以形成闭环。
* RaceProject 聚合 CA 接入 failed / not_configured 不阻断 Work Submission、评审和 Award 流程，但必须形成评审前风险提示。

## 2.2 角色路径测试

覆盖角色：

* Public：浏览首页、Race Page、Live Hall、Works、Results、Review、Rider Profile。
* 首页精选：最多六场，默认按已批准唯一 Rider、公开已发布 Work、时间和 ID 排序；验证自动轮播、箭头、圆点、暂停、键盘切换及 Admin 置顶/隐藏/补位。
* 首页轮播：自动、箭头、圆点与键盘切换均产生可见横向位移；末项到首项无反向跨越或闪白；悬停、焦点、页面隐藏暂停，手动操作重新计时，reduced-motion 下仍可完成切换。
* 公共目录：Race 使用 `q/status/page`，Works 使用 `q/race/page`，Riders 使用 `q/skill/page`；每页最多 9 条，第 10 条进入下一页，非法页回到第一页、越界页收敛到末页，翻页保留条件，单页和无结果隐藏分页栏。
* 首页摘要：Featured Works 最多 3 项且获奖优先；Latest Results 来自最近完成且已有公开结果的赛事；Cooperation 为紧凑 CTA，不与完整目录重复。
* Rider Portfolio：展示全部个人、团队报名及团队筹备记录，逐卡进入独立 `/console/rider/races/{raceId}`，越权 Race 返回 404。
* Rider：GitHub 登录、资料补全、报名、进入自动生成的 RaceProject、查看 CA 接入状态、提交 Work、查看报告。
* Judge：查看分配作品、查看 Evidence 摘要、评分、提交评语。
* Organizer：创建赛事、管理报名、分配评委、发布榜单、生成和发布报告。
* Admin：查看用户和角色申请，审核申请，停用、恢复或撤销单个 `UserRole` 资格。
* Screen Operator：进入 Screen Console、选择赛事、切换视图、进入全屏、执行 fallback。

验收点：

* 各角色只能看到与自己职责匹配的入口。
* 多资格用户可以显式切换当前会话角色，切换前不能访问其他资格对应的页面或动作。
* Screen Operator 不是独立 role，通常由 Organizer 或 Admin 承担。

## 2.3 权限测试

覆盖规则：

* Public 不能访问后台、原始 CA Session、未发布 Work、未发布 JudgingRecord、未发布 Report。
* Public 不能访问 `rider_report`，除非后续单独增加公开发布规则。
* Rider 不能查看其他选手的非公开 Session、私有 Evidence、未发布评分和报告。
* Rider / Judge 不能查看未发布 Award / Leaderboard draft。
* Judge 不能查看未分配给自己的作品，不能越权评分。
* Organizer 只能管理自己负责的 Race。
* Admin 可以维护 `UserRole` 资格，但 Admin Console 不承担赛事执行、CA 接入维护或数据运营职责。
* 非 Admin 不能审核申请或修改他人的 `UserRole` 资格。

验收点：

* 每个资源动作必须符合 `ary-permission-matrix.md`。
* 越权请求必须被拒绝，不能只在 UI 层隐藏入口。

## 2.4 CA 接入测试

覆盖场景：

* 实时 CA 接入成功。
* 单个选手 RaceProject 聚合 CA 接入失败。
* 多个选手中部分接入失败。
* 单个选手绑定多个 CAConnection，部分 CAConnection 接入失败但仍有可用连接。
* 单个选手绑定多个 CAConnection，全部 CAConnection 接入失败。
* 参赛过程中新增多个 CAConnection，并在登记和握手成功后接入骑行数据。
* 未登记、未握手、归属错误或被禁用的 CAConnection 尝试 push 骑行信号或提供 Session Snapshot。
* RaceProject Aggregate Ingestion Status 覆盖 not_configured、connected、active、failed。
* CAConnection Ingestion Status 覆盖 not_configured、connected、active、failed。
* GitHub Repo / 代码材料绑定成功。
* 重复同步同一 Session 或重复引用同一代码材料。
* 接入状态可追踪。
* 空骑行、无 CA 数据、空作品、缺必填材料、疑似违规和接入异常可以生成评审前风险提示。

验收点：

* 接入成功的 Registration 可以进入比赛后续流程。
* RaceProject 聚合接入 failed / not_configured 的 Registration 仍可进入提交、评审和 Award 流程，但 Organizer / Judge 必须看到风险提示。
* 部分或全部 CAConnection failed 时，该 Registration 不应被自动视为退赛。
* 未登记、未握手、归属错误或被禁用的 CAConnection 数据不得进入 Projection、Evidence、Report 或评审摘要。
* not_configured / failed 时可以完成 Work Submission，但必须生成证据缺口或接入异常风险提示；connected / active 时展示正常证据状态。
* 部分选手接入失败不影响 Public Site、Live Hall、Screen Console 和其他选手。
* 重复同步不应生成重复事实或污染 Projection。
* GitHub 代码材料不能替代实时 CA 接入。

## 2.5 Projection 测试

覆盖场景：

* Projection 可生成。
* Projection 可手动重算。
* Projection 失败不污染核心事实数据。
* Projection 失败后可回退到最近一次稳定 Projection。
* Live Hall 和 Screen Console 读取 Projection 或稳定 fallback。

验收点：

* Projection 不是最终事实源。
* Award、Report、Leaderboard 不依赖过程 Projection 作为最终结果事实。

## 2.6 Report 测试

覆盖场景：

* rider_report 生成、查看。
* race_report 生成、编辑。
* review_summary 生成、编辑、发布。
* Report 生成失败后手动重跑。
* 未发布 Report 不出现在 Public Site。

验收点：

* `rider_report` 必须关联 `subjectRegistrationId`。
* `race_report` / `review_summary` 的 `subjectRegistrationId` 必须为空。
* `rider_report` 默认只允许对应 Rider、managed race Organizer 和 Admin 查看。
* 已发布 Review 必须来自已发布 `review_summary` Report。

## 2.7 大屏测试

覆盖场景：

* Screen Console 选择赛事。
* Screen Console 缺少、伪造或未授权 `raceId` 时不回退默认赛事。
* 两场 Race 的 ScreenState、模式、公告、Projection、作品与 Track 上下文相互隔离。
* 无有效 Race Live Projection 时返回静态展示，至少可读地展示赛事名称、状态、报名人数、作品数和等待配置提示；公告、榜单、作品为空时不得出现空白面板。
* Display 每 3 秒轮询当前 Race，模式和内容变化无需人工刷新。
* `/screen/display/{raceId}` 对 public 非 draft Race 可匿名访问；private/draft 仅对应 Organizer 预览；旧 `/screen/display` 只提示未指定赛事。
* Jumbotron / Billboard 切换。
* Live / 榜单 / 作品 / 公告切换。
* 四模式共享暗色赛事框架；Live 显示 Header、TOP3、KPI、Mini Map、Stage、Ticker 与 Footer，榜单、作品和公告只替换中部内容并保持可读。
* 新赛事和 P0 彩排结束后的模式为 `live`；打开 Display 不覆盖 Organizer 已明确选择的模式。
* 全屏展示。
* 弱网或断流时 fallback 到最近一次稳定 Projection。
* Projection 不可用时 fallback 到静态榜单或公告。

验收点：

* 大屏展示失败不影响公开网页核心数据。
* 大屏 fallback 不改变核心事实数据。

## 2.7.1 工作台与公共站点返回路径

覆盖场景：

* Rider、Organizer、Judge、Admin 工作台均显示 `workspace-public-home-link`。
* 点击后进入 `/`，角色侧栏卸载，公共顶栏在登录状态下显示“工作台”和“退出”。
* 再次进入工作台时恢复当前激活角色，不把公共导航重新混入角色侧栏。

验收点：公共站点与角色工作台保持清晰的双向入口和外壳边界。

## 2.8 非功能 / 性能测试

覆盖场景：

* 公开页首屏响应时间。
* Live Hall 数据刷新。
* Screen Console 等页面切换加载首屏。
* 公开端、Live Hall、Results、Works、Rider Profile 的并发访问。

验收点：

* 公开页首屏目标响应时间：1s 内。
* Live Hall 数据刷新目标：3s 内。
* Screen Console 等页面切换加载首屏目标响应时间：1s 内。
* MVP 应支持同时在线 200 用户访问公开端、Live Hall、Results、Works 和 Rider Profile 等公开页面。
* 性能测试不应绕过权限、可见性和 Projection / Report 读取边界。

## 2.9 回归测试

P0 回归必须一键跑通：

```text
GitHub 登录
-> 资料补全
-> Admin 分配 roles
-> Organizer 创建并发布 Race
-> Rider 报名
-> Organizer 审核
-> ARY 自动生成 RaceProject
-> 实时 CA 接入成功
-> Live Hall 展示 Projection
-> Rider 提交 Work
-> Organizer 维护至少三人的赛事 Judge 池
-> 平台原子分配每件 Work 的三个 Judge
-> 三名 Judge 分别提交 JudgingRecord
-> Organizer 发布聚合评审结果
-> Organizer 发布 Award / Leaderboard
-> Report 生成和发布
-> Public 查看 Results / Review / Work / Rider Profile
-> Screen Console 展示赛事状态
```

---

# 3. 测试完成标准

进入首场赛事彩排前，应满足：

* P0 回归测试通过。
* 权限测试无高危漏洞。
* CA 接入成功、部分失败、重复同步场景通过。
* Projection 生成、重算、失败不污染事实数据场景通过。
* Report 生成、发布、未发布不可见场景通过。
* 大屏基础展示和 fallback 场景通过。
* 非功能 / 性能测试达到 PRD 中的 P0 工程就绪目标。

---

# 4. 当前测试覆盖度（本地 MVP 口径，截至 v0.4）

本计划定义的测试场景在生产接入前分为**已通过本地 MVP 领域测试验证**和**待生产接入后验证**两类。下表区分当前实现状态，作为后续正式 QA 的起点：

| 测试维度 | 当前集成应用已覆盖（`web/tests/domain.test.ts`） | 待生产接入验证 |
|---|---|---|
| 赛事生命周期 | `runP0Regression` 串联 14 步闭环（发布→报名→审核→RaceProject→CA 握手→信号→Projection→Work→Judge→Award→Report→屏幕→备份→检查项） | 端到端浏览器自动化、Playwright 截图回归 |
| 角色路径 | Debug Login 覆盖 Public/Rider/Judge/Organizer/Admin 调试入口；Console 根据服务端 auth context 限制角色视图 | 生产 OAuth、JWT/Session、跨设备角色切换 |
| 权限 | `submitJudgingRecord` 校验 `assignment.judgeUserId===actorId`；`archiveRace` 等运维动作限制 managed race / system actor | 全矩阵服务端拒绝、越权请求审计 |
| CA 接入 | 已覆盖：合法/非法信号接入、`idempotencyKey` 幂等、CA 失败不阻断 Work/Judge/Award | 真实 connector HTTP push、HTTP fetch snapshot、网络分区恢复 |
| Projection | 已覆盖：`rebuildProjection` 成功生成稳定版本、失败时 `status=failed` 但保留最近稳定版本、事实表零修改 | 并发重建、回滚到稳定版本、Projection 版本对比 |
| Report | 已覆盖：`rider_report` 必须带 `subjectRegistrationId` 且发布后仍私有、`race_report`/`review_summary` 发布后可公开、Report 失败不覆盖已发布版本 | Report Generator 服务化、Evidence 引用链、失败重试策略 |
| Team Registration | 已覆盖：三类报名入口、团队简介、2–10 人限制、跨 Race 邀请码拒绝、团队报名提交、成员共享 CA、队长提交 Work 与成员权限隔离 | 邀请码失效、团队审核拒绝和队长转让 |
| 大屏 | 已覆盖：显式 Race 上下文、跨 Race 状态隔离、公开/私有 Display 权限、模式切换与 stable fallback | 弱网断流、长时间运行稳定性、远距离可读性 |
| 非功能 / 性能 | 未验证 | 首屏 1s、Live Hall 3s、200 并发用户、权限与可见性边界下性能不退化 |

本节不替代正式 QA；正式 QA 需在真实后端、数据库迁移、GitHub OAuth、真实 CAConnector 接入后，按本计划第 2 节场景重跑全量测试。

## 4.1 公共目录、轮播与 Race Live 复验记录（2026-07-16）

本轮实际执行结果：

* `check:quick` 通过。
* 分页纯函数与 screen-p0 领域测试通过。
* 本轮新增定向 Playwright 首次执行 10/10 通过。
* production build 首次且唯一一次通过；仅有 autoprefixer 对 `flex-end` 的兼容性提示和多 lockfile 警告。
* 首次且唯一一次完整 Playwright E2E 结果为 49 pass / 6 fail / 1 未运行，暴露测试间状态隔离和 Projection 选择问题。
* 修复后只复跑受影响的 5 个 spec，结果 15/15、0 失败、0 未运行；没有重复执行完整 E2E 或 production build。该 15/15 是定向回归证据，不能写成“修复后完整 E2E 全绿”。
* 验证前后 `web/prisma/dev.db` 哈希一致；测试数据使用隔离库。开发服务恢复到 `127.0.0.1:3000`，HTTP 200。
* Screen 的 1366×768、1920×1080 和轮播交互由 Playwright 覆盖；人工 Browser 走查因无可用实例未完成。

## Race Live Web 接入验收补充（2026-07-16）

* 覆盖 pending Round 创建、approved Registration 名单同步、排除/恢复/排序、Track 绑定、启动锁定和结束只读。
* 覆盖 running Round 直接准备、pending Round 确认启动、无 Round/Track/Entry 的准确阻断，以及稳定 `ary_race_live` Projection 幂等复用。
* 覆盖 CA/风险/Round 事件刷新失败不回滚事实写入，ScreenState 保持最后成功 Projection。
* 覆盖 Display 的 `static ↔ race_live`、四模式和分组无刷新更新、两场 Race 隔离，以及 1366×768 和 1920×1080 完整赛道显示。
* 本轮 production build 一次通过；唯一一次完整 E2E 为 56/57，测试服务内存阈值重启期间的单项登录跳转失败随后定向复跑 1/1 通过。该结果不得表述为“完整 E2E 57/57 全绿”。

---
## 赛题附件与作品安全验收

* PDF：校验 MIME、魔数、EOF、页数、大小、双扩展名、路径字符、加密和主动内容；扫描失败、超时与恶意样本均不得公开。
* 权限：上传意图单次使用且十分钟过期；跨用户、跨 Race、重放、伪造 Origin 和未授权下载返回拒绝或 404。
* Rider 下载：已报名个人、团队成员及团队筹备成员可从赛事空间下载当前 `clean` 修订；退出、拒绝、撤回或取消后失去私有下载权限，且不能读取历史未发布修订。
* Judge 池与分配：Organizer 只可选择 active 且无本场参赛冲突的 Judge；提交冻结后执行 `balanced-random-v1` 批次分配，每个版本化 Work 恰好三个不同 Judge，资格、版本、slot 和冲突在 Serializable 事务内复核，失败整批零写入并回到页面而不是 500。

## Registration 审核、三 Judge 与交互反馈验收（2026-07-17）

* 审核：Workspace 仅出现 pending；通过后队列项目消失并进入 approved 参与者库，拒绝原因必填且进入历史区。重复/并发通过只能生成一个 RaceProject 和一条初始风险。
* 参与者库：校验个人/团队、队长/成员、审核信息、RaceProject、CA、Work 与风险摘要；搜索、状态筛选、分页和未授权 404 均需覆盖。
* Judge 池：覆盖 active 资格、参赛冲突、至少三人、已分配成员不可移除、结果发布后锁定。
* 批次分配：覆盖每 Work 三个不同 Judge、slot 1–3、无第四人、无重复 Work/Judge、候选不足整批回滚、已有合法 Assignment 保留补足、随机种子可审计和负载优先。迁移发现历史 Work 超过三条时必须中止。
* 评分发布：覆盖 0–100 整数边界、评论 2000 字边界、三份完成门槛、维度均分、overall 两位小数、并列名次、Organizer/Judge/Rider/Public 可见性和发布后锁定；Award 仍为独立手工发布事实。
* 操作反馈：覆盖 pending/`aria-busy`、成功后的实体迁移或计数变化、受控 action code 结果面板，以及业务错误不触发 Runtime 500。
* PDF UI：覆盖拖拽/选择、真实 XHR 上传进度、传输后扫描中不确定状态、成功版本刷新、失败重试与修订独立 pending；既有 10 MiB、200 页、扫描和下载安全规则不得回退。
* 最终证据：Prisma generate/schema validate、`check:quick`、完整 `npm test` 与唯一一次 production build 通过。唯一一次完整 Playwright E2E 为 58/62；修复后仅定向复跑失败的 4 项并取得 4/4，不能写成完整 E2E 62/62。1280/1440/1920/390 视口基线通过，验证前后 `dev.db` SHA-256 一致。
* 禁止对 `web/prisma/dev.db` 执行初始化、清空或迁移；数据库测试只允许使用隔离库。
* 存储归属：生产配置缺少当前 Organizer 的自有 S3/R2/OSS 时上传失败关闭；成功上传后平台文件系统不存在持久副本，Rider 获得的是最长 300 秒签名地址。
* 旧文件迁移：源对象、目标对象和数据库 SHA-256 一致后才删除平台副本；任一步失败必须保留最后一个可恢复副本并停止迁移。
* 修订：draft 可替换当前版本；已发布 Race 只能创建带说明的新修订，失败不得覆盖最后安全版本。
* Work：新版本必须通过 GitHub App 验证目标仓库和 Commit；私有仓库 URL 不进入 Public DTO；Demo 提示页不得接受任意目标 URL。
* 自动化只使用 `e2e.db`，迁移、领域测试、`check:quick`、build 和安全定向 E2E 稳定后再执行一次完整 E2E。
* migration 顺序必须为 `20260717_01_race_problem_and_repo_verification` → `20260717_02_organizer_owned_problem_storage` → `20260717_03_judge_pool_and_review_workflow`。SQLite 验证先复制数据库，再对副本设置显式 `DATABASE_URL=file:...` 并运行 `db:migrate:judge-workflow:sqlite`；helper 直接收到 `prisma/dev.db` 时应拒绝。
* PostgreSQL 运行时 migration 尚未验证，阻塞原因为当前环境 Docker daemon 与 `psql` 不可用；不得以 Prisma validate 或 SQLite 副本测试代替该证据。
* Next 开发服务退出时的 `controller[kState].transformAlgorithm` 告警纳入跟踪风险。当前定向回归通过不能证明该告警已消失，后续需在长时间开发服务和 CI 环境复现/排除。
