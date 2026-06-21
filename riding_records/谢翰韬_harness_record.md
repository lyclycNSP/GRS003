# ARY UX 收尾 v2 — 指挥过程记录 (Harness Orchestration Log)

> 文档类型: Harness Orchestration / Leadership Log (评分展示材料)
> 版本: v1
> 时间: 2026-06-20
> 关联窗口: `UX-1 收尾 v2` (t1 cross-view empty/error + t2a Race 详情 + t2b Work Judge + t3 移动端审计)
> 配套技术总结: `docs/ary-ux-finish-v2-summary.md`
> 角色分工: 指挥方 (我 / andrew) — 设定目标、拆 plan、做决策;执行方 (Mavis + worker agents) — 写代码、跑 gate、生成截图

---

## 0. 一句话总结

本工作窗口由我作为指挥方,定下"补齐 UX-1 收尾 v2 三档 (有内容 / 有空态 / 移动端可读)"的目标,把任务拆成 4 个子任务派给 Mavis 团队(opencode)跑 plan;过程中踩到两个工程坑 (engine gate 误判 + commit hunk 交错),都现场拍板解决,没让窗口漂掉;最后通过本地 server + 4 条直达 URL 完成可点击验收,文档基线同步一次落盘。

---

## 1. 起手:定目标,拆窗口

### 1.1 当时卡在哪

`docs/ary-dev-4-to-ops-delivery.md` 验收通过后,我心里清楚 `M2` 架构设计的输入还差两档:

1. **有内容**: design 原型虽然有页面,但 Race Page 只覆盖 `upcoming` / `completed` 两个阶段,Work Page 三视角少一个 Judge。
2. **有空态**: `app/` 本地 MVP 的"空状态"是散落的字符串 (`"No registrations"` 等),演示时容易被评审误读为功能缺失。
3. **移动端可读**: 1080P 桌面视口能看,但 360×640 手机视口从来没走过。

这三档不补齐,后面给 `M2` 做架构设计时基线不稳。我把这三档定成本窗口的核心目标。

### 1.2 我做的拆分

我决定拆 4 个子任务,**而不是一个大任务** —— 因为这三档的代码落点完全不同 (app/ vs design-prototype/ vs docs/),混在一个 plan 里 worker 互相干扰、hunk 也会交错:

| # | 子任务 | 范围 | 判定标准 |
| --- | --- | --- | --- |
| **t1** | cross-view empty/error state | `app/` 8 视图 | 19+1 处空态/错误态统一,领域测试不受影响 |
| **t2a** | Race Page `in_progress` 详情态 | `design-prototype/` Race Page | leaderboard + event-stream 双子面板,1080P 不挤 |
| **t2b** | Work Page Judge 视角 | `design-prototype/` Work Page | 5 hooks + renderWorkJudge(),三视角→四视角 |
| **t3** | `app/` 移动端 UX 静态审计 | `app/` 8 视图 × 2 视口 | 出审计报告,0 P0,P1/P2 留排期 |

**决策点 #1**: t1 必须是"纯展示层改造" —— 我在派 plan 前就跟 Mavis 对齐了边界"不改任何领域行为",这个边界后来救了 t3 (审计有稳定基线可比对)。

---

## 2. 组队:plan 拆解与并发策略

### 2.1 plan 结构

我让 Mavis 拉团队跑 `mavis team plan`,plan 里:

- 4 个 task = 4 个 worker agent,并发上限压到 2-3 (我之前踩过 13 并发 daemon crash 的坑,这次主动降并发)
- t1 / t2a / t2b / t3 各自独立交付物 + 独立验证
- 验证关卡:
  - `node --check` 语法
  - 关键禁词扫描 (PRD / 需求说明 / 实现术语口吻)
  - 截图存在性
  - `app/domain.test.js` 9 个 P0 用例不回归

### 2.2 一个反直觉但正确的选择

**t3 是"纯审计,不动源码"**。这看起来像"偷懒",但我有两层判断:

- **范围隔离**: 移动端修复大概率要 P1 一行 CSS、P2 设计草图,跟 t1/t2 改动混在同 plan 里会让评审分不清"这一坨是修 bug 还是补基线"
- **证据前置**: 先出审计报告 → 下窗口再排修复 → 这样下窗口可以**按审计结论排期**,而不是边修边发现更多问题

我让 Mavis 在 plan.yaml 里把 t3 标成 `read_only: true`,worker 拿到的 prompt 写明"严禁修改 app/ 或 design-prototype/ 任何源文件"。

