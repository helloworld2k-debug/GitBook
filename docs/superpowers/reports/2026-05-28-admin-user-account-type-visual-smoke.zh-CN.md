# 后台用户账号类型视觉 Smoke Check - 2026-05-28

## 范围

在生产 `profiles.account_type` 迁移和数据 smoke 通过后，本次继续做后台用户管理视觉验收。

覆盖：

- 桌面端用户列表账号类型筛选。
- 桌面端用户详情账号类型展示。
- 移动端用户列表筛选和用户卡片。
- 导出入口可见性。
- QA 用户状态恢复。

## 使用账号

专用 QA 账号：

- operator：`codex-admin-smoke-operator-20260528@example.com`
- target：`codex-admin-smoke-target-20260528@example.com`

处理：

- operator 使用 `operator` 角色登录后台。
- target 临时设置为 `ai_test` 以验证筛选和 badge。
- 验证结束后 target 已恢复为 `standard`。
- operator 与 target 密码均已轮换。

## 截图

截图保存于本地临时目录：

- `tmp/admin-user-visual-smoke/desktop-users-ai-test.png`
- `tmp/admin-user-visual-smoke/desktop-user-detail.png`
- `tmp/admin-user-visual-smoke/mobile-users-ai-test.png`
- `tmp/admin-user-visual-smoke/mobile-users-ai-test-card.png`

## 视觉结果

桌面端用户列表：

- 页面加载到 `/en/admin/users?type=ai_test&query=codex-admin-smoke-target-20260528@example.com`。
- 用户管理标题、统计卡、创建账号区域、筛选栏和 `Export CSV` 入口可见。
- `User type` 选择为 `AI test`。
- 没有页面级横向溢出。

桌面端用户详情：

- 页面加载到 target 用户详情。
- Details 卡显示 email、user id、role、account type、created。
- `ACCOUNT TYPE` 显示为 `AI test`。
- 右侧密码状态卡显示 Email confirmed 和 Password set。

移动端用户列表：

- 顶部操作按钮在 390px 宽度下换行正常。
- 筛选区域可见，`User type` 为 `AI test`。
- target 用户卡片可见。
- 卡片中 `Type` 显示为 `AI test`。
- 没有页面级横向溢出。

## 发现

未发现阻断问题。

轻微观察：

- 桌面端列表页的创建账号区域会出现在用户列表上方，筛选结果需要向下滚动查看。这是已有信息架构，不影响账号类型功能。
- 响应式布局同时渲染移动卡片和桌面表格，自动化定位同一邮箱时需要过滤 visible 元素；视觉上移动端只显示移动卡片。

## 验证命令

已运行：

```bash
npm run check:isolation
npm run check:production-schema
```

补充生产状态：

- target 当前 `account_type = standard`。
- operator 当前 `admin_role = operator`。

## 结论

后台用户账号类型在生产环境的桌面与移动主视觉路径可用。账号类型筛选、详情展示、移动卡片展示和导出入口均通过视觉 smoke。
