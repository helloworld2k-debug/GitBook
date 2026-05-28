# 后台用户账号类型 Smoke Check - 2026-05-28

## 范围

在生产 Supabase 执行 `0066_admin_user_account_type.sql` 后，继续验证后台用户管理中与账号类型相关的关键路径。

覆盖：

- 用户列表账号类型筛选。
- 用户详情账号类型字段。
- 用户导出账号类型列。
- 账号类型更新动作。
- 账号类型更新审计日志。

## 验证账号

本次使用专用 QA 账号：

- operator：`codex-admin-smoke-operator-20260528@example.com`
- target：`codex-admin-smoke-target-20260528@example.com`

处理：

- operator 设置为 `operator` 角色。
- target 初始设置为 `standard`。
- target 在 smoke 中切换到 `ai_test`，验证后恢复为 `standard`。
- 两个 QA 账号密码均已轮换。

## 生产只读/低写入验证

已验证：

- `get_admin_users_paginated` 用 `input_type_filter: "standard"` 能找到 target，且 `account_type = "standard"`。
- target 切换为 `ai_test` 后，`get_admin_users_paginated` 用 `input_type_filter: "ai_test"` 能找到 target，且 `account_type = "ai_test"`。
- 用户详情查询 `profiles(id,email,account_type)` 可读。
- 账号类型更新动作写入 `admin_audit_logs`，action 为 `update_user_account_type`。
- target 已恢复为 `standard`。
- 导出路径核心数据可用：
  - CSV header 包含 `Type`。
  - `ai_test` 筛选能返回 target。
  - 导出标签映射为 `AI Test`。

未执行：

- 未删除用户。
- 未修改真实用户。
- 未创建支付或证书。

## 自动化验证

已运行：

```bash
npm run check:isolation
npm run check:production-schema
npm test -- tests/unit/admin-users-paginated-migration.test.ts tests/unit/admin-pages.test.tsx tests/unit/admin-actions.test.ts
```

结果：

- 项目隔离检查通过。
- 生产 schema 检查通过。
- 后台用户管理相关单元测试通过：3 个测试文件，110 个测试。

## 结论

生产 `profiles.account_type` 迁移后的后台用户管理主路径可用。账号类型相关列表、详情、导出、更新和审计日志均已通过 smoke check。

## 建议下一步

可以继续推进后台用户管理的浏览器视觉验收，重点看：

- 桌面端用户列表横向滚动和 sticky actions 是否稳定。
- 移动端用户卡片中的账号类型 badge 是否清晰。
- 用户详情页面中角色/状态/账号类型三个表单是否间距合理。
