# 后台整体排版布局 UX 审计报告

日期：2026-05-26
分支 / worktree：`feature/admin-layout-ux-audit`，路径 `.worktrees/admin-layout-ux-audit`
范围：后台 shell、总览页、用户管理、兑换 / 许可证、支持反馈 / 支持设置、捐赠、发布管理，以及高密度运营表格。

## 执行摘要

当前后台系统已经有不错的运营型界面基础：固定后台框架、大屏持久侧边栏、若干高密度表格的移动端卡片视图、清晰的 focus ring、接近 44px 的控件高度，以及能保护主要布局回归的测试。下一步最值得做的不是视觉重绘，而是一次布局系统整理，让后台在高频、重复、数据密集的管理任务里更容易浏览、比较和操作。

最高影响的问题有 5 个：

1. 侧边栏是 13 个目的地的平铺列表，缺少信息分组，增加了查找成本。
2. 高密度表格被限制在 `max-w-7xl` 页面容器内，但表格自身最小宽度达到 1540-1580px，导致桌面端也经常需要横向滚动。
3. 高密度表格在 `md` 断点就切换为桌面表格，768px 平板宽度会看到超宽横向表格，而不是更好用的卡片布局。
4. 筛选、批量操作、导出、表格内容、分页在各页面独立拼装，操作层级和间距不够统一。
5. 表单和状态组件基础不错，但缺少可复用的后台 workbench 原语，例如筛选栏、操作栏、表格密度、空状态和错误状态。

静态审计和现有测试没有发现 P0 级发布阻断问题。建议把本次工作定位为 P1 级 UX 质量提升，因为它影响后台管理员的高频重复工作流和数据密集页面效率。

## 问题清单

### P0：未发现立即阻断发布的布局问题

影响：当前代码已经为后台 shell、可聚焦表格滚动区域、部分移动端卡片 fallback 建立了基础保障。现有测试也覆盖了固定 shell 行为和后台表单行的顶部对齐。

证据：
- `AdminShell` 使用 `h-dvh overflow-hidden`，由内容区域负责滚动，并保持侧边栏和顶部栏 sticky：`src/components/admin/admin-shell.tsx:130-205`。
- `AdminTableShell` 为宽表格提供 `tabIndex={0}` 的键盘可聚焦滚动区域：`src/components/admin/admin-shell.tsx:479-507`。
- 固定后台 chrome 和滚动归属已有测试：`tests/unit/admin-shell.test.tsx:86-104`。
- 紧凑表单行顶部对齐已有测试：`tests/unit/admin-layout-alignment.test.ts:8-37`。

建议：无需暂停其他后台工作来做紧急修复。应进入下面的 P1 布局系统优化。

验收标准：
- 现有后台 shell / layout 测试继续通过。
- 在 375、768、1024、1440px 下，外层页面不出现横向滚动。

### P1：导航信息架构过于扁平

影响：侧边栏把 13 个后台目的地作为一个无分组列表展示。管理员每次都需要扫描整列导航，相关概念也没有按任务模型组织。此外 `support-feedback` 和 `support-settings` 使用同一个图标，降低识别度。

证据：
- 侧边栏项目是一个平铺数组：`src/components/admin/admin-shell.tsx:61-76`。
- Feedback 和 Support settings 都使用 `MessageSquareText`：`src/components/admin/admin-shell.tsx:70-71`。
- 侧边栏宽度固定为 `w-72`，有空间承载分组标签而不改变 shell 尺寸：`src/components/admin/admin-shell.tsx:133-151`。

建议：
- 将侧边栏路由分为 4 组：
  - Overview：后台总览。
  - Operations：捐赠、发布、兑换 / 许可证、用户。
  - Content：新闻、通知、政策页面。
  - Trust & Support：支持反馈、支持设置、注册安全、审计日志。
- 桌面端默认展开所有组；移动端菜单保持同样分组顺序。
- 为反馈和支持设置使用不同图标，例如反馈保留 `MessageSquareText`，支持设置使用 `LifeBuoy` 或 `Settings`。
- 保留当前高对比 active 状态，同时增加低调分组标签，让当前位置处于可理解的信息架构中。