---

## 3. 执行:worker 跑批的过程

执行阶段我**没有逐 worker 干预**。这其实是刻意为之 —— 团队跑批的价值就在于"批量出去,统一收敛"。我只在三个节点拉回来看:

1. plan 启动后,确认 4 个 worker 都拿到了正确的 task prompt (没有 prompt 漂移)
2. 大约中段,扫了一眼 worker 的中间产物 (Mavis 自动汇报)
3. 收尾,看 verifier 的判定

中间不打扰 worker 是因为我的工程经验:**中途插话比不动更糟**,worker 一被打断就容易丢上下文、要重读 prompt、要重新对齐边界,反而慢。

---

## 4. 第一次救场:engine gate 的 CWD=/ 误判

### 4.1 现象

worker 全部交付完,我准备让 Mavis 收尾 → 引擎跑 plan.yaml 里的 script-syntax gate,所有 task **全部 FAIL**:

```
Error: Cannot find module '/design-prototype/script.js'
exit code 1
```

但我让 Mavis 在 workspace 里手动复跑 `cd design-prototype && node --check script.js`,**exit 0,完全没问题**。

### 4.2 我做的根因判断

这个错信息很可疑 —— 路径前缀 `/` 是绝对路径的根,不是 workspace。我马上想到:**引擎跑 gate 的 CWD 不是 workspace,而是系统根 `/`**。

回头看 plan.yaml 里 `node --check design-prototype/script.js` 是**相对路径**,引擎在 CWD=`/` 下解析 → 拼成 `/design-prototype/script.js` → 文件不存在 → FAIL。

**这是引擎的 bug,不是 worker 的 bug**。我做了两件事:

#### 决策点 #2: 用 `override_accept` 覆盖 gate 误判

我没让 worker 回去改源码,也没让 Mavis 去 plan.yaml 里把相对路径改成绝对路径再重跑 (那样所有 worker 要重 spawn,代价太大)。

我让 Mavis 直接在 decision 里写 `override_accept`,理由写清楚:

> worker 实质交付已通过客观检查: `cd /Users/.../GRS003 && node --check design-prototype/script.js` exit 0;grep hook 检查通过;禁词扫描通过;git diff scope 正确;截图存在。gate 误判根因是引擎跑 gate 时 CWD=`/` 而 plan.yaml 用的是相对路径。

#### 决策点 #3: 记入 Mavis memory

这不是一次性事件,是**引擎的系统性问题** —— 以后任何 plan.yaml 用相对路径 gate 都会踩。

我让 Mavis 写了一条 memory entry (`memory/mavis-team-plan-orchestration.md` 增补):

> **mavis team plan: script-syntax gate 跑在 CWD=/ 找不到相对路径** — plan.yaml 的 gate 写 `node --check xxx.js` (相对路径),引擎跑 gate 报 `Cannot find module '/xxx.js'`,exit code 1。根因: 引擎跑 gate 的 CWD 是系统根 `/`,不是 plan workspace。**正解**: 写新 plan.yaml 前,任何 gate command 都必须用绝对路径或显式 `cd` 切到 workspace。

这条 memory 后面会救我自己和其他人,不是只解决眼前这一次。

### 4.3 为什么这是"救场"而不是"绕过"

- **没绕过**: override_accept 是 plan engine 的标准 verdict 分流之一,我用了它的合法路径,没有绕过 SOP
- **有证据链**: 我要求 Mavis 手动跑全套客观检查 (node --check / grep / 禁词扫描 / git diff / 截图),全部 PASS 才接受
- **有沉淀**: 写进 memory,下个窗口就不会再踩

---

## 5. 第二次调整:commit 粒度 4→3

### 5.1 现象

gate 收尾后,我让 Mavis 按最初方案分 **4 个 commit**:

