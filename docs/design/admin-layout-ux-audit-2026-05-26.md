# Admin Layout UX Audit

Date: 2026-05-26
Branch/worktree: `feature/admin-layout-ux-audit` at `.worktrees/admin-layout-ux-audit`
Scope: admin shell, overview, users, licenses, support feedback/settings, donations, releases, and dense operational tables.

## Executive Summary

The admin system already has a solid operational foundation: a fixed shell, persistent sidebar on large screens, mobile card fallbacks for several dense tables, visible focus rings, 44px-ish controls, and tests that protect major layout regressions. The main opportunity is not a visual restyle. It is a layout system pass that makes dense admin work easier to scan, compare, and operate repeatedly.

The highest-impact issues are:

1. The sidebar is a flat list of 13 destinations, which makes the console feel wider than its actual product model and slows route discovery.
2. Dense tables are constrained by `max-w-7xl` page sections while their own minimum widths reach 1540-1580px, so horizontal scroll becomes the default even on desktop.
3. The mobile/tablet breakpoint for dense tables switches to desktop tables at `md`, which means 768px tablet users get wide horizontal tables instead of the more usable card layout.
4. Filters, bulk actions, export, table content, and pagination are locally composed per page, creating inconsistent action hierarchy and spacing.
5. Forms and status surfaces use good base controls, but the system lacks reusable "admin workbench" primitives for filter bars, action bars, table density, and empty/error states.

No P0 release-blocking layout defect was found from static review and existing tests. The work should be treated as a P1 UX quality initiative because it affects repeated admin workflows and data-heavy pages.

## Findings

### P0: No Immediate Release Blocker Found

Impact: Current code has guardrails for the shell, focusable table scroll regions, and several mobile card fallbacks. Existing tests assert fixed shell behavior and top-aligned admin form rows.

Evidence:
- `AdminShell` keeps the app in `h-dvh overflow-hidden`, makes the content pane own scrolling, and keeps sidebar/topbar sticky: `src/components/admin/admin-shell.tsx:130-205`.
- `AdminTableShell` makes wide tables keyboard-focusable regions with `tabIndex={0}`: `src/components/admin/admin-shell.tsx:479-507`.
- Tests cover fixed chrome and scroll ownership: `tests/unit/admin-shell.test.tsx:86-104`.
- Tests protect top-aligned compact form rows: `tests/unit/admin-layout-alignment.test.ts:8-37`.

Recommendation: Do not pause other admin work for emergency layout fixes. Move into the P1 layout-system pass below.

Acceptance criteria:
- Existing admin shell/layout tests remain green.
- No page-level horizontal scroll on the outer document at 375, 768, 1024, and 1440px.

### P1: Navigation Is Too Flat For The Admin Information Architecture

Impact: The sidebar exposes 13 destinations as one undifferentiated list. Admin users must scan everything every time, and related concepts are separated by implementation history rather than task model. `support-feedback` and `support-settings` also share the same icon, reducing recognizability.

Evidence:
- Sidebar items are defined as a single flat array: `src/components/admin/admin-shell.tsx:61-76`.
- Feedback and support settings both use `MessageSquareText`: `src/components/admin/admin-shell.tsx:70-71`.
- Sidebar width is fixed at `w-72`, so grouping can fit without changing the shell footprint: `src/components/admin/admin-shell.tsx:133-151`.

Recommendation:
- Group sidebar routes into 4 labeled sections:
  - Overview: Admin dashboard.
  - Operations: Donations, Releases, Licenses, Users.
  - Content: News, Notifications, Policies.
  - Trust & Support: Support feedback, Support settings, Registration security, Audit logs.
- Keep groups expanded by default on desktop. On mobile, keep the same order inside the menu.
- Use distinct icons for feedback and settings, for example `MessageSquareText` for feedback and `LifeBuoy` or `Settings` for support settings.
- Keep active state as the current high-contrast slate pill, but add a subtle section label so active location sits inside a meaningful group.

Acceptance criteria:
- Sidebar destinations are grouped with visible section labels on desktop and the same section order in mobile navigation.
- No group label is focusable unless it expands/collapses content.
- Active route remains visually obvious with at least 4.5:1 text contrast.

### P1: Dense Tables Are Forced Into Horizontal Scroll By Container Width

Impact: The page sections use `max-w-7xl` while major tables require 1540-1580px. That means the most important admin pages are designed to scroll sideways inside a narrower card even on common desktop widths. This harms comparison across columns and makes sticky right action columns feel like a patch rather than an intentional data grid.