验收标准：
- 桌面侧边栏显示分组标签，移动端菜单保持同样分组顺序。
- 分组标签本身不应可聚焦，除非它承担展开 / 收起交互。
- 当前路由 active 状态仍然明显，文字对比度至少达到 4.5:1。

### P1：高密度表格被页面容器宽度强制压缩

影响：页面 section 普遍使用 `max-w-7xl`，但主要表格需要 1540-1580px 最小宽度。结果是关键后台页面在常见桌面宽度下也需要在卡片内部横向滚动，降低跨列比较效率，也让 sticky 右侧操作列更像补丁而不是有意设计的数据网格。

证据：
- 后台 shell 最大宽度允许到 `max-w-[1800px]`，但页面内容反复被限制在 `mx-auto max-w-7xl`：`src/components/admin/admin-shell.tsx:130-205`、`src/app/[locale]/admin/users/page.tsx:260-262`、`src/app/[locale]/admin/licenses/page.tsx:375-378`、`src/app/[locale]/admin/support-feedback/page.tsx:143-145`。
- 用户表格最小宽度为 `1580px`：`src/app/[locale]/admin/users/page.tsx:512-523`。
- 支持反馈表格最小宽度为 `1540px`：`src/app/[locale]/admin/support-feedback/page.tsx:219-228`。
- 许可证代码表格最小宽度为 `1560px`：`src/app/[locale]/admin/licenses/page.tsx:816-839`。

建议：
- 引入两种后台内容宽度：
  - `AdminStandardPage`：`max-w-7xl`，用于总览、表单、设置和详情页。
  - `AdminDataWorkbench`：大屏使用 `max-w-none` 或 `max-w-[calc(100vw-18rem)]`，用于表格主导页面。
- 用户、许可证、支持反馈、证书、审计日志、发布历史等表格主导页面使用 `AdminDataWorkbench`。
- 表单和 summary card 仍可放在可读宽度的内部容器里，但表格卡片应使用 shell 可用宽度。
- 保留 sticky 右侧操作列，但当操作已放入菜单时，应减少其宽度。

验收标准：
- 1440px 下，用户 / 支持反馈 / 许可证 workbench 表格使用全部可用内容宽度，而不是被限制在约 1280px。
- 1024px 下，横向滚动只存在于表格区域，不出现在页面 body。
- sticky 操作列在横向滚动时不遮挡重要单元格内容。

### P1：平板宽度过早切换到桌面表格

影响：`AdminTableShell` 在 `md` 断点隐藏移动卡片，因此 768px 视口会收到 `min-w-[1040px]` 到 `min-w-[1580px]` 的桌面表格。这在技术上是响应式的，但对平板和小屏笔记本不够友好。

证据：
- `AdminTableShell` 将移动卡片设为 `md:hidden`，表格设为 `hidden md:block`：`src/components/admin/admin-shell.tsx:492-501`。
- 用户页在 `md` 起展示 1580px 桌面表格：`src/app/[locale]/admin/users/page.tsx:413-512`。
- 支持反馈页在 `md` 起展示 1540px 桌面表格：`src/app/[locale]/admin/support-feedback/page.tsx:184-219`。
- 捐赠和发布页虽有较好的移动卡片，但只要使用 `AdminTableShell`，仍继承同样的 `md` 切换点：`src/app/[locale]/admin/donations/page.tsx:219-251`、`src/app/[locale]/admin/releases/page.tsx:271-300`。

建议：
- 给 `AdminTableShell` 增加断点参数，例如 `cardsUntil="lg"`，默认值保留 `md` 以兼容简单表格。
- 对宽度超过 1200px 或带 sticky 操作列的表格使用 `cardsUntil="lg"`。
- 在 768-1023px 范围内优先使用移动 / 平板卡片，卡片内用紧凑键值行和一个更多操作菜单。
- 桌面数据网格从 `lg` 及以上开始展示。

