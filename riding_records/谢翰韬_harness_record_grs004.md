# ARY Web E2E 与 CI — Riding Record

文档类型：Riding / Harness Orchestration Record  
记录时间：2026-07-13  
记录角色：项目推进与 Agent 指挥方（第一人称）  
覆盖范围：项目理解、下一步方向判断、全角色 E2E、CI 集成和验收收口  
关联产物：`docs/ary-web-e2e-ci-change-summary.md`、`web/e2e/`、`.github/workflows/web-ci.yml`

---

## 0. 一句话总结

这段时间我没有继续要求 Agent 横向增加功能，而是先判断 ARY 已经处在“本地可演示、尚未生产可信”的阶段，再把工作重心逐步收紧到浏览器 E2E 和 CI：先验证 Judge、Public、Screen，再补齐 Rider、Organizer、Admin，最终形成 9 个浏览器场景、20 个领域测试和两个 CI Job，让项目从“功能写出来了”推进到“关键行为能够被重复证明”。

## 1. 我如何理解项目阶段

### 我的起始指令

我先要求 Agent“理解项目情况”，而不是立即修改代码。我的目的，是先确认：

* 当前正式入口是什么；
* 产品和领域口径是否稳定；
* 已经完成到哪个阶段；
* 下一步最值得投入的工程问题是什么。

### Agent 给出的信息

Agent 阅读了 `PLAN.md`、`STATUS.md`、PRD、任务计划、文档路由、`web/README.md`、代码结构和 Git 状态，确认：

* `web/` 是当前正式工程入口；
* 技术栈是 Next.js、React、TypeScript、Prisma 和 SQLite；
* Public、四角色 Console、CA、Projection、Screen、Report、Results 和 Ops 已具备本地闭环；
* 项目已经可演示，但真实 OAuth、CAConnector、浏览器自动化和部署流水线仍未生产化。

### 我的判断

我认可“停止横向扩功能、优先建立可信工程基线”的方向。项目此时最缺的不是另一个页面，而是证明已有页面、权限和状态流不会在后续修改中回归。

这个判断决定了后续工作顺序：

```text
先确定阶段
→ 再选择最有杠杆的质量问题
→ 先做关键场景
→ 再补全角色矩阵
→ 最后进入 CI
```

## 2. 我如何引导下一步开发方向

我要求 Agent 给出下一步发展方向。经过讨论，我把优先级理解为：

1. 真实身份和服务端权限；
2. 可重复的多角色浏览器 E2E；
3. CAConnector 与 staging / production 工程化。

我没有立即同时启动所有方向，而是选择 E2E 作为当前切入口，原因是：

* 它可以直接验证现有产品闭环；
* 它会暴露前端、权限、数据和状态持久化之间的真实问题；
* 它能成为后续 OAuth、CA 和部署变更的安全网；
* 它具备清晰、可量化的完成口径。

## 3. 第一轮指挥：Judge、Public、Screen E2E

### 我的指令

我明确提出：

> 增加 Judge、Public、Screen E2E。

这三个场景分别代表：

* Judge：敏感的 review-only 内容和评审写入；
* Public：公开数据边界和用户观看主路径；
* Screen：现场展示控制权和 fallback 稳定性。

### 我关注的验收重点

我希望验证的不只是页面可以打开，而是：

* 未登录用户不能进入 Judge 页面；
* Judge 提交后数据刷新仍存在；
* review-only Work 在页面和 API 两层都不可公开；
* Screen 未授权用户只能读，Organizer 才能控制；
* Console 状态能同步到 Display；
* Projection 异常时 fallback 可用。

### Agent 执行中的关键发现

Agent 在写 Judge E2E 时发现：Judge 页面虽然读取 review-only Work，但没有在页面入口校验当前用户是否被分配该作品。

这说明我的 E2E 要求发挥了作用：它不是为已有实现“补一个绿灯”，而是迫使系统面对真实权限边界。随后 Agent 修复了 role、assignedWorkIds 和具体 Assignment 三层校验。

### 我接受的工程调整

执行过程中出现了几个基础设施问题：

1. `tsx` CLI 在受限环境下创建 IPC 失败；
2. Prisma `--force-reset` 被危险操作保护拦截；
3. 手工 SQLite 初始化器缺少 `ScreenState`，与 Prisma schema 漂移；
4. 测试若复用 `dev.db` 会污染开发数据。

我支持 Agent 把测试环境改为独立 `e2e.db`，使用 Node 原生 `--import tsx`，并修复 SQLite 初始化器，而不是绕过保护或直接重置开发库。

这个选择体现了我的边界判断：测试应当可重复，但不能以破坏开发数据为代价。

### 第一轮结果

第一轮形成 6 个 E2E：

* Judge 2 个；
* Public 2 个；
* Screen 2 个。

同时通过领域测试、TypeScript、静态烟测、production build 和实际浏览器抽查。

## 4. 第二轮指挥：补齐 Rider、Organizer、Admin 与 CI

### 我的追加指令

第一轮通过后，我没有把“6 个测试通过”当作最终完成，而是继续要求：

> 完成 Rider、Organizer、Admin E2E 和 CI 集成。

这一步把局部验证扩展为完整角色矩阵，并要求自动化真正进入团队工作流。

### 我对三角色的理解

