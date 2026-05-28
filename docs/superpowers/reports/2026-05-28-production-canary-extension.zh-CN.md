# 生产 Canary 扩展 - 2026-05-28

## 范围

本次继续推进生产巡检，把前面已上线的后台账号类型能力纳入 canary。

覆盖：

- `profiles.account_type` 生产 schema。
- 匿名访问 `/en/admin/users` 的后台保护。
- 单个页面网络异常时的 canary JSON 输出稳定性。

## 处理

- `scripts/production-canary.mjs` 新增 `schema profiles.account_type` 检查。
- schema 检查优先读取 `/api/debug/webhook-status` 的 `schemaStatus`。
- 当前生产尚未部署 `schemaStatus` 字段时，canary 会回退使用本地 `.env.local` 中的 Supabase service role 直连检查。
- `/api/debug/webhook-status` 新增脱敏后的 `schemaStatus.profiles_account_type`。
- `/en/admin/users` 巡检改为验证匿名用户只能看到登录保护页面，且不会暴露后台用户管理内容。
- 页面检查增加 `try/catch`，单个 fetch 超时会生成 failed check，不再让整份 canary 没有 JSON 结果。

## 验证

已运行：

```bash
npm test -- tests/unit/production-canary.test.ts tests/unit/debug-webhook-status.test.ts tests/unit/production-schema-check.test.ts
npm run canary:production
```

结果：

- 单测：3 个文件、7 个测试通过。
- 生产 canary：通过。
- `schema profiles.account_type` 当前来源为 `supabase direct`，状态 `pass`。
- `admin users anonymous protection` 通过，生产返回 `200` 登录保护页，未暴露后台内容。

## 后续

这次代码部署到生产后，`schema profiles.account_type` 会优先使用 `/api/debug/webhook-status` 的 `schemaStatus`；本地 Supabase 直连兜底仍保留，便于部署前检查。