Evidence:
- Admin shell allows up to `max-w-[1800px]`, but page content is repeatedly constrained to `mx-auto max-w-7xl`: `src/components/admin/admin-shell.tsx:130-205`, `src/app/[locale]/admin/users/page.tsx:260-262`, `src/app/[locale]/admin/licenses/page.tsx:375-378`, `src/app/[locale]/admin/support-feedback/page.tsx:143-145`.
- Users table minimum width is `1580px`: `src/app/[locale]/admin/users/page.tsx:512-523`.
- Support feedback table minimum width is `1540px`: `src/app/[locale]/admin/support-feedback/page.tsx:219-228`.
- License code table minimum width is `1560px`: `src/app/[locale]/admin/licenses/page.tsx:816-839`.

Recommendation:
- Introduce two admin content widths:
  - `AdminStandardPage`: `max-w-7xl` for overview, forms, settings, and detail pages.
  - `AdminDataWorkbench`: `max-w-none` or `max-w-[calc(100vw-18rem)]` on large screens for pages dominated by tables.
- Use `AdminDataWorkbench` on users, licenses, support feedback, certificates, audit logs, and release history.
- Keep forms and summary cards inside readable inner containers where needed, but let the table card use the available shell width.
- Keep sticky right action columns, but reduce their width where the action has already moved into a menu.

Acceptance criteria:
- At 1440px, users/support feedback/license workbench tables use all available content width rather than being capped at 1280px.
- At 1024px, horizontal scroll is limited to table regions, never the page body.
- Sticky action columns do not cover meaningful cell content during horizontal scroll.

### P1: Tablet Widths Get Desktop Tables Too Early

Impact: `AdminTableShell` hides mobile cards at `md`, so a 768px viewport receives desktop tables with `min-w-[1040px]` through `min-w-[1580px]`. This is technically responsive but ergonomically poor for tablet and small laptop widths.

Evidence:
- `AdminTableShell` renders mobile cards as `md:hidden` and tables as `hidden md:block`: `src/components/admin/admin-shell.tsx:492-501`.
- Users table switches to a 1580px desktop table at `md`: `src/app/[locale]/admin/users/page.tsx:413-512`.
- Support feedback switches to a 1540px desktop table at `md`: `src/app/[locale]/admin/support-feedback/page.tsx:184-219`.
- Donations and releases have better mobile card patterns, but still inherit the same `md` table cutoff where `AdminTableShell` is used: `src/app/[locale]/admin/donations/page.tsx:219-251`, `src/app/[locale]/admin/releases/page.tsx:271-300`.

Recommendation:
- Add a breakpoint prop to `AdminTableShell`, for example `cardsUntil="lg"` with default `md` for simple tables.
- Use `cardsUntil="lg"` for tables wider than 1200px or with sticky action columns.
- For 768-1023px, prefer mobile/tablet cards with compact key-value rows and one overflow menu.
- Keep desktop tables at `lg` and above for dense comparison workflows.

Acceptance criteria:
- At 768px, users and support feedback render card layouts rather than 1500px horizontal tables.
- At 1024px and above, data grids can render as tables.
- Keyboard navigation reaches the same row actions in card and table modes.

### P1: Filters, Bulk Actions, Export, And Table Headers Need A Shared Workbench Pattern

Impact: Each page composes its own filter and action area. Users have to relearn whether export sits next to bulk actions, whether sort is hidden in details, and where primary actions live. The users page is the clearest example: account creation, filters, bulk toolbar, export, table, and pagination are stacked without a consistent workbench hierarchy.

Evidence:
- Users page places archive entry, summary metrics, account creation, filters, bulk toolbar, export, and table as separate blocks: `src/app/[locale]/admin/users/page.tsx:272-401`.
- User filters use a custom grid and `details` expansion: `src/components/admin/admin-user-filters.tsx:32-108`.
- License filters use a similar but separately implemented workbench grid: `src/app/[locale]/admin/licenses/page.tsx:544-641`.
- Release history uses a different header pattern for bulk actions and filters: `src/app/[locale]/admin/releases/page.tsx:211-269`.

Recommendation:
- Create a shared `AdminWorkbenchHeader` pattern:
  - Title and result count on the left.
  - Primary contextual action on the right.
  - Filters below, with primary filters always visible and advanced filters in a disclosure.
  - Bulk actions appear only after selection and occupy a consistent sticky/inline action bar.
  - Export sits in the secondary action group, not as a disconnected block.
- Do not make every page identical; make the placement and hierarchy identical.

Acceptance criteria:
- Users, licenses, releases, donations, and support feedback share the same filter/action ordering.
- Bulk action controls appear in one predictable area across pages.
- Export/download actions are visually secondary to row or workflow actions.

