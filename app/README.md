# ARY Local MVP App

本文记录`app/`本地MVP应用的运行方式和覆盖范围。该应用用于完成`docs/ary.plan.md`中`DEV-4`到`DEV-7`、`REL-1`和`OPS-1`的可演示闭环。

## 运行方式

直接用浏览器打开：

```text
app/index.html
```

应用不依赖npm包、构建步骤或开发服务器。状态保存在浏览器`localStorage`中，左侧`Reset Seed`可恢复种子数据。

## 本地验证

```bash
node --check app/domain.js
node --check app/app.js
node app/domain.test.js
node app/layout-check.js
```

## 覆盖范围

| 任务 | 应用落点 |
|---|---|
| `DEV-4` | Race发布、报名审核、Registration唯一性、RaceProject幂等生成、Work提交、JudgeAssignment、JudgingRecord。 |
| `DEV-5` | CAConnection登记与握手、合法骑行信号接入、非法信号隔离、接入失败ReviewFlag、Projection生成和失败隔离、Live Hall读取稳定Projection。 |
| `DEV-6` | Screen Console模式切换：live、leaderboard、works、announcement、fallback。 |
| `DEV-7` | Award/Leaderboard发布、race_report、review_summary、rider_report生成、编辑、发布和公开读取边界。 |
| `REL-1` | P0回归按钮、发布检查项、彩排/回滚/发布证据记录。 |
| `OPS-1` | 备份记录、事故记录、fallback记录、赛后归档动作。 |

## 实现边界

该应用是本地可运行MVP，不是生产系统：

* GitHub登录、真实OAuth、服务端鉴权、数据库迁移和部署配置未接入。
* CAConnector为本地模拟信号；契约边界按`docs/ary-ca-integration-spec.md`实现校验和隔离。
* Release/Ops以本地演练、检查项和记录入口验收，不代表已完成真实生产发布。