验收标准：
- 768px 下，用户和支持反馈展示卡片布局，而不是 1500px 横向表格。
- 1024px 及以上可以展示数据表格。
- 键盘导航在卡片模式和表格模式中都能触达同样的行操作。

### P1：筛选、批量操作、导出和表格头部需要统一 workbench 模式

影响：每个页面都在本地组合筛选和操作区。用户需要重新学习导出在哪里、排序是否隐藏在详情里、主要操作在哪里。用户页最典型：账号创建、筛选、批量工具栏、导出、表格、分页依次堆叠，但缺少统一的 workbench 层级。

证据：
- 用户页把归档入口、summary 指标、账号创建、筛选、批量工具栏、导出和表格拆成多个连续区块：`src/app/[locale]/admin/users/page.tsx:272-401`。
- 用户筛选使用自定义 grid 和 `details`：`src/components/admin/admin-user-filters.tsx:32-108`。
- 许可证筛选使用相似但独立实现的 workbench grid：`src/app/[locale]/admin/licenses/page.tsx:544-641`。
- 发布历史页使用另一套 header 模式承载批量操作和筛选：`src/app/[locale]/admin/releases/page.tsx:211-269`。

建议：
- 建立共享的 `AdminWorkbenchHeader` 模式：
  - 左侧放标题和结果数量。
  - 右侧放当前上下文主操作。
  - 下方放筛选栏，主筛选常显，高级筛选进入 disclosure。
  - 只有选择条目后才显示批量操作，并放在一致的 sticky 或 inline action bar。
  - 导出属于二级操作组，不应成为孤立区块。
- 不要求每页完全相同，但操作的位置和层级应一致。

验收标准：
- 用户、许可证、发布、捐赠、支持反馈共享同样的筛选 / 操作顺序。
- 批量操作在各页面出现在可预测的位置。
- 导出 / 下载操作在视觉上弱于行操作或流程主操作。

### P2：总览页更像目录，而不是运营仪表盘

影响：总览页有有用的指标，但 12 个后台链接是等权重卡片。这作为 sitemap 可以，但作为日常运营入口不够强。管理员首先需要看到“需要处理什么”：未读反馈、失败发布、被拦截兑换、待处理支持、近期错误等。

证据：
- 总览指标覆盖用户、试用、反馈、捐赠：`src/app/[locale]/admin/page.tsx:43-64`。
- 后台链接是 12 个等权重卡片：`src/app/[locale]/admin/page.tsx:66-127`、`src/app/[locale]/admin/page.tsx:148-161`。

建议：
- 保留指标行，但在目录之前增加 “Attention” 区块：
  - 未读反馈。
  - 失败 / 上传中的发布。
  - 最近被拦截的兑换尝试。
  - 账号 disabled / deleted 事件或注册拦截。
- 将 12 个目录卡片按侧边栏分组改造成分组快捷入口。
- 稳定导航使用更小卡片；只有活跃运营信号使用更强视觉权重。

验收标准：
- 总览首屏至少展示一个运营信号，而不只是导航。
- 目录卡片被分组，且视觉优先级低于指标 / attention。
- 空 attention 状态说明当前无需处理事项。

### P2：状态颜色需要语义图例和非颜色辅助

影响：`AdminStatusBadge` 的色彩体系较一致，但没有共享图例，也没有为高风险状态提供图标 / 文本强化。在密集表格中，颜色容易成为快速识别的唯一线索，例如 active / inactive / deleted、failed / blocked、open / reviewing / closed。

证据：
- badge tone 只是颜色样式类：`src/components/admin/admin-shell.tsx:512-521`。
- 用户页相邻列里对 role、type、status 都使用 success / warning / danger：`src/app/[locale]/admin/users/page.tsx:567-580`。
- 许可证和诊断区域包含多个状态值和风险信号：`src/app/[locale]/admin/licenses/page.tsx:650-690`、`src/app/[locale]/admin/licenses/page.tsx:816-918`。

