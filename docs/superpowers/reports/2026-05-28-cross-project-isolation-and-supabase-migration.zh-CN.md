# 多项目隔离与 Supabase 迁移推进记录 - 2026-05-28

## 本次范围

按推荐顺序继续推进：

1. 检查本机新项目是否与 GitBook AI 网站项目串用 GitHub、Vercel、Supabase、`.env.local`。
2. 给新项目增加项目隔离检查命令。
3. 回到 GitBook AI 网站项目复查生产 Supabase `profiles.account_type` 迁移状态。

## 新项目隔离结果

识别到新项目目录：

- `/Users/happyamd/Documents/HappyFiles/Hwork2026/20260525IOT`

新项目身份：

- Git remote：`happyamddd/dreamlet-box`
- Vercel project：`dreamlet-box`
- Supabase project ref：`ryksmwemikxsujamqhjy`
- `.env.local` 中 Supabase URL 指向同一个 `ryksmwemikxsujamqhjy`

与当前 GitBook AI 网站项目不同：

- GitBook AI Git remote：`helloworld2k-debug/GitBook`
- GitBook AI Vercel project：`gitbook-website`
- GitBook AI Supabase project ref：`dzsnhbszojdaghvolcnq`

结论：

- 新项目的 GitHub、Vercel、Supabase、env 绑定与当前项目相互独立。
- 新项目没有 `supabase/config.toml`，因此目前不会启动 Supabase local stack，也没有本地 Supabase 端口冲突。

## 新项目已加保护

在新项目中新增：

- `scripts/check-project-isolation.mjs`
- `npm run check:isolation`

新项目验证结果：

- `PASS git-origin`
- `PASS vercel-project`
- `PASS supabase-project-ref`
- `PASS env-local-ignored`
- `PASS vercel-local-state-ignored`
- `PASS supabase-local-state-ignored`
- `SKIP supabase-sibling-port-conflicts`，原因是新项目没有 `supabase/config.toml`

已提交并推送到新项目仓库：

- `f898145 chore: add project isolation check`

## 当前项目复查结果

当前 GitBook AI 网站项目隔离检查通过：

- `PASS git-origin`
- `PASS vercel-project`
- `PASS supabase-project-ref`
- `PASS env-local-ignored`
- `PASS vercel-local-state-ignored`
- `PASS supabase-local-state-ignored`
- `PASS supabase-local-config`
- `PASS supabase-sibling-port-conflicts`

生产 Supabase schema drift 仍存在：

- `profiles(id,email)` 基础读取正常。
- `profiles(account_type)` 读取失败。
- 错误码：`42703`
- 错误信息：`column profiles.account_type does not exist`

## 迁移阻塞

本地仍没有可执行远端数据库迁移所需的数据库密码：

- `.env.local` 没有 `SUPABASE_DB_PASSWORD`、`DATABASE_URL`、`POSTGRES_URL` 等数据库连接变量。
- `supabase/.temp/pooler-url` 存在，但不包含密码。
- 之前运行 `supabase migration list` 返回 403，并提示需要 `SUPABASE_DB_PASSWORD`。

因此当前无法由 CLI 安全执行：

```bash
supabase db push
```

## 需要执行的迁移

生产缺失的迁移文件是：

```text
supabase/migrations/0066_admin_user_account_type.sql
```

执行方式二选一：

1. 提供生产 Supabase 数据库密码，设置 `SUPABASE_DB_PASSWORD` 后由 CLI 执行。
2. 在 Supabase Dashboard 的 SQL Editor 中手动执行 `0066_admin_user_account_type.sql` 全文。

## 迁移后验收命令

迁移完成后运行：

```bash
npm run check:isolation
npm test -- tests/unit/admin-users-paginated-migration.test.ts tests/unit/admin-pages.test.tsx tests/unit/admin-actions.test.ts
```

再用 service role 只读确认：

```text
profiles.account_type select 应返回成功，不再是 42703
```

## 建议下一步

先完成 `0066_admin_user_account_type.sql` 的生产迁移，再继续做后台用户管理 smoke check。这个问题不影响刚完成的 Dodo 支付入口跳转，但会影响后台用户管理的账号类型相关能力。
