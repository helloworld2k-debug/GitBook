# 生产 Canary 支付入口扩展 - 2026-05-29

## 范围

本次把支付入口的低风险健康信号加入生产 canary。

覆盖：

- Dodo live 模式产品 ID 配置。
- 匿名访问 `/en/contributions` 的支付入口保护。
- 不创建 checkout session，不登录，不产生订单。

## 处理

- `scripts/production-canary.mjs` 新增 `Dodo live product config`。
- 检查 `DODO_LIVE_PRODUCT_ONE_DAY`、`DODO_LIVE_PRODUCT_MONTHLY`、`DODO_LIVE_PRODUCT_QUARTERLY`、`DODO_LIVE_PRODUCT_YEARLY` 均已设置。
- 新增 `contributions anonymous entry`，确认匿名贡献页有登录入口，且不暴露 checkout 表单。

## 验证

已运行：

```bash
npm test -- tests/unit/production-canary.test.ts
npm run canary:production
```

结果：

- 单测通过。
- 生产 canary 通过。
- `Dodo live product config` 返回 `ok: true`，`missing: []`。
- `contributions anonymous entry` 返回 `ok: true`。

## 说明

该检查只读生产页面和 debug endpoint，不请求 `/api/checkout/dodo`，不会创建真实 checkout session。