建议：
- 保留 badge 文本标签，但在高密度页面为 danger / warning / success 增加可选前置图标。
- 在一个地方定义语义状态组：health、lifecycle、permission、risk。
- 在许可证等同一表格含多个状态域的页面添加紧凑图例。

验收标准：
- 不依赖颜色也能理解状态含义。
- badge 文本对比度保持 WCAG AA。
- 同一表格内多个状态域不会用相同颜色表达冲突含义，除非有标签或图标辅助。

### P2：表单密度不错，但渐进披露需要系统化

影响：后台表单大多有可见 label 和触控友好高度，但高级筛选和创建表单是逐页实现的。一些页面一次展示很多字段，另一些页面把高级筛选放入 `details`。缺少共享规则时，表单密度取决于页面作者。

证据：
- 用户筛选常显 search / role / type / status，并用 `details` 放高级筛选：`src/components/admin/admin-user-filters.tsx:34-99`。
- 许可证代码筛选展示 5 个主筛选，再加高级筛选、排序、分页大小：`src/app/[locale]/admin/licenses/page.tsx:546-641`。
- 发布创建表单在历史表格之前内联展示较复杂的 delivery mode 组件：`src/app/[locale]/admin/releases/page.tsx:143-209`。
- 现有布局测试已经保护紧凑控件顶部对齐：`tests/unit/admin-layout-alignment.test.ts:8-37`。

建议：
- 定义后台表单密度规则：
  - 主筛选最多 4 个常显控件，加 Apply / Reset。
  - 高级筛选包括日期、排序、分页大小、deleted / current 范围。
  - 超过 5 个字段的创建流程应使用 fieldset 分区，或放入页面 header 下方的 disclosure panel。
- 保留可见 label 和 `min-h-11` 控件基线。

验收标准：
- 每个列表页在高级 disclosure 前最多展示 4 个主筛选。
- 长创建表单按任务分区，而不是只靠 grid 位置区分。
- 现有顶部对齐测试继续通过。

## 布局系统建议

### Shell

- 保留固定后台 chrome：`h-dvh`、sticky 侧边栏、sticky 顶栏、内容区滚动。
- 增加侧边栏分组标签和路由分组，不改变 `w-72`。
- 顶栏保留全局工具操作，但页面级主操作应移动到页面 / workbench header。

### 页面容器

- `AdminStandardPage`：居中 `max-w-7xl`，用于设置、详情、总览和表单主导页面。
- `AdminDataWorkbench`：使用 shell 可用全宽，用于表格主导页面。
- `AdminSplitPage`：可作为未来详情页模式，左侧主内容，右侧 metadata / action rail。

### Workbench Header

- 共享结构：标题 / 结果摘要、主操作、次操作、筛选栏、选择 / 批量操作栏。
- 导出属于次操作。
- 批量操作只在相关时出现，并将破坏性操作视觉隔离。

### 表格和卡片

- 超过 1200px 宽的表格应在 `lg` 前使用卡片。
- sticky 操作列只保留给桌面表格，并尽量窄。
- 每个高密度表格都应有移动 / 平板卡片等价视图，操作能力一致。
- 表格滚动区域必须保持可聚焦并带有 label。

### 表单

- 可见 label 是强制要求。
- 44px 最小控件高度保持为基线。
- 高级筛选使用统一 disclosure 模式。
- 长创建流程使用 fieldset 或可折叠分区。

### 色彩和字体

- 保持克制的 slate 运营型配色。
- 增加语义状态 token 名称，并为高风险状态提供可选图标。
- 数量、金额、日期相邻数据可使用 tabular numbers，减少视觉跳动。

## 实施路线图

### 第一阶段：系统原语

1. 为后台 shell 增加路由分组 metadata，并渲染侧边栏分组。
2. 增加 `AdminStandardPage` 和 `AdminDataWorkbench` 容器。
3. 扩展 `AdminTableShell`，支持卡片 / 表格切换断点参数。
4. 增加 `AdminWorkbenchHeader` 和共享筛选 / 操作布局原语。

