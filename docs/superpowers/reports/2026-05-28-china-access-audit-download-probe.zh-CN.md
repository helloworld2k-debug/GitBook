# 大陆访问审计下载探针修正 - 2026-05-28

## 背景

上一轮 `npm run audit:china-access` 里，3 个公开下载链接在 check-host HTTP 检测中返回：

- `413 Maximum message size exceeded`

补充验证显示下载 URL 本身是可用的：

- `HEAD` 返回 `200`
- `Range: bytes=0-1023` 返回 `206`
- 能下载 1KB 的 `application/zip` 内容

因此 413 更像 check-host 对大文件完整抓取的限制，而不是用户下载链接失效。

## 本次修正

更新 `scripts/china-access-audit.mjs`：

- 主站页面仍使用 check-host 节点检测。
- 大文件下载链接改用轻量 range probe。
- range probe 使用 `curl -r 0-1023 -o /dev/null`。
- 只要返回 `200` 或 `206`，且实际下载字节数大于 0，即判定下载探针通过。

新增测试：

- `tests/unit/china-access-audit.test.ts` 覆盖大文件下载 URL 使用 range probe，而不是完整 body 抓取。

## 验证结果

已运行：

- `npm test -- tests/unit/china-access-audit.test.ts`
- `npm run audit:china-access`

结果：

- 单元测试通过。
- 大陆访问审计不再出现 required fail。
- 3 个下载 URL 的 range probe 均返回 `206`，并下载 1024 bytes。
- 审计整体状态为 `risk`，原因是 Supabase Storage 仍被标记为大陆访问中风险外部依赖。

## 当前解释

当前 `risk` 是合理提示，不是发布阻断：

- 主站页面 DNS 和 HTTP 从大陆检测节点均通过。
- 下载 URL 可被 range probe 访问。
- Dodo checkout 和 email/password login 是可选检查，当前因未提供临时真实参数而跳过。

## 后续建议

后续如需把大陆访问审计提升到更强信号，可以增加：

- 临时 Dodo checkout session URL 的大陆节点检查。
- 专用低权限测试账号的 email/password 登录检查。
- 下载 URL 的多 range 分段探测，例如 `0-1023` 和尾段探测。
