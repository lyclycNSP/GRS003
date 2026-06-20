# ARY Web Next Step Checklist

版本：v0.1
文档类型：Engineering Follow-up Checklist
状态：新增推进清单
适用阶段：`WEB-1` 正式集成应用打磨与验证

---

# 1. 当前阶段判断

当前仓库已经完成文档基线、高保真原型、本地 MVP 领域闭环，并新增 `web/` 作为正式工程化入口。

本阶段的重点不再是重新定义 PRD，而是把 `web/` 从“可运行初版”推进到“可验收、可演示、可继续部署”的状态。

---

# 2. 本轮优先级

| 优先级 | 事项 | 完成口径 |
|---|---|---|
| P0 | 跑通 `web/` 本地环境 | 能完成依赖安装、Prisma 初始化、seed、测试、构建和本地启动 |
| P0 | 验证 GitHub OAuth / fallback 登录 | 未配置 OAuth 时 fallback 可走通；配置 OAuth 后真实登录可回调 |
| P0 | Console 交互体验修正 | Organizer、Rider、Judge、Admin 视图无明显重叠、截断和不可点击区域 |
| P0 | P0 回归证据 | `web` 领域测试和构建通过，并记录命令结果 |
| P1 | CAConnector 边界确认 | 明确本轮是否只做 mock CA，还是需要接真实 CA 工具 |
| P1 | 浏览器 E2E 烟测 | 覆盖 Home、Race、Console、Screen、Ops 的基础打开和主按钮路径 |
| P1 | Checkpoint 汇报材料 | 能说明已完成、未完成、风险和每人贡献 |

---

# 3. 建议五人继续分工

| 成员 | 下一轮负责 | 主要文件 / 页面 | 交付 |
|---|---|---|---|
| A | 环境与验证 | `web/README.md`、`web/package.json` | 本地运行步骤、测试结果、构建结果 |
| B | Console 体验 | `web/app/console/page.tsx`、`web/app/globals.css` | Console 页面无重叠、按钮路径清楚 |
| C | Public 页面走查 | `web/app/page.tsx`、`web/app/races/`、`web/app/works/` | 公开端路径走查问题清单 |
| D | OAuth / CA 边界 | `web/lib/auth.ts`、`web/app/api/auth/`、`web/lib/domain.ts` | 登录配置说明、CA mock/真实接入判断 |
| E | 汇报与验收 | `docs/`、`STATUS.md`、`PLAN.md` | checkpoint 汇报稿和风险清单 |

---

# 4. 推荐验证命令

在 `web/` 目录执行：

```bash
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:push
npm.cmd run seed
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

如果使用 PowerShell 时 `npm` 被执行策略拦截，优先使用 `npm.cmd`。

---

# 5. 当前应避免的事

* 不要重写 `docs/ary-mvp.prd.md` 的核心口径。
* 不要删除 `app/`，它仍是 DEV-4 到 OPS-1 的本地 MVP 证据。
* 不要删除 `design-prototype/`，它仍是 UX-1 和页面视觉来源。
* 不要把 `.env`、GitHub Client Secret 或其他密钥提交到公开仓库。
* 不要把 CA 接入失败改成参赛硬门禁；当前口径仍是评审前风险提示。

---

# 6. Checkpoint 建议结论

当前可以对外汇报为：

> ARY 已完成 PRD / UX / 领域模型 / 本地 MVP 闭环，并建立 Next.js + Prisma 的正式 Web 工程入口。当前重点是完成 `web/` 的本地验证、Console 交互打磨、OAuth 配置确认、CAConnector 边界判断和浏览器回归证据。

