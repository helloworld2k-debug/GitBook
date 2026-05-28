# 项目配置隔离检查 - 2026-05-28

## 背景

本机新增了另一个同样使用 Vercel、GitHub、Supabase 的开发项目。为避免多个项目之间误用配置，本次给当前 GitBook AI 网站项目增加了只读隔离检查。

## 当前项目身份

- Git remote：`helloworld2k-debug/GitBook`
- Vercel project：`gitbook-website`
- Supabase project ref：`dzsnhbszojdaghvolcnq`
- Supabase local project id：`software-donation-site`

## 已处理

新增脚本：

- `scripts/check-project-isolation.mjs`

新增命令：

- `npm run check:isolation`

新增测试：

- `tests/unit/project-isolation.test.ts`

检查内容：

- 当前 Git remote 是否仍指向本项目。
- `.vercel/project.json` 是否仍绑定 `gitbook-website`。
- `supabase/.temp/project-ref` 是否仍绑定本项目 Supabase ref。
- `.env.local`、`.vercel/`、`supabase/.temp/` 是否被 git ignore。
- 当前项目 Supabase local project id 和本地端口是否可读。
- 同一工作区相邻项目是否复用当前 Supabase local 端口。

## 本次验证结果

已运行：

- `npm test -- tests/unit/project-isolation.test.ts`
- `npm run check:isolation`

结果：

- 单元测试通过。
- 当前项目 Git/Vercel/Supabase 绑定均匹配。
- 当前项目本地敏感状态文件均被 git ignore。
- 未发现相邻项目复用当前 Supabase local 端口。

## 日常使用建议

在执行以下命令前，先运行：

```bash
npm run check:isolation
```

尤其是：

- `vercel link`
- `vercel env pull`
- `vercel deploy`
- `supabase link`
- `supabase db push`
- `supabase migration list`
- `supabase start`

如果新项目也使用 Supabase local stack，建议新项目使用不同端口，例如：

- api: `54331`
- db: `54332`
- shadow db: `54330`
- studio: `54333`
- inbucket: `54334`
- pooler: `54339`

## 仍需人工确认

如果新项目不在当前工作区同一层目录，当前脚本不会自动扫描到它。新项目目录里也建议建立类似检查，至少确认：

- Git remote 是新项目自己的仓库。
- Vercel `.vercel/project.json` 是新项目自己的 project。
- Supabase `supabase/.temp/project-ref` 是新项目自己的 project ref。
- 新项目 `.env.local` 没有复制当前项目的 Supabase/Dodo/Turnstile 密钥。
