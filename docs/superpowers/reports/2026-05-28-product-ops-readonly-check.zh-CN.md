# 产品运营路径只读巡检 - 2026-05-28

## 范围

本次巡检继续后台 UX 收尾后的推荐顺序，覆盖低风险公开路径和运维探针：

- 公开首页与多语言首页
- 贡献/支付入口页面
- 支持反馈入口页面
- 登录入口页面
- 新闻页面
- 公开下载链接
- 大陆访问审计
- 生产 canary 脚本准确性

本次未创建真实订单，未提交支持反馈，未修改生产业务数据。

## 结果摘要

- 生产 canary：通过。
- 公开产品路径浏览器巡检：发现 `/en/versions` 当前按产品行为隐藏为 404。
- 大陆访问审计：主站页面和 DNS 通过；下载项在 check-host 上返回 413，但补充验证显示下载 URL 本身支持 `HEAD` 和 `Range` 请求。
- 修复了 production canary 的假阳性风险：以前它只检查 HTTP `200` 和 `<title>GitBook AI</title>`，会把 Next streamed 404 fallback 误判为通过。

## 发现 1：`/en/versions` 是隐藏页面

当前代码里 `src/app/[locale]/versions/page.tsx` 明确调用 `notFound()`。

因此 `/en/versions` 返回的 HTTP 状态可能仍是 `200`，但页面正文是 404 fallback。这是 Next streamed response 下可能出现的表现。

处理：

- 从 `scripts/production-canary.mjs` 的必检公开路径移除 `/en/versions`。
- 更新 `tests/e2e/versions-language.spec.ts`，让 E2E 断言该页面是隐藏状态。

## 发现 2：生产 canary 曾有 404 假阳性

旧 canary 判断页面健康的条件是：

- HTTP response ok
- `<title>` 等于 `GitBook AI`

这不足以识别 Next 404 fallback，因为隐藏页面仍可能输出相同 title。

处理：

- 新增 `isUnexpectedPageBody()`。
- 检测正文中的：
  - `NEXT_HTTP_ERROR_FALLBACK;404`
  - `Application error`
  - `Internal Server Error`
  - `This page couldn't load`
  - 404 fallback 文案

验证：

- `npm test -- tests/unit/production-canary.test.ts` 通过。
- `npm run canary:production` 通过。

## 发现 3：大陆下载审计的 413 更像检测工具限制

`npm run audit:china-access` 中，主站页面通过：

- DNS AliDNS / DNSPod / 114DNS / BaiduDNS 均解析到 `216.198.79.1`。
- `/en`、`/zh-Hant`、`/en/login`、`/en/contributions`、`/en/support` 在大陆检测节点返回 `200`。

下载项在 check-host HTTP 检测中返回：

- `413 Maximum message size exceeded`

补充验证：

- 3 个下载 URL 的 `HEAD` 请求均返回 `200`。
- 3 个下载 URL 的 `Range: bytes=0-1023` 请求均返回 `206`，可下载 1KB zip 内容。

判断：

- 这更像 check-host 尝试抓取完整 ZIP 时触发检测平台消息大小限制。
- 不能直接判定为用户下载失败。

建议：

- 后续优化 `scripts/china-access-audit.mjs`，对大文件下载使用 `HEAD` 或 range probe，而不是 check-host full HTTP body 检测。

## 验证记录

已运行：

- `npm test -- tests/unit/production-canary.test.ts`
- `npm test -- tests/unit/release-download-pages.test.tsx tests/unit/production-canary.test.ts`
- `npm run canary:production`
- 本地 `127.0.0.1:3002` 直接浏览器验证：
  - `/en/versions` 显示 404 fallback。
  - 首页语言切换到日语后进入 `/ja` 并显示 `GitBook AI`。

说明：

- 直接运行 `npx playwright test tests/e2e/versions-language.spec.ts` 时被既有 `127.0.0.1:3000` 服务器占用影响；该端口运行的是另一个项目的 dev server。
- 已停止卡住的 Playwright 进程，未停止其他项目的 dev server。

## 建议下一步

1. 提交本次 canary 修复和 E2E 预期更新。
2. 单独改进 `scripts/china-access-audit.mjs` 的下载检测方式。
3. 再做一轮低风险支付入口巡检：只检查贡献页按钮和 Dodo 配置，不创建真实支付订单。
