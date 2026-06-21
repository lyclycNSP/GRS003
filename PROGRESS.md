# PROGRESS

## 2026-06-21 全站前端页面视觉审计

- 问题：多处从高保真静态布局迁入的页面在移动端仍带有旧的横向尺寸假设，`body` 后续样式覆盖了 `overflow-x: hidden`，导致 Race、Live Hall、Rider、Console 等页面在窄屏出现横向空白、卡片窄列和文字拥挤。
- 解决方式：用 Playwright CLI 批量截取 17 个页面的桌面/移动视口，并补充 Organizer/Rider/Judge/Admin 四个 Console 移动视口；恢复全局横向裁剪，补齐 Route Page 下 Race、Live、Rider、Right Dashboard、Profile Card、Leaderboard/Event Stream 的响应式栅格和卡片密度规则。
- 后续避免：新增页面或迁移旧原型时，至少跑一次 1365x768 与 390x844 截图；移动全页截图宽度若超过 430px，应先查全局横向溢出而不是只调局部卡片。
- git commit ID：未提交。

## 2026-06-21 Work Detail 页面按钮与排版修正

- 问题：`/works/adaptive-bay-route-agent` 顶部操作入口使用默认文本链接，缺少返回 Works 入口；旧定位残留导致按钮与作品卡片重叠，移动端证据卡与作品卡横向拥挤。
- 解决方式：为作品详情页补充 `返回 Works` 按钮，给详情页添加作用域样式，统一链接按钮、标题、卡片字号和长 URL 换行；清除旧 hero 定位残留，并补充窄屏单列布局。
- 后续避免：详情页这类从静态高保真迁移来的页面，新增内容后必须用桌面和移动 Playwright 截图复查旧绝对定位是否仍在影响文档流。
- git commit ID：未提交。

## 2026-06-20 根目录旧 app 清理

- 问题：根目录旧 `app/` 静态 MVP 与当前正式集成应用 `web/` 并存，容易让开发者误判当前入口。
- 解决方式：删除根目录旧 `app/`，并将 README、PLAN、STATUS 和相关 docs 的当前实现/测试入口改为 `web/`；历史交付文档保留旧 app 语义但标注为已删除的历史记录。
- 后续避免：新增或迁移工程入口时，同步更新 `docs/README.md`、根 README、PLAN、STATUS 和对应交付文档，避免保留会被误执行的旧路径。
- git commit ID：未提交。