1. app/ 端 t1 空态/错误态
2. Race Page in_progress (t2a)
3. Work Page Judge (t2b)
4. docs (t3 审计 + STATUS/PLAN/AGENTS + 6 份 docs/*.md)

Mavis 在写 commit 前先做了一遍 file-level diff 盘点,然后告诉我:**t2a 和 t2b 在 `design-prototype/index.html` / `script.js` / `styles.css` 三个核心文件里 hunks 互相交错**。

具体来说:

| 文件 | t2a hunks | t2b hunks | 能拆吗 |
| --- | --- | --- | --- |
| `index.html` | race-detail hero / progress | work-judge section / jury-row | ❌ 交错 |
| `script.js` | `renderRaceDetail` / `setPage` | `renderWorkJudge` / `parseHash` 分支 | ❌ 6 hunks 交错 |
| `styles.css` | `.page-race-detail` / `.stage-*` | `.page-work-judge` / `.work-judge-*` / `.jury-*` | ❌ L2123 起 700 行 1 个 hunk |

Mavis 给了两个强行 4 commit 的方案:
- **A. `git add -p` 按 hunk 拆**: styles.css 整块是 1 个 hunk,根本拆不动;index.html / script.js 也拆不干净
- **B. 先 commit t1+t2a+docs,再 reset 出来手动分 t2b**: 折腾,容易出错

### 5.2 我的判断

我听完两个方案都没立刻接话。我心里的判断标准是:**commit 粒度是为了让 reviewer 能独立 review、让出问题时能单独 revert**。如果 4 commit 拆不开,那 4 commit 就只剩"心理上整齐",工程上没价值。

**决策点 #4: 接受 3 commit**

我决定改成 3 commit:

1. app/ 端 t1 (空态/错误态) — 物理上独立,跟 design 原型无关
2. design 原型 v0.4 (t2a Race + t2b Work Judge 合并) — 共享 3 个核心文件,hunks 物理交叉,本来就是同一个 plan 跑出来的,合并 commit 信息量不丢
3. docs (t3 审计 + STATUS/PLAN/AGENTS + 6 份 docs/*.md) — 物理上独立

我跟 Mavis 对齐的措辞:

> t2a + t2b 物理上同属 `UX-1 收尾 v2`,本来就是同一个 plan 跑出来的产物,共享 3 个核心文件 hunks 交叉,合并 commit 信息量不会丢,反而能避免 hunk 拆错的回归风险。

这个判断的核心是:**commit 是工程工具,不是仪式**。拆不开就别硬拆。

---

## 6. 验收:本地 server + 4 条直达 URL

### 6.1 我想要的验收方式

技术总结写完、commit 粒度定完,我没让窗口就这么关掉。我要做**可点击验收** —— 不是看截图、不是看文档,是真打开浏览器点一下。

我跟 Mavis 说:**"打开新写的页面在 localhost 中"**。

### 6.2 Mavis 给的方案

Mavis 拉了一个 Python 静态 server (`python3 -m http.server 8765`),后台跑,PID 93859,日志在 `/tmp/ary-dev-server.log`,然后给了我 4 条直达 URL:

| 页面 | URL |
| --- | --- |
| 入口首页 | `http://127.0.0.1:8765/` |
| Race · 湾区开心游 · in_progress | `http://127.0.0.1:8765/#race/bay-area-happy-trip` |
| Race · 智能投研助理 · in_progress | `http://127.0.0.1:8765/#race/smart-investment-analyst` |
| Work · GBA WanderMate · Judge | `http://127.0.0.1:8765/#work/work-gba-wander/judge` |
| Work · LocalJoy Agent · Judge | `http://127.0.0.1:8765/#work/work-localjoy/judge` |

### 6.3 为什么这个验收方式重要

**评审演示场景的实战要求**。如果我只交付截图,评审现场问"这块能不能点",我就只能回答"理论上能"。有了 localhost 直达 URL,我可以现场点开,leaderboard 实时榜 + event-stream 事件流 + Judge 5 阶段评审工作面板都能跑 —— 这是 design 原型作为 `M2` 架构设计输入的**最低门槛**。

也方便我自己**回放** —— 这次窗口关掉之后,哪天想复盘 Race Page 详情态长什么样,直接开 URL 就行,不用重跑 plan。

---

## 7. 文档基线同步

这一步是我在派 plan 时就**强制要求的收尾动作**,不是 Mavis 自己加的。原因是:这一类"小窗口增量"最容易在文档里漂掉 —— 任务表里没记、证据索引没挂、下个窗口接手的人不知道这次产了什么。

我让 Mavis 同步更新:

| 文件 | 改什么 |
| --- | --- |
| `STATUS.md` | 证据索引 +3 行 (Race 详情 / Work Judge / 移动端审计),UX-1 收尾 v2 状态行,8 视图任务表行刷新 |
| `PLAN.md` | 近期任务表 UX-1 收尾 v2 行落定 |
| `AGENTS.md` | +1 行 (本轮工作流微调) |
| 6 份 `docs/*.md` | 把 t1 / t2a / t2b / t3 产物链接补到对应任务的"已交付证据" |

**决策点 #5: 同步范围是 Mavis 提的,但 6 份 docs/*.md 的具体挑选是我拍的**

Mavis 问我"哪些 docs/*.md 要同步",我没让 Mavis 拍板,我对照 `docs/README.md` 的文档路由图,挑了真正会被新窗口引用的 6 份 (ca-integration-spec / dev-1-dev-3-delivery / dev-4-to-ops-delivery / permission-matrix / qa-plan / release-ops-plan),其余 `domain-analysis` / `mvp.ia` / `mvp.prd` 这次不直接相关,不动。

这个判断的依据是:**文档同步的价值 = 下次有人翻到这份文档时,能立刻看到这次产物的链接**。不相关的文档硬同步反而稀释信号。

---

## 8. 反思与沉淀

### 8.1 做对的 3 件事

1. **plan 拆 4 个独立 task 而不是 1 个大 task** — 让 worker 边界清晰、hunk 干扰最小 (虽然 t2a/t2b 仍然交了错,但这是物理限制不是 plan 问题)
2. **gate 误判用 override_accept + 写 memory** — 既解眼前,又沉淀系统,不是一次性的绕过
3. **要求可点击验收 (localhost)** — 把"截图可信度"升级到"浏览器可跑",这是 design 原型作为架构输入的最低门槛

### 8.2 下次能更好的 1 件事

**worker plan 之前先做静态 file-level diff 预测**。

这次的 hunk 交错问题,是 Mavis 在写 commit 前才盘点出来的。如果我在派 plan 前就**先让 Mavis 在 mock 空分支上跑一遍 dry-run diff**,就能预测到 t2a + t2b 会交,直接把 plan 写成 3 task 而不是 4 task,worker 不需要跑出交错 hunks 又被拆,效率更高。

下次窗口的 SOP 调整:

- plan 启动前,先做一遍 "diff 预演":在隔离 worktree 起空分支,模拟 4 个 task 的 file-level 改动边界,看哪些文件会被多个 task 同时改
- 凡是有 2+ task 共享核心文件的,直接合并 task,不让 worker 跑出交错 hunks 再回头拆

### 8.3 不能算"做错"但需要承认的局限

- **浏览器自动化截图链路未跑通** (headless Chrome 不可用) — 本轮用"静态 + 人工截图"替代。已在 STATUS.md 风险栏登记
- **移动端 5 P1 + 4 P2 没修,只是审计出来** — 这是刻意的:修要单开窗口、按审计结论排期。已在 t3 审计报告里点名 P1-1/2/5 是一行 CSS,P1-3/4 要设计草图

---

## 9. 时间线回顾

| 时点 | 事件 | 谁主导 |
| --- | --- | --- |
| T0 | 定目标:补 UX-1 收尾 v2 三档 (内容 / 空态 / 移动端) | 我 |
| T0+1h | 派 plan:4 task (t1 / t2a / t2b / t3),并发压到 2-3 | 我 + Mavis 协作 |
| T0+1h~+2h | worker 跑批,中途不打扰 | worker + Mavis 自动汇报 |
| T0+2h | 收尾时 gate 全 FAIL,根因 CWD=/ 误判 | Mavis 发现,我拍板 override_accept + 写 memory |
| T0+2.5h | 准备 commit,发现 t2a/t2b hunks 交错 | Mavis 盘点,我拍板 4→3 commit |
| T0+3h | 拉本地 server,给 4 条直达 URL | Mavis 执行,我要求"可点击验收" |
| T0+3.5h | 文档基线同步 (STATUS/PLAN/AGENTS + 6 份 docs) | 我定范围,Mavis 执行 |
| T0+4h | 收口:窗口总结 + 本指挥过程记录 | Mavis 起草,我审 |

---

## 10. 关联文件

- 技术总结: `docs/ary-ux-finish-v2-summary.md` (本次窗口的"是什么")
- 本指挥记录: `docs/ary-ux-finish-v2-orchestration-log.md` (本次窗口的"怎么指挥的",评分材料)
- 移动端审计: `docs/ary-mobile-ux-review.md` (t3 产物)
- Race 详情截图: `design-prototype/ary-v0.4-race-detail.png`
- Work Judge 截图: `design-prototype/ary-v0.4-work-judge.png`
- Mavis 沉淀: `memory/mavis-team-plan-orchestration.md` (gate CWD=/ gotcha)
- 上游: `docs/ux-hifi.taskbook.md`、`docs/ary-dev-4-to-ops-delivery.md`
- 下游: `PLAN.md` 近期任务表 UX-1 收尾 v2 行
