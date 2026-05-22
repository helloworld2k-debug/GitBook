# CLAUDE.md

## 项目概述

Gitbook AI — AI 书籍软件下载平台。用户免费下载软件阅读 AI 书籍，自愿提供开发支持（捐款），平台颁发证书作为凭证和对奉献的肯定。提供开发支持的用户还可获得软件云同步功能（细节待定）。设计师主导开发，用中文沟通。

## 技术栈

- Next.js 16 (App Router, React Server Components)
- Supabase Auth + PostgreSQL
- Dodo Payments (支付)
- next-intl (国际化: en, zh-Hant, ja, ko)
- Tailwind CSS v4
- TypeScript 5
- Vercel 部署

## 工作规范

### 语言
- 所有沟通使用中文
- 代码注释用英文，保持简洁
- commit message 用英文

### 开发流程
- **先计划后动手**: 复杂功能（涉及 3 个以上文件）先用 plan mode 列出方案，等我确认后再实施
- **不要自动推送**: 修改完成后告诉我，由我决定何时提交和推送
- **推送前检查**: 确保 `npx tsc --noEmit` 和 `npx vitest run` 通过
- **数据库迁移**: 先写 SQL 文件到 `supabase/migrations/`，我确认后再 `supabase db push`
  - **迁移命名规范**: 使用 `XXXX_description.sql` 格式（4位数字+下划线+描述）
  - **禁止使用 `local_*.sql`**: 本地迁移不会被自动推送，所有迁移都要用数字前缀
  - **RPC 函数参数变更**: 修改 RPC 函数参数后必须立即推送迁移
    - 代码中调用 RPC 的参数名必须与数据库定义完全匹配
    - 运行 `npx tsx scripts/verify-rpc-functions.ts` 验证参数匹配
  - **推送前验证**: `supabase db push` 前运行验证脚本确保参数匹配
- **不要删除或覆盖 .env 文件**

### 代码风格
- 使用 Tailwind CSS，不写自定义 CSS
- 组件放在 `src/components/`
- Server Actions 放在对应 page 目录的 `actions.ts`
- API routes 放在 `src/app/api/`
- 类型定义在 `src/lib/database.types.ts`（Supabase 生成）

### 国际化
- 所有用户可见文本必须添加到 4 个语言文件: `messages/en.json`, `messages/zh-Hant.json`, `messages/ja.json`, `messages/ko.json`
- 新增文本放在对应 section，key 用 camelCase

### 安全
- 密码相关操作需要检查 `email_verified`
- API routes 必须验证 request origin (CSRF)
- 用户输入用 Zod 验证

### Supabase Auth 配置
- **重要**: `supabase/config.toml` 中 `[auth.email]` 的 `enable_confirmations` 必须为 `false`
  - 用户注册后可直接登录，个人中心会提示验证邮箱
  - 如改为 `true` 会导致用户必须验证邮箱后才能登录
- 检查配置: `npm run check-config`
- 推送配置到线上: `supabase config push --yes`
- 如通过 Dashboard 修改过设置，需及时同步到本地 config.toml

### 测试
- 单元测试: Vitest (`npx vitest run`)
- E2E 测试: Playwright (`npx playwright test`)

## 开发环境设置

### 首次设置

新开发者首次运行项目前需要配置环境变量：

```bash
# 1. 运行 setup 脚本（自动检查并创建 .env.local）
npm run setup

# 2. 或者手动创建
cp .env.example .env.local

# 3. 编辑 .env.local 填入 Supabase 凭据
# - NEXT_PUBLIC_SUPABASE_URL: 你的 Supabase 项目 URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY: 你的 Supabase anon key
# - SUPABASE_SERVICE_ROLE_KEY: 你的 Supabase service role key
```

### 环境变量检查

项目已配置自动检查：
- 运行 `npm run dev` 前，会自动检查 `.env.local` 是否存在且配置正确
- 如果缺失或配置不完整，会自动从 `.env.example` 创建模板并提示配置

### 关键环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase 项目 URL | ✓ |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase 匿名密钥 | ✓ |
| SUPABASE_SERVICE_ROLE_KEY | Supabase 服务端密钥 | ✓ |

### 常见问题

**Q: 登录/注册报 500 错误？**
A: 检查 `.env.local` 是否存在且配置了正确的 Supabase 凭据。运行 `npm run check-env` 验证。

**Q: 如何获取 Supabase 凭据？**
A: 登录 [Supabase Dashboard](https://supabase.com/dashboard)，进入项目 → Settings → API。

## 线上环境

- 网站: https://gitbookai.ccwu.cc
- Supabase 项目 ref: dzsnhbszojdaghvolcnq
- 支付环境: test (Dodo Payments)

## 已知限制

- `supabase db push` 需要先注释掉 config.toml 中的 email template sections（CLI path bug）
- Next.js 16 使用 `src/proxy.ts` 执行 next-intl 路由和 Supabase session refresh，不使用旧版 `middleware.ts`
- config.toml 中 email template 的 content_path 要用 `./templates/` 而不是 `./supabase/templates/`

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas or brainstorming -> invoke office-hours.
- Bugs, failed checks, regressions, or unexpected behavior -> invoke investigate or systematic-debugging.
- Website QA, browser testing, screenshots, responsive checks, or flow verification -> invoke gstack or qa.
- Visual polish, layout consistency, and frontend UX review -> invoke design-review.
- Deployment, merge, production verification, or canary monitoring -> invoke land-and-deploy or canary.
- Pre-landing code review -> invoke review.
- Documentation updates after shipping -> invoke document-release.
