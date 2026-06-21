# Riding Record：ARY GRS003 MVP Implementation

## 一、任务背景

本次 Race 的主题是 ARY GRS003，核心任务是基于前两轮对 ARY 的产品定义和展示系统理解，继续推进 ARY MVP 的需求、原型、领域模型、权限、CA 接入、赛事闭环和本地可演示实现。

与 GRS001 主要关注 Product Definition、GRS002 主要关注 Jumbotron 子系统不同，GRS003 更强调把项目真正往前推进：不仅要整理 PRD、IA、UX 和领域文档，还要形成可走查、可验证、可演示的 MVP 闭环。

本次过程中，我使用 AI Agent 协助完成项目理解、任务拆分、代码检查、功能推进、CA 防伪机制补充、前端交互 polish、测试验证和交付记录整理。整个过程不是一次性生成结果，而是围绕项目要求不断分析、实现、验证和修正。

## 二、Riding Plan 骑行计划

本次任务被拆分为几个阶段推进：

1. **理解 GRS003 项目要求**：阅读 `ary-grs-003-Xiamch1117` 中的 README、PLAN、STATUS 和 docs，确认任务重点。
2. **分析当前仓库进度**：检查 `GRS003` 仓库中已有的 `docs/`、`design-prototype/`、`app/` 和 `web/`。
3. **确认已完成阶段**：判断项目已经完成到 DEV-1 至 DEV-7 的本地 MVP 闭环。
4. **补齐安全、防伪、反作弊要求**：围绕 CA 上报消息是否来自真实 CA / OCR Desktop App，补充 attestation 机制。
5. **优化前端交互体验**：对 Console、Ops、Screen 等页面进行 polish，使演示路径更清楚。
6. **补充验证能力**：增加静态 smoke check，保证页面、API、CA 防伪和关键交互不被误删。
7. **整理交付说明**：更新 PLAN、STATUS、交付文档和 Riding Record，便于 checkpoint 汇报。

这个计划的核心判断是：GRS003 不能只停留在“文档写完”或“页面看起来有了”，而要证明 MVP 主流程能走通，并且能回应项目新增的安全、防伪和质量要求。

## 三、Agent 产出

Agent 在本次 GRS003 推进中主要完成了以下内容：

- 分析项目当前状态，确认项目已从文档 / 原型阶段推进到本地 MVP 闭环阶段。
- 梳理五人小组分工，把任务拆成 PRD、领域/权限、UX、CA 契约和 QA/OPS 五条线。
- 检查 `GRS003` 仓库结构，确认 `web/` 已作为正式工程化入口。
- 补充 `web/scripts/static-smoke.mjs`，用于无依赖检查 16 个页面路由、13 个 API 路由、Prisma 模型、OAuth 配置和关键交互。
- 更新 `web/package.json` 和 `web/README.md`，增加 `check:static` 验证入口。
- 补充 CA attestation 契约，要求 CA 信号必须来自 OCR Desktop App 或已登记 connector。
- 在本地 MVP 的 `app/domain.js` 中实现 CA 信号防伪校验。
- 在 `app/domain.test.js` 中新增“伪造 CA 信号无 attestation 会被隔离”的测试。
- 在 `web/lib/domain.ts` 中同步服务端 CA attestation 校验边界。
- 优化 Console 前端交互，包括流程条、CA Trust、Review Risk、CA attestation 面板、状态标签和空状态。
- 优化 Ops 页面，增加 Release readiness 面板。
- 优化 Screen Console，增加当前大屏输出预览。
- 更新 `PLAN.md`、`STATUS.md` 和 `docs/ary-dev-4-to-ops-delivery.md`，使文档与实现保持一致。

## 四、人工审查与修正

### 1. 任务边界修正

最开始容易把 GRS003 理解成继续写文档或简单做页面。但通过阅读项目要求后，我们确认 GRS003 的重点是项目推进、质量和完成度，而不是只补一两个功能点。

人工判断后，将任务目标调整为：

- 完成 DEV-1 到 DEV-7 的本地 MVP 闭环；
- 保留原有文档和原型成果；
- 将正式工程化入口放在 `web/`；
- 对安全、防伪、反作弊要求做明确回应。

### 2. CA 接入语义修正

原有 CA 接入已经包含 CAConnection 登记、握手、合法信号接入、非法信号隔离和 Projection 生成，但对“消息是否来自真实 CA / OCR Desktop App”表达不够强。