#### Rider

Rider 不是只验证登录，而要证明：

```text
approved Registration
→ RaceProject
→ 合法 CA Signal
→ active 状态
→ Work 提交
→ 刷新后持久化
```

#### Organizer

Organizer 要验证 Race-scoped 管理能力，而不是只验证管理按钮存在：

```text
创建 private/draft Race
→ Race switch
→ 当前 Race 上下文正确
→ 发布为 public/running
→ 公共 API 可见
```

#### Admin

Admin 要验证 `User.roles` 真实写入，并在测试结束时恢复 Seed，避免影响后续 Judge 测试。

### 我认可的测试数据策略

为了给 Rider 提供完整而又不影响 Public/Judge 的数据流，Agent 增加了测试专用 Rider。我认可测试数据不应污染日常演示的边界，因此最终 Fixture 只在 `DATABASE_URL` 指向 `e2e.db` 时创建。

这避免了普通开发 Seed 中出现“E2E Rider”，也避免 Rider 提交 Work 后改变现有公开作品或 Judge assignment。

### CI 的指挥边界

我把 CI 的验收目标定为既覆盖工程质量，也覆盖真实浏览器行为；Agent 将其实现为两个并行质量门：

| 质量门 | 我的目的 |
| --- | --- |
| 静态、领域和构建 | 快速发现结构、类型、领域不变量和 production build 回归 |
| 浏览器 E2E | 验证真实用户路径、权限和持久化 |

CI 使用只读权限，浏览器失败时保留 trace、截图和报告。对于无法在本地证明的部分，我保留了明确边界：Workflow 文件已经集成并本地复现，但 GitHub-hosted Runner 首次结果必须在推送后确认，不能提前宣称远程 CI 已经绿色。

## 5. 我在过程中的关键决策

### 决策 1：先理解项目，再决定开发方向

我没有把 Agent 当成代码生成器直接下达模糊开发命令，而是先要求它读取权威文档、技术入口和当前状态。这让后续投入落在正式 `web/` 工程，而不是历史原型或已删除的 `app/`。

### 决策 2：优先验证已有闭环，不继续堆功能

当项目已经具备本地 MVP 时，我选择 E2E 和 CI，而不是继续添加社区、团队赛、多租户或 AI 自动评审。这保持了 MVP 范围，也提高了首场赛事的可信度。

### 决策 3：用权限和公开边界定义 E2E

我没有把“页面返回 200”当成完成，而是要求验证角色隔离、assignment、review-only、API 边界和 Screen 控制权。这直接促成了 Judge 权限缺口的发现与修复。

### 决策 4：测试数据库必须独立

当初始化过程触发危险 reset 保护时，我选择建立独立 `e2e.db`，而不是授权重置开发库。这个决策让测试具备可重复性，也让数据安全边界更清楚。

### 决策 5：区分本地证据和远程证据

本地可以证明 Workflow YAML、命令、E2E、领域测试和 build 通过，但不能证明尚未推送的 GitHub-hosted Runner 已成功。我在最终验收口径中保留这一差异，避免过度汇报。

## 6. Agent 的执行表现

Agent 在本轮表现出的有效能力包括：

* 从文档、代码和测试三类证据判断项目阶段；
* 把产品角色路径转成浏览器可执行断言；
* 在 E2E 中主动识别 Judge 权限缺口；
* 面对 `tsx`、Prisma reset、schema 漂移时选择安全替代方案；
* 使用稳定 `data-testid`，降低测试对页面结构的脆弱依赖；
* 用条件 Fixture 隔离测试数据；
* 将验证拆成领域、类型、构建、浏览器和实际烟测多层证据；
* 同步更新 README、PLAN、STATUS，减少实现与项目状态漂移。

需要继续关注的能力边界：

* 当前 CI 尚未得到 GitHub-hosted Runner 的实际结果；
* OAuth 和 CAConnector 仍然是本地 fallback / mock 边界；
* 尚未形成移动端 E2E 和视觉差异基线；
* 生产数据库 migration、监控和回滚仍需后续推进。

## 7. 最终验收证据

| 证据 | 结果 |
| --- | --- |
| 全角色 / Public / Screen Playwright | 9/9 |
| 领域测试 | 20/20 |
| 静态烟测 | 17 页面路由、14 API 路由通过 |
| TypeScript | 通过 |
| Next production build | 通过 |
| 实际浏览器角色隔离抽查 | Rider / Organizer / Admin 通过 |
| GitHub Actions Workflow | 文件已落盘，本地 YAML 解析通过；远程首次运行待推送 |

## 8. 我的阶段复盘

这轮 Riding 的核心价值，不是多写了三个测试文件，而是建立了一套推进方法：

```text
读权威文档确认阶段
→ 选择高杠杆问题
→ 用角色和权限定义验收
→ 用自动化暴露真实缺口
→ 采用安全的数据隔离
→ 让本地证据进入 CI
→ 对未验证的外部结果保持诚实
```

我对 Agent 的指挥不是逐行指定实现，而是持续控制目标、范围、验证口径和风险边界。Agent 负责调查、实现和复验；我负责决定“现在最该解决什么”“什么结果才算完成”“哪些结论还不能提前宣布”。这正是本轮 Riding 表现中最希望展示的能力。
