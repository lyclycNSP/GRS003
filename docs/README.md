# ARY 文档索引

本文用于帮助 Agent 和开发者快速找到当前权威文档。根目录 `PLAN.md` 负责近期任务窗口，根目录 `STATUS.md` 负责任务瞬时看板。

## 当前正式工程入口

正式集成应用位于 `web/`：

```bash
cd web
npm install
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
```

访问：`http://127.0.0.1:3000`

历史产物说明：

* `design-prototype/`：UX-1 高保真静态原型。
* 根目录旧 `app/` 静态 MVP 已移除；DEV-4 到 OPS-1 的当前可运行闭环以 `web/`、`web/lib/domain.ts` 和 `web/tests/domain.test.ts` 为准。历史交付语义保留在 `ary-dev-4-to-ops-delivery.md`。

## 文档路由

| 文档 | 作用 |
| --- | --- |
| `ary-mvp.prd.md` | 产品目标、MVP 范围、角色路径、产品验收口径。 |
| `ary-domain-analysis.v0.3.md` | 领域概念、核心对象、关系和不变量。 |
| `ary-mvp.ia.md` | 信息架构、页面层级、导航、页面状态和 URL 建议。 |
| `ary-permission-matrix.md` | 资源动作级权限、角色范围和接口鉴权输入。 |
| `ary.plan.md` | 研发任务定义、工作域编号、任务产出、任务验收和 Demo 节奏。 |
| `ary-qa-plan.md` | 测试覆盖、回归要求和质量门。 |
| `ary-release-ops-plan.md` | 发布、监控、备份、值守和回滚要求。 |
| `ary-ca-integration-spec.md` | CA 接入契约草案，定义参赛过程中 CAConnection 登记与握手、多 CAConnection、push / fetch 边界、骑行状态消息、Projection 输入和评审前风险提示。 |
| `ary-risk-center.md` | 风险评审中心专题说明，定义 ReviewFlag 的范围、状态、权限、页面结构、验收口径和后续合并关注点。 |
| `ary-dev-1-dev-3-delivery.md` | DEV-1 到 DEV-3 的聚合边界、数据模型草案、接口鉴权规则、静态闭环演示和验收记录。 |
| `ary-dev-4-to-ops-delivery.md` | DEV-4 到 OPS-1 的本地 MVP 应用交付、流程实现、验收测试和边界记录。 |
| `ary-web-e2e-ci-change-summary.md` | WEB-1 全角色 E2E 与 CI 阶段修改内容、范围、意义、验证结果和未完成边界。 |
| `ary-web-next-step-checklist.md` | `web/` 正式工程化下一步检查清单。 |
| `ary-role-flow-playwright-audit.md` | 角色数据流与浏览器审计记录。 |
| `ary-mobile-ux-review.md` | 移动端 UX 静态审计记录。 |
| `ary-ux-finish-v2-summary.md` | UX-1 收尾 v2 汇总记录。 |
| `ux-hifi.taskbook.md` | UX-1 高保真原型任务书，定义视觉为主、体验为先的原型工作方式。 |
| `registration-ca-rules-alignment.taskbook.md` | PRD-TEMP-1 整改任务书与并入记录，承接报名、RaceProject 自动生成、CAConnection 动态接入和评审前风险提示的一致性整改。 |

## 阅读建议

* 产品或范围问题：先读 `ary-mvp.prd.md`。
* 报名、RaceProject、CA 参赛语义调整：读 `registration-ca-rules-alignment.taskbook.md`，再同步 PRD、领域、IA、权限、QA、OPS 和 CA 契约。
* 架构、模型或权限问题：先读 `ary-dev-1-dev-3-delivery.md`，再按需回看 `ary-domain-analysis.v0.3.md` 和 `ary-permission-matrix.md`。
* 风险评审中心、ReviewFlag 处理流或后续合并：读 `ary-risk-center.md`，再回看 `ary-permission-matrix.md` 和 `ary.plan.md`。
* 后续开发闭环或正式集成应用问题：读 `ary-dev-4-to-ops-delivery.md` 和 `ary-web-next-step-checklist.md`，再运行 `../web/` 下的 Next.js 应用与 `npm test`。
* 页面和体验问题：读 `ary-mvp.ia.md` 与 `ux-hifi.taskbook.md`，必要时参考 `../design-prototype/`。
* 项目推进问题：读 `ary.plan.md`，再看根目录 `PLAN.md`。
* 验收和上线问题：读 `ary-qa-plan.md` 与 `ary-release-ops-plan.md`。