因此我要求 Agent 继续补充：

- `attestation.source`；
- `attestation.signingKeyId`；
- `attestation.signature`；
- `attestation.signedAt`；
- 缺少认证声明或签名不匹配时隔离信号；
- 本地演示使用 `dev-signature:<connectorId>:<idempotencyKey>` 模拟签名；
- 生产环境后续替换为 HMAC 或公私钥验签。

这一修改让项目能明确回应老师提出的安全、防伪、反作弊要求。

### 3. 前端交互修正

项目已有页面和功能，但部分页面更像“功能堆叠”，汇报时不够直观。人工审查后，我要求 Agent 优化交互展示，而不是继续新增无关功能。

主要修正包括：

- Console 增加 MVP 流程条；
- Console 展示 CA Trust 和 Review Risk；
- Rider View 展示 CA anti-forgery 信息；
- Judge View 增加空状态；
- Ops 页面展示发布就绪度；
- Screen Console 展示当前大屏输出预览；
- 移动端布局防止挤压和重叠。

这些修改的目标是让项目在 checkpoint 展示时更容易被理解。

### 4. 验证方式修正

由于当前环境中 `web/` 依赖安装超时，无法稳定完成完整 Next.js build。为了不让验证停住，Agent 增加了无依赖静态检查脚本。

这个脚本不能替代最终 build，但可以检查：

- 页面路由是否存在；
- API 路由是否存在；
- `.env.example` 是否包含 OAuth 和数据库配置；
- Prisma 核心模型是否存在；
- Console / Ops / Screen 关键交互是否存在；
- CA attestation 相关实现是否存在；
- CSS 基础结构是否平衡。

## 五、关键决策记录

### 决策一：保留历史成果，不重写项目

项目中已有 `docs/`、`design-prototype/`、`app/` 和 `web/`。我们决定不推翻已有内容，而是在现有基础上继续推进。

理由：

- `docs/` 是 PRD、IA、领域模型和验收基线；
- `design-prototype/` 是 UX-1 高保真原型证据；
- `app/` 是 DEV-4 到 OPS-1 的本地 MVP 闭环；
- `web/` 是正式工程化入口。

### 决策二：GRS003 当前完成口径定为 DEV-1 到 DEV-7

经过检查，当前项目已经覆盖：

- DEV-1：领域模型、权限、数据模型；
- DEV-2：Public Site 静态闭环；
- DEV-3：登录、角色、Console；
- DEV-4：报名、RaceProject、Work、Judge；
- DEV-5：CA 接入、Projection、Live Hall；
- DEV-6：Screen Console、大屏；
- DEV-7：Report、Review、Results。

因此可以汇报为：DEV-1 到 DEV-7 已完成本地 MVP 闭环。

### 决策三：CA 失败不阻断参赛，但伪造信号必须隔离

我们保持原有产品口径：CA 接入异常不作为参赛资格硬门禁，不自动取消提交、评审或 Award 资格。

但同时增加安全口径：

- 合法 CA 信号可以进入 Session、Evidence 和 Projection；
- 缺少 attestation、签名不匹配、来源异常的信号必须隔离；
- 隔离信号不能进入 Evidence、Projection 或 Report；
- 风险应进入评审前提示。

这样既符合 PRD 中“CA 不是硬门禁”的规则，也符合新增的防伪要求。

### 决策四：web/ 作为正式工程化入口

`app/` 继续作为本地 MVP 演示和领域测试证据，`web/` 则作为正式工程入口。

当前 `web/` 已包含：

- Next.js App Router；
- Prisma + SQLite；
- GitHub OAuth / fallback 登录；
- Public API；
- Console / Ops / Screen 页面；
- 服务端领域动作；
- 静态 smoke check。

下一步应该继续完善 `web/` 的 build、E2E、真实 OAuth、真实 CAConnector 和部署。

## 六、最终成果

本次 GRS003 推进后，当前项目成果包括：

1. PRD / IA / 领域模型 / 权限矩阵等文档基线；
2. UX-1 高保真原型；
3. DEV-1 到 DEV-3 的架构和原型交付记录；
4. DEV-4 到 OPS-1 的本地 MVP 应用；
5. `app/domain.test.js` 10 个领域测试；
6. CA attestation 防伪机制；
7. `web/` Next.js 正式工程入口；
8. `web/scripts/static-smoke.mjs` 静态验收脚本；
9. Console / Ops / Screen 的前端交互 polish；
10. 更新后的 PLAN、STATUS 和交付文档。

