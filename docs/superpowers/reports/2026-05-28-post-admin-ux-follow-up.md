# Post Admin UX Follow-Up - 2026-05-28

This report records the follow-up work completed after the admin layout UX rollout, deployment, and worktree cleanup.

## Production Health Check

- Ran `npm run canary:production` against `https://gitbookai.ccwu.cc`.
- Result: pass.
- Covered public pages, localized home routes, download link discovery, download URLs, auth callback redirect behavior, Dodo webhook config, DNS, and the www domain.

## Logged-In Admin Regression

- Used a dedicated operator visual QA account.
- Reset the account password before QA and rotated it again after QA.
- Checked these production admin pages:
  - `/en/admin`
  - `/en/admin/users`
  - `/en/admin/licenses`
  - `/en/admin/support-feedback`
- Checked viewport widths:
  - `375`
  - `768`
  - `1024`
  - `1440`
- Result: pass.
- No page-level horizontal overflow, browser page errors, 5xx responses, missing headings, or application error states were detected.

## Language Strategy Branch Review

Reviewed `language-simplified-zh-admin-en-zh`.

Current recommendation: do not merge this branch into `main` as part of the admin UX follow-up.

Reasons:

- It is a product strategy change, not an admin UX cleanup.
- It removes active `ja`, `ko`, and `zh-Hant` message files and introduces `zh`.
- It updates 36 files with a large test churn footprint.
- It is based on older code and would currently drop the `one_day` contribution tier from `src/config/site.ts`.

Recommended next step: decide the language strategy separately before implementation:

- Keep the current active languages: `en`, `zh-Hant`, `ja`, `ko`.
- Or intentionally simplify to `en` and `zh`, then rebase and re-plan the branch against current `main`.

## Local Branch Cleanup

Cleaned local branches that were already included in `main` or no longer carried useful tracked work:

- `feature/software-donation-site`
- `fix/oauth-production-redirect-url`
- `fix/oauth-www-redirect-url`
- `chore/cleanup-post-merge`
- `master`

Retained:

- `language-simplified-zh-admin-en-zh`

Reason: it remains the only meaningful local branch carrying an unmerged product decision.

## Current State

- Only the main workspace remains in `git worktree list`.
- `main` is aligned with `origin/main` before this report commit.
- The only retained non-main local branch is `language-simplified-zh-admin-en-zh`.
