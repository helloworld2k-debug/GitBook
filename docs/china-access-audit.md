# China Mainland Access Audit

Run this audit before major releases to check whether mainland China users can reach the production website, downloads, login entrypoints, support pages, and a Dodo checkout session.

```bash
npm run audit:china-access
```

The default target is `https://gitbookai.ccwu.cc`. Override it with:

```bash
CHINA_ACCESS_BASE_URL=https://gitbookai.ccwu.cc npm run audit:china-access
```

The audit checks:

- DNS resolution through AliDNS, DNSPod, 114DNS, and Baidu DNS.
- HTTP availability from Check-Host nodes in mainland China, Hong Kong, Japan, and Singapore.
- Production download links discovered from `/en`.
- External dependency risk for GitHub, Google, Telegram, Discord, Supabase Storage, Dodo Payments, and Cloudflare.

Optional checks need credentials or a real checkout session:

```bash
CHINA_ACCESS_CHECKOUT_URL="https://checkout.dodopayments.com/..." npm run audit:china-access
CHINA_ACCESS_EMAIL="user@example.com" CHINA_ACCESS_PASSWORD="..." npm run audit:china-access
```

Use `CHINA_ACCESS_REPORT_PATH` to save a JSON report:

```bash
CHINA_ACCESS_REPORT_PATH=/tmp/gitbookai-china-access-report.json npm run audit:china-access
```

Interpretation:

- `pass`: required mainland access checks succeeded.
- `risk`: required checks succeeded, but the report found medium-risk dependencies or optional checks were skipped.
- `fail`: at least one required mainland access check failed.

For mainland users, keep email/password login and Supabase-backed download links as the primary path. Treat GitHub, Google OAuth, Telegram, and Discord as unreliable fallback or overseas-only paths.