### P2: Overview Page Reads Like A Directory, Not An Operations Dashboard

Impact: The overview page has useful metrics, but the 12 admin links are equal-weight cards. This makes it good as a sitemap, weak as a daily operations landing page. Operators need "what needs attention" first: unread feedback, failed releases, blocked redemptions, pending support, recent errors.

Evidence:
- Overview metrics cover users, trials, feedback, and donations: `src/app/[locale]/admin/page.tsx:43-64`.
- Admin links are a uniform 12-card grid: `src/app/[locale]/admin/page.tsx:66-127` and `src/app/[locale]/admin/page.tsx:148-161`.

Recommendation:
- Keep the metric row but add an "Attention" section above the directory:
  - Unread feedback.
  - Failed/uploading releases.
  - Recent blocked redemption attempts.
  - Disabled/deleted account events or registration blocks.
- Convert the 12-card directory into grouped quick links matching the sidebar groups.
- Use smaller cards for stable navigation and larger treatment only for active operational signals.

Acceptance criteria:
- Overview first screen shows at least one operational signal, not only navigation.
- Directory cards are grouped and visually lower priority than metrics/attention.
- Empty attention state explains that no action is needed.

### P2: Status Colors Need A Semantic Legend And Non-Color Reinforcement

Impact: `AdminStatusBadge` uses color-coded tones consistently, but there is no shared legend or icon/text pattern for high-risk statuses. In dense tables, color can become the only quick signal, especially for active/inactive/deleted, failed/blocked, open/reviewing/closed.

Evidence:
- Badge tones are color-only style classes: `src/components/admin/admin-shell.tsx:512-521`.
- Users uses success/warning/danger for role, type, and status in adjacent columns: `src/app/[locale]/admin/users/page.tsx:567-580`.
- Licenses and diagnostics use multiple status values and risk signals: `src/app/[locale]/admin/licenses/page.tsx:650-690`, `src/app/[locale]/admin/licenses/page.tsx:816-918`.

Recommendation:
- Keep badge text labels, but add optional leading icons for danger/warning/success in high-density pages.
- Define semantic status groups in one place: health, lifecycle, permission, risk.
- Add a compact legend only where multiple status domains appear in one table, such as licenses.

Acceptance criteria:
- Status meaning is understandable without relying on color alone.
- Badge contrast remains at least WCAG AA for text.
- Tables with multiple status domains do not reuse the same color for conflicting meanings without a label or icon.

### P2: Form Density Is Good, But Progressive Disclosure Should Be Systematic

Impact: The admin forms generally use visible labels and touch-friendly heights, but advanced filters and creation forms are implemented page by page. Some pages expose many fields at once; others hide advanced filters inside `details`. Without a shared rule, form density depends on the page author.

Evidence:
- User filters use always-visible search/role/type/status plus advanced `details`: `src/components/admin/admin-user-filters.tsx:34-99`.
- License code filters expose five primary filters plus details and sorting/page size controls: `src/app/[locale]/admin/licenses/page.tsx:546-641`.
- Release create form exposes a substantial delivery-mode component inline before the history table: `src/app/[locale]/admin/releases/page.tsx:143-209`.
- Existing layout tests already protect top alignment for compact controls: `tests/unit/admin-layout-alignment.test.ts:8-37`.

Recommendation:
- Define an admin form density rule:
  - Primary filters: max 4 visible controls plus Apply/Reset.
  - Advanced filters: dates, sort, page size, deleted/current scope.
  - Creation flows with more than 5 fields should use sectioned fieldsets or a disclosure panel below the page header.
- Keep visible labels and `min-h-11` controls.

Acceptance criteria:
- Each list page has no more than 4 primary filters visible before advanced disclosure.
- Long creation forms are sectioned by task, not only by grid position.
- Existing top-alignment tests continue to pass.

## Layout System Proposal

### Shell

- Keep fixed app chrome: `h-dvh`, sticky sidebar, sticky topbar, content-pane scroll.
- Add sidebar group labels and route groups without changing `w-72`.
- Keep topbar utility actions, but move page-specific primary actions into page/workbench headers.

### Page Containers

- `AdminStandardPage`: centered, `max-w-7xl`, for settings, detail pages, overview, and form-heavy pages.
- `AdminDataWorkbench`: full available shell width for table-first pages.
- `AdminSplitPage`: optional future pattern for detail pages with primary content plus right-side metadata/action rail.

### Workbench Header

- Shared structure: title/result summary, primary action, secondary actions, filter bar, selection/bulk action bar.
- Export is a secondary action.
- Bulk actions appear only when relevant and keep destructive actions visually separated.

### Tables And Cards