### 第二阶段：高价值页面

1. 将用户页和支持反馈页迁移到 `AdminDataWorkbench`，并使用 card-until-`lg` 行为。
2. 将许可证页迁移到共享 workbench header 和全宽表格区。
3. 统一发布页和捐赠页的操作 / 筛选位置。
4. 将总览页目录改为分组快捷入口，并增加 attention 信号。

### 第三阶段：视觉打磨和可访问性

1. 增加语义状态 badge 变体和可选图标。
2. 增加或更新侧边栏分组、表格断点、workbench 操作顺序测试。
3. 使用已登录管理员会话，在 375、768、1024、1440px 进行浏览器检查。

## 证据附录

### 源码证据

- 后台 shell 结构和 nav list：`src/components/admin/admin-shell.tsx:61-205`。
- 后台表格 shell 响应式行为：`src/components/admin/admin-shell.tsx:479-507`。
- 总览指标和目录卡片：`src/app/[locale]/admin/page.tsx:43-161`。
- 用户页组成和表格：`src/app/[locale]/admin/users/page.tsx:260-648`。
- 用户筛选组件：`src/components/admin/admin-user-filters.tsx:32-108`。
- 许可证 workbench / 筛选 / 表格模式：`src/app/[locale]/admin/licenses/page.tsx:375-641`、`src/app/[locale]/admin/licenses/page.tsx:816-1110`。
- 支持反馈表格 / 卡片模式：`src/app/[locale]/admin/support-feedback/page.tsx:143-258`。
- 发布创建 / 历史 / 筛选 / 表格模式：`src/app/[locale]/admin/releases/page.tsx:132-424`。
- 现有 shell 和表格测试：`tests/unit/admin-shell.test.tsx:41-158`。
- 现有对齐测试：`tests/unit/admin-layout-alignment.test.ts:8-37`。

### 运行观察

- 在新 worktree 运行了后台相关单测：
  - `npm test -- tests/unit/admin-shell.test.tsx tests/unit/admin-layout-alignment.test.ts tests/unit/admin-pages.test.tsx tests/unit/admin-support-settings-page.test.tsx`
  - 结果：4 个测试文件通过，42 个测试通过。
- `npm install` 在新 worktree 完成，并报告 2 个 moderate npm audit vulnerabilities。本审计任务没有改依赖。
- `npm run dev` 被新 worktree `.env.local` 缺少 Supabase 变量阻断。
- `npx next dev -p 3017` 可启动用于布局探测，但由于本地 Supabase 配置为空，未登录 / 后台路由只能返回应用壳标题 `GitBook AI`。
- Playwright 截图未完成：Chromium 浏览器二进制缺失，`npx playwright install chromium` 在下载 165.5 MiB 浏览器包时长时间无进度，随后停止下载进程。因此没有产出认证后的后台截图。

### UI/UX Pro Max 使用说明

- 本审计使用 `ui-ux-pro-max` 作为评审准则，重点参考：
  - Accessibility：对比度、focus 状态、键盘导航、不要只用颜色表达含义。
  - Interaction：44px 目标尺寸、加载 / 反馈、可预测控件。
  - Layout：响应式断点、无外层横向滚动、间距系统、内容优先级。
  - Navigation：active 状态、持久导航、层级、深层路由清晰度。
  - Forms：可见 label、渐进披露、helper / error 靠近相关字段。
  - Data：表格替代视图、图例 / 标签、可访问的状态编码。
- 该 skill 的 CLI 未使用，因为当前安装的 `scripts` symlink 指向不可用位置。本审计直接应用已读取的 `SKILL.md` 规则，而不是使用 CLI 生成建议。

## 报告自检

- 每条 finding 都包含影响、证据、建议和验收标准。
- 建议避免泛泛的视觉重绘，聚焦可复用后台布局原语。
- 截图限制已明确记录，没有假设截图已完成。
- 本审计 worktree 未改动生产代码。
