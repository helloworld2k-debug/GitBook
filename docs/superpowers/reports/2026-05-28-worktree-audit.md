# Worktree Audit - 2026-05-28

Generated after admin layout UX completion and local CSRF dev-port fix. This report is informational only; no worktrees were removed.

## Summary

- Total worktrees including main workspace: 31
- Safe cleanup candidates: 27
- Need manual review before cleanup: 3
- Main and origin/main were aligned at audit time.

## Manual Review Before Cleanup

- `.worktrees/auth-to-redemption` on `copy/auth-to-redemption`: review unmerged commit; ahead 1, behind 95; dirty no; a917cbc 2026-05-23 fix: rename admin license copy to redemption
- `.worktrees/language-simplified-zh-admin-en-zh` on `language-simplified-zh-admin-en-zh`: review unmerged commit; ahead 1, behind 91; dirty no; 37462b0 2026-05-23 feat: simplify active language support
- `.worktrees/software-donation-site` on `fix/gstack-review-qa-benchmark-patches`: inspect before cleanup; ahead 0, behind 156; dirty yes; 9a811ad 2026-05-21 fix: TOCTOU race condition, path traversal, and resend cleanup

## Safe Cleanup Candidates

- `.worktrees/admin-dashboard-overview` on `feature/admin-dashboard-overview`: merged, clean, behind 16; ba2abca 2026-05-27 Add admin overview dashboard
- `.worktrees/admin-fixed-responsive-shell` on `feature/admin-fixed-responsive-shell`: merged, clean, behind 74; abd8e1a 2026-05-23 fix: keep admin shell chrome fixed
- `.worktrees/admin-layout-ux-audit` on `feature/admin-layout-ux-audit`: merged, clean, behind 20; 50b8e4d 2026-05-26 Improve admin layout UX
- `.worktrees/admin-license-code-ops` on `feature/admin-license-code-ops`: merged, clean, behind 89; 5035f39 2026-05-23 fix: renumber duplicate macos release migration
- `.worktrees/admin-license-management-redesign` on `feature/admin-license-management-redesign`: merged, clean, behind 64; 08fff90 2026-05-24 feat: redesign admin license management
- `.worktrees/admin-partial-refresh-pattern` on `feature/admin-partial-refresh-pattern`: merged, clean, behind 59; a5adb22 2026-05-24 feat: add inline admin support settings updates
- `.worktrees/admin-payment-settings-layout` on `fix/admin-payment-settings-layout`: merged, clean, behind 82; 672c41f 2026-05-23 fix: clarify admin payment settings layout
- `.worktrees/admin-payment-settings-toast-layout` on `fix/admin-payment-settings-toast-layout`: merged, clean, behind 76; 76f20ea 2026-05-23 fix: tidy admin payment settings feedback layout
- `.worktrees/admin-release-page-ops-ux` on `feature/admin-release-page-ops-ux`: merged, clean, behind 43; e325545 2026-05-25 Improve admin release operations UX
- `.worktrees/admin-table-alignment` on `fix/admin-table-alignment`: merged, clean, behind 74; ccb0395 2026-05-23 fix: align admin table form controls
- `.worktrees/cleanup-ai-test-data-script` on `feature/cleanup-ai-test-data-script`: merged, clean, behind 70; 1d490e2 2026-05-24 Add AI test data cleanup script
- `.worktrees/delete-published-releases` on `feature/delete-published-releases`: merged, clean, behind 38; 6f9bab9 2026-05-25 feat: allow deleting published releases
- `.worktrees/fix-admin-detail-404-regression` on `fix/admin-detail-404-regression`: merged, clean, behind 13; 253e0fd 2026-05-27 fix: keep missing admin records in shell
- `.worktrees/fix-admin-support-feedback` on `fix/admin-support-feedback`: merged, clean, behind 93; 006b046 2026-05-23 fix: repair admin support feedback access
- `.worktrees/fix-admin-user-account-404` on `fix/admin-user-account-404`: merged, clean, behind 16; e23894f 2026-05-26 fix: surface admin detail query errors
- `.worktrees/fix-admin-user-detail-second-error` on `fix/admin-user-detail-second-error`: merged, clean, behind 11; 01d4a48 2026-05-27 fix: handle postgres missing account type errors
- `.worktrees/fix-admin-users-click-detail` on `fix/admin-users-click-detail`: merged, clean, behind 12; 5c909c1 2026-05-27 fix: tolerate legacy admin user detail schema
- `.worktrees/fix-oauth-account-guidance` on `fix/oauth-account-guidance`: merged, clean, behind 26; f76b7bc 2026-05-25 fix: clarify oauth account guidance
- `.worktrees/fix-oauth-google-github-auth` on `fix/oauth-google-github-auth`: merged, clean, behind 36; b4c598f 2026-05-25 fix: repair oauth profile creation
- `.worktrees/fix-one-day-checkout-hang` on `fix/one-day-checkout-hang`: merged, clean, behind 53; 2f0ab89 2026-05-24 fix: allow Dodo live checkout form redirect
- `.worktrees/fix-payment-product-seeds` on `fix/payment-product-seeds`: merged, clean, behind 79; c65ffc6 2026-05-23 fix: save dodo product settings reliably
- `.worktrees/live-one-day-payment-test` on `feature/live-one-day-payment-test`: merged, clean, behind 60; 3c83012 2026-05-24 feat: add one-day live payment tier
- `.worktrees/payment-maintenance-mode` on `feature/payment-maintenance-mode`: merged, clean, behind 70; dda7a30 2026-05-24 feat: add payment maintenance mode
- `.worktrees/real-dodopayments-products` on `feature/real-dodopayments-products`: merged, clean, behind 87; d45c0d0 2026-05-23 chore: seed live dodo product ids
- `.worktrees/release-ops-ux-operator-upload` on `fix/release-ops-ux-operator-upload`: merged, clean, behind 40; 4d5e1df 2026-05-25 fix: align release uploads with free storage limit
- `.worktrees/release-upload-80mb` on `fix/release-upload-80mb`: merged, clean, behind 43; f52678e 2026-05-25 fix: raise release upload limit to 80mb
- `.worktrees/release-upload-partial-platforms` on `fix/release-upload-partial-platforms`: merged, clean, behind 47; 0e54fe2 2026-05-24 fix: stabilize release upload finalization

## Suggested Cleanup Commands

Review the list above first. For each safe cleanup candidate, use:

```bash
git worktree remove <path>
git branch -d <branch>
```

Do not delete the manual-review worktrees until their unmerged or dirty state has been inspected.
