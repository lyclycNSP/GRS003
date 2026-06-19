# PLAN

本文是 ARY 近期任务窗口，记录近期要推进的任务和里程碑。长期任务定义见 `docs/ary.plan.md`；任务瞬时状态见 `STATUS.md`。

## 近期窗口

| 窗口 | 目标 |
| --- | --- |
| DEV-1到OPS-1本地MVP交付收口 | 已输出DEV-1到DEV-3架构/原型交付，并新增`app/`本地MVP应用，覆盖DEV-4到DEV-7、REL-1和OPS-1的可运行闭环。 |
| 正式工程化准备 | 下一阶段进入真实应用技术栈、服务端鉴权、数据库迁移、OAuth、真实CAConnector和部署流水线确认。 |

## 近期任务

| 任务 | 目标 | 下一入口 |
| --- | --- | --- |
| `PRD-1` 文档基线与范围确认 | `PRD-TEMP-1` 已并入正式基线；报名、RaceProject、CAConnection 和评审前风险提示口径可作为架构输入。 | `docs/ary.plan.md` |
| `UX-1 收尾 v2` 设计原型细节态深化 + 移动端审计 | 已完成：Race Page in_progress 详情态（leaderboard + event-stream）+ Work Page Judge 视角评审态（5 hooks + renderWorkJudge）+ `app/` 移动端静态审计 0 P0 + 5 P1 + 4 P2。 | `design-prototype/ary-v0.4-race-detail.png`、`design-prototype/ary-v0.4-work-judge.png`、`docs/ary-mobile-ux-review.md` |
| `PRD-TEMP-1` 报名 / RaceProject / CA 参赛语义整改 | 已完成并入：PRD、领域、CA 契约、IA、UX / 高保真原型、权限、QA、OPS 和计划文档已同步新口径。 | `docs/registration-ca-rules-alignment.taskbook.md` |
| `UX-1` UX/UI 高保真原型与设计基线 | 第一轮 IA 对齐版 1080P 高密度高保真原型已验收通过，作为 `M2` 架构设计输入；后续页面按高保真页面工作流继续深化。 | `docs/ux-hifi.taskbook.md`、`.agents/skills/hifi-ui-page-workflow/SKILL.md`、`design-prototype/index.html` |
| `DEV-1` 领域模型 + 权限 + 数据模型 | 已完成：输出聚合边界、逻辑数据模型草案、接口鉴权规则、领域事件和验收记录。 | `docs/ary-dev-1-dev-3-delivery.md` |
| `DEV-2` Public Site 静态闭环 | 已完成：Home、Race Page、Live Hall、Works、Work Page、Results、Review、Rider Profile、Cooperation可用样例数据走查。 | `design-prototype/index.html`、`design-prototype/README.md` |
| `DEV-3` 登录 / 角色 / Race Console | 已完成：模拟GitHub登录、资料补全、角色入口、Organizer/Rider/Judge/Admin视图和Admin角色维护演示。 | `design-prototype/index.html`、`docs/ary-dev-1-dev-3-delivery.md` |
| `DEV-4` 报名 / RaceProject / Work / Judge 结构流程 | 已完成本地MVP实现：Race发布、报名审核、RaceProject幂等生成、Work提交、JudgeAssignment和JudgingRecord可运行并有领域测试。 | `app/index.html`、`app/domain.js`、`app/domain.test.js`、`docs/ary-dev-4-to-ops-delivery.md` |
| `DEV-5` CA 接入 / Projection / Live Hall | 已完成本地MVP实现：CAConnection登记握手、合法信号接入、非法信号隔离、ReviewFlag、Projection生成和失败隔离、Live Hall稳定读取。 | `app/index.html#ca`、`app/domain.test.js`、`docs/ary-dev-4-to-ops-delivery.md` |
| `DEV-6` Screen Console / 大屏联调 | 已完成本地MVP实现：live、leaderboard、works、announcement和fallback模式可切换。 | `app/index.html#screen`、`docs/ary-dev-4-to-ops-delivery.md` |
| `DEV-7` Report / Review / Results | 已完成本地MVP实现：Award/Leaderboard发布、Report生成/失败/编辑/发布、Results/Review/Public Works联动。 | `app/index.html#reports`、`app/index.html#public`、`app/domain.test.js` |
| `REL-1` 赛事彩排 / 灰度发布 / 正式发布 | 已完成本地MVP演练入口：P0回归按钮、发布检查项和go/no-go证据记录；真实staging/production发布待正式工程化。 | `app/index.html#ops`、`app/domain.test.js`、`docs/ary-dev-4-to-ops-delivery.md` |
| `OPS-1` 赛事值守 / 回滚 / 赛后归档 | 已完成本地MVP运维入口：备份、事故、fallback、归档记录；真实值守和回滚待生产环境接入。 | `app/index.html#ops`、`docs/ary-dev-4-to-ops-delivery.md` |

## 近期里程碑

| 里程碑 | 完成口径 |
| --- | --- |
| `M1` 文档基线可作为架构入口 | PRD、领域、IA、权限、QA、计划、OPS、CA 草案无高优先级冲突。 |
| `M2` 架构设计输入就绪 | DEV-1已输出领域边界、权限规则和数据模型草案；UX/UI原型已覆盖DEV-2/DEV-3关键页面状态；DEV-4到OPS-1本地MVP已提供可迁移的领域动作和验收测试。 |
| `M3` 本地MVP闭环可演示 | `app/`可直接打开并运行P0回归，覆盖报名、CA、Projection、大屏、报告、发布检查和运维归档。`app/domain.test.js` 9 个用例已覆盖 M3 对应的不变量。 |

## 下一步

1. 选择正式应用技术栈，建立服务端、数据库迁移、路由、权限中间件和测试命令。
2. 将`app/domain.js`中的领域动作迁移为后端领域服务或共享领域包，并用数据库唯一约束落实Registration、RaceProject和Work不变量。
3. 接入真实GitHub OAuth和CAConnector，补齐connector凭证、HTTP snapshot fetch、服务端幂等和审计日志。
4. 建立staging/production发布流水线，补齐浏览器自动化、P0回归、回滚演练和生产监控。

## 执行纪律

* 开工前读取对应任务在 `docs/ary.plan.md` 中的定义。
* 近期窗口变化时更新本文；任务状态变化时更新 `STATUS.md`。
