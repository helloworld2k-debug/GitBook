# 支付入口低风险验收 - 2026-05-28

## 范围

本次按后台 UX 收尾后的推荐顺序，检查生产站 Dodo 支付入口是否具备继续上线观察的基本条件。

覆盖：

- 未登录贡献页展示
- Dodo 生产环境配置
- Dodo 产品 ID 数据库配置
- 未登录直接提交结账表单的保护
- 普通测试账号登录后的结账跳转
- 本次操作是否产生已支付记录或证书

本次没有填写付款信息，没有提交付款，没有创建已支付订单。

## 结果摘要

- 生产贡献页 `/en/contributions` 正常展示 4 个支持方案。
- 未登录状态只显示登录入口，不显示真实结账按钮。
- 未登录直接 POST `/api/checkout/dodo` 返回 `303` 到 `/en/login?next=%2Fen%2Fcontributions`。
- 生产 Dodo 配置处于 `live` 模式，API key、webhook key 和 4 个 live 产品变量均已设置。
- `payment_product_settings` 中 live 环境 4 个 tier 均启用，且均有产品 ID。
- 普通测试账号登录后，4 个方案均显示结账按钮。
- 点击 1-Day 支持后成功跳转到 `checkout.dodopayments.com/session`。
- QA 测试账号密码已轮换。
- QA 测试账号没有产生 donation 记录或 certificate 记录。

## 只读配置核对

生产调试端点显示：

- `NEXT_PUBLIC_SITE_URL`: `https://gitbookai.ccwu.cc`
- `DODO_PAYMENTS_ENV`: `live`
- `DODO_PAYMENTS_API_KEY`: 已设置
- `DODO_PAYMENTS_WEBHOOK_KEY`: 已设置
- `DODO_LIVE_PRODUCT_ONE_DAY`: 已设置
- `DODO_LIVE_PRODUCT_MONTHLY`: 已设置
- `DODO_LIVE_PRODUCT_QUARTERLY`: 已设置
- `DODO_LIVE_PRODUCT_YEARLY`: 已设置

数据库 `payment_product_settings` 只读核对：

| tier | environment | enabled | product ID |
| --- | --- | --- | --- |
| one_day | live | true | present |
| monthly | live | true | present |
| quarterly | live | true | present |
| yearly | live | true | present |

## 页面与跳转核对

未登录 `/en/contributions`：

- H1: `Support GitBook AI Development`
- 方案数：4
- 方案标题：
  - `1-Day Dev Support`
  - `Monthly Dev Support`
  - `Quarterly Dev Support`
  - `Yearly Dev Support`
- 每个方案都有价格显示。
- 每个方案都有 Dodo Payments 说明。
- 每个方案登录链接均指向 `/en/login?next=%2Fen%2Fcontributions`。
- 未登录状态没有结账按钮。

未登录直接提交：

- 请求：`POST https://gitbookai.ccwu.cc/api/checkout/dodo`
- 表单：`tier=one_day&locale=en`
- Origin：`https://gitbookai.ccwu.cc`
- 结果：`303`
- Location：`https://gitbookai.ccwu.cc/en/login?next=%2Fen%2Fcontributions`

登录后结账跳转：

- QA 账号类型：普通用户
- 登录后到达 `/en/contributions`
- 结账按钮数量：4
- 点击 1-Day 支持按钮后跳转到 `checkout.dodopayments.com/session`。
- 未填写付款信息
- 未提交付款
- QA 账号密码已轮换

支付后置数据核对：

- QA 用户 donation 行数：0
- QA 用户 certificate 行数：0

## 发现：生产 schema drift

验收过程中发现生产 Supabase 的 `profiles.account_type` 列不存在：

- 基础 `profiles(id,email)` 读取正常。
- `profiles(account_type)` 读取失败。
- 错误码：`42703`
- 错误信息：`column profiles.account_type does not exist`

本地代码和迁移中已有 `supabase/migrations/0066_admin_user_account_type.sql`，该迁移会新增 `account_type`，并更新后台用户列表 RPC。

影响判断：

- 不影响本次支付入口结账跳转。
- 可能影响后台用户管理里读取、创建、导出、批量更新账号类型的功能。
- 代码里部分页面已有缺列 fallback，但管理动作仍可能因为列不存在失败。

阻塞点：

- 当前 Supabase CLI 登录身份没有平台数据库角色权限。
- `supabase migration list` 返回 403，并提示需要设置 `SUPABASE_DB_PASSWORD`。
- 本地 `.env.local` 没有数据库密码或直接数据库连接串。

需要补充：

- 生产 Supabase 数据库密码 `SUPABASE_DB_PASSWORD`，或
- 可执行 `supabase db push` 的项目 owner/管理员访问权限，或
- 在 Supabase SQL Editor 手动执行 `supabase/migrations/0066_admin_user_account_type.sql`。

## 验证记录

已运行：

- Playwright 只读检查生产 `/en/contributions`
- `curl` 检查生产 Dodo webhook/status 调试端点
- Supabase service role 只读查询 `payment_product_settings`
- `curl` 检查未登录 POST 结账保护
- Playwright 登录普通 QA 账号并跳转 Dodo checkout
- Supabase service role 只读确认 QA 用户没有 donation/certificate 记录
- Supabase service role 只读确认 `profiles.account_type` 缺列
- `supabase migration list`

## 建议下一步

1. 先补齐生产 Supabase 迁移 `0066_admin_user_account_type.sql`。
2. 迁移后重新跑后台用户管理相关 smoke check。
3. 再补一条支付入口生产 canary：只检查未登录贡献页、Dodo 配置、产品 ID 是否齐全，不自动创建 checkout session。
