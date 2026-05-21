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

## 线上环境

- 网站: https://gitbookai.ccwu.cc
- Supabase 项目 ref: dzsnhbszojdaghvolcnq
- 支付环境: test (Dodo Payments)

## 已知限制

- `supabase db push` 需要先注释掉 config.toml 中的 email template sections（CLI path bug）
- 没有 middleware.ts 做 session refresh
- config.toml 中 email template 的 content_path 要用 `./templates/` 而不是 `./supabase/templates/`