- Tables over 1200px wide should use cards until `lg`.
- Sticky action columns should be reserved for desktop tables and kept narrow.
- Every dense table should have a mobile/tablet card equivalent with the same actions.
- Table scroll regions must stay focusable and labelled.

### Forms

- Visible labels stay mandatory.
- 44px minimum control height remains the baseline.
- Advanced filters use a consistent disclosure pattern.
- Long creation flows use fieldsets or collapsible sections.

### Color And Type

- Keep the restrained slate operational palette.
- Add semantic status token names and optional status icons for high-risk states.
- Use tabular numbers for counts, money, and date-adjacent data where layout shift matters.

## Implementation Roadmap

### Phase 1: System Primitives

1. Add route grouping metadata to the admin shell and render sidebar sections.
2. Add `AdminStandardPage` and `AdminDataWorkbench` wrappers.
3. Extend `AdminTableShell` with a breakpoint prop for card/table switching.
4. Add `AdminWorkbenchHeader` and shared filter/action layout primitives.

### Phase 2: High-Value Pages

1. Migrate users and support feedback to `AdminDataWorkbench` and card-until-`lg` behavior.
2. Migrate licenses to shared workbench header and full-width table sections.
3. Normalize releases and donations action/filter placement.
4. Convert overview directory into grouped quick links plus attention signals.

### Phase 3: Polish And Accessibility

1. Add semantic status badge variants and optional icons.
2. Add or update tests for sidebar grouping, table breakpoint behavior, and workbench action order.
3. Run browser checks at 375, 768, 1024, and 1440px with an authenticated admin session.

## Evidence Appendix

### Source Evidence

- Admin shell structure and nav list: `src/components/admin/admin-shell.tsx:61-205`.
- Admin table shell responsive behavior: `src/components/admin/admin-shell.tsx:479-507`.
- Overview metrics and directory cards: `src/app/[locale]/admin/page.tsx:43-161`.
- Users page composition and table: `src/app/[locale]/admin/users/page.tsx:260-648`.
- User filter component: `src/components/admin/admin-user-filters.tsx:32-108`.
- Licenses workbench/filter/table patterns: `src/app/[locale]/admin/licenses/page.tsx:375-641`, `src/app/[locale]/admin/licenses/page.tsx:816-1110`.
- Support feedback table/card patterns: `src/app/[locale]/admin/support-feedback/page.tsx:143-258`.
- Releases create/history/filter/table patterns: `src/app/[locale]/admin/releases/page.tsx:132-424`.
- Existing shell and table tests: `tests/unit/admin-shell.test.tsx:41-158`.
- Existing alignment tests: `tests/unit/admin-layout-alignment.test.ts:8-37`.

### Runtime Observation

- Baseline unit tests run in the new worktree:
  - `npm test -- tests/unit/admin-shell.test.tsx tests/unit/admin-layout-alignment.test.ts tests/unit/admin-pages.test.tsx tests/unit/admin-support-settings-page.test.tsx`
  - Result: 4 test files passed, 42 tests passed.
- `npm install` completed in the new worktree and reported 2 moderate npm audit vulnerabilities. No dependency changes were made for this audit task.
- `npm run dev` was blocked by missing Supabase variables in the new worktree `.env.local`.
- `npx next dev -p 3017` started successfully for layout probing, but unauthenticated/admin routes only returned the application shell title (`GitBook AI`) because local Supabase configuration was empty.
- Playwright screenshot capture could not be completed because the Chromium browser binary was missing, and `npx playwright install chromium` stalled while downloading the 165.5 MiB browser archive. The stalled install process was stopped. No authenticated admin screenshots were produced.

### UI/UX Pro Max Usage Notes

- The `ui-ux-pro-max` skill was used as the audit rubric, especially:
  - Accessibility: contrast, focus states, keyboard navigation, color not as the only signal.
  - Interaction: 44px targets, loading/feedback, predictable controls.
  - Layout: responsive breakpoints, no outer horizontal scroll, spacing scale, content priority.
  - Navigation: active state, persistent nav, hierarchy, deep route clarity.
  - Forms: visible labels, progressive disclosure, helper/error proximity.
  - Data: table alternatives, legends/labels, accessible status encoding.
- The skill CLI could not be used because the installed skill's `scripts` symlink points outside the available skill directory. The audit therefore applies the loaded `SKILL.md` rules directly rather than generated CLI recommendations.

## Report Self-Check

- Every finding above includes impact, evidence, recommendation, and acceptance criteria.
- Recommendations avoid broad visual restyling and focus on repeatable admin layout primitives.
- Screenshot limitations are explicitly recorded instead of inferred away.
- No production code was changed in this audit worktree.