当前可以汇报的完成度是：

```text
已完成 DEV-1 到 DEV-7 的本地 MVP 闭环；
REL-1 / OPS-1 已完成本地演练入口；
WEB-1 已建立正式工程入口，正在进入工程化验证阶段。
```

## 七、验证过程

本次验证主要包括：

```text
node app/domain.test.js
```

结果：

```text
10 个测试全部通过
```

覆盖内容包括：

- 重复报名幂等；
- Registration approved 后 RaceProject 幂等生成；
- 非法 CA 信号隔离；
- 合法 CA 信号进入 Session / Evidence；
- 缺少 attestation 的伪造 CA 信号隔离；
- CA 失败不阻断 Work、Judge、Award；
- Projection 失败不污染事实数据；
- rider_report 私有、review_summary 公开；
- Report 生成失败不覆盖已发布公开报告；
- REL / OPS P0 回归形成发布和备份证据。

同时运行：

```text
node web/scripts/static-smoke.mjs
```

结果：

```text
STATIC SMOKE PASSED
Checked 16 route pages and 13 API routes.
```

此外还执行了 `node --check` 检查关键 JS 文件语法。

## 八、当前限制

当前项目仍有一些限制：

- `web/` 依赖安装在当前环境中超时，完整 Next.js build 尚未在本次环境中完成；
- GitHub OAuth 真实生产配置仍需团队在本地或部署环境中验证；
- CAConnector 目前是本地模拟，尚未接入真实 OCR Desktop App 或真实 CA 服务；
- attestation 目前使用 `dev-signature` 模拟签名，生产环境需要替换为真实 HMAC 或公私钥验签；
- 浏览器 E2E 自动化和截图验收仍需后续补齐；
- 部署、监控、灰度、回滚仍处于后续工程化阶段。

## 九、反思与收获

本次 GRS003 的最大收获是：Agent 可以快速推进大量文档、代码和测试工作，但人必须持续判断“这些工作是否贴合 Race 要求”。

在这次过程中，Agent 擅长：

- 快速阅读仓库结构；
- 总结当前进度；
- 找出代码和文档不一致的地方；
- 补充测试；
- 生成交付记录；
- 做前端交互 polish；
- 将安全规则同步到文档和代码。

但人工判断仍然非常关键，尤其体现在：

- 判断 GRS003 不只是继续写文档，而是要推进 MVP；
- 判断 CA 防伪是新增要求的重点；
- 判断 `app/` 和 `web/` 的职责边界；
- 判断前端 polish 应服务 checkpoint 展示，而不是盲目新增页面；
- 判断哪些内容可以作为本地 MVP 完成，哪些仍属于生产级后续工作。

这说明 Agent Riding Skill 不是“让 Agent 自动写完项目”，而是持续提出正确问题、识别偏差、控制边界、推进实现并完成验收。

## 十、下一步计划

如果继续推进 GRS003，下一步优先级是：

1. 在本地稳定安装 `web/` 依赖；
2. 跑通 `npm.cmd test` 和 `npm.cmd run build`；
3. 配置真实 GitHub OAuth App；
4. 验证真实登录回调；
5. 接入真实 OCR Desktop App / CAConnector；
6. 将 `dev-signature` 替换为真实签名校验；
7. 补充浏览器 E2E 自动化测试；
8. 录制 checkpoint 演示视频；
9. 准备最终汇报材料；
10. 推进部署、灰度、监控和回滚演练。

## 十一、总结

本次 Riding Record 记录了我使用 AI Agent 推进 ARY GRS003 的过程。通过多轮分析、实现、验证和修正，项目从原有文档和原型基础上继续推进到了 DEV-1 至 DEV-7 的本地 MVP 闭环，并补齐了 CA 防伪机制、前端交互 polish、REL / OPS 本地演练入口和静态验收能力。

最终成果不仅能说明“项目做到了哪里”，也能说明“为什么这样做符合 GRS003 要求”。这次过程体现了 Agent 在项目推进中的高效执行能力，也体现了人工在方向判断、边界控制和最终验收中的作用。

