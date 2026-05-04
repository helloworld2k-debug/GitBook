# Admin Users Management Enhancement Design

## Goal

Enhance the admin user management experience in the software donation site so administrators can search users faster, filter by operational attributes, handle users in batches, and safely remove accounts with a clear distinction between soft delete and permanent deletion.

## Context

The current admin users experience already provides:

- A list page at `src/app/[locale]/admin/users/page.tsx`
- A user detail page at `src/app/[locale]/admin/users/[id]/page.tsx`
- Inline role and status updates
- Trial and device summaries
- Shared admin layout and feedback components

The current page is functionally useful but operationally heavy:

- There is no search entry point for quickly locating a user.
- There is no multi-condition filtering for permissions, account type, or status.
- There is no selection model or bulk action flow.
- There is no delete workflow.
- Important actions are distributed across table cells rather than organized into a task-oriented toolbar.

This enhancement should preserve the existing admin visual language while making the user page feel like a practical operations console.

## Scope

This design covers:

- User list information architecture
- Search behavior
- Filter behavior
- Bulk action behavior
- Soft delete and permanent delete interaction design
- Layout, button hierarchy, and action placement
- Success, error, empty, and confirmation states

This design does not cover:

- Rebuilding unrelated admin pages
- Changing the underlying business meaning of roles or account states
- Designing a separate advanced analytics dashboard for users

## Product Decisions Confirmed

- Deletion model: support both soft delete and permanent delete.
- Default delete behavior: soft delete.
- Permanent delete placement: only in the single-user detail page danger zone.
- Bulk actions in version one: bulk enable, bulk disable, bulk soft delete, and bulk change role/type.
- Recommended layout direction: summary cards + persistent filter bar + conditional bulk action toolbar.

## Users and Jobs To Be Done

### Primary Admin Jobs

- Find a specific user by email, display name, or user ID.
- Narrow the list to operational subsets such as admins, disabled users, or specific user types.
- Perform the same action on multiple users without visiting each detail page.
- Distinguish safe day-to-day actions from irreversible destructive actions.
- Understand the impact of deletion before confirming it.

### UX Principles

- Keep browsing and acting separate: search/filter first, then operate.
- Keep dangerous actions layered: soft delete in list, permanent delete in detail.
- Keep bulk actions invisible until relevant.
- Keep common filters visible without overwhelming the screen.
- Keep the page consistent with the existing `AdminShell` style and interaction tone.

## Page Structure

The admin users list page should be reorganized into five vertical layers:

1. Page header
2. Summary cards
3. Persistent search and filter bar
4. Conditional bulk action toolbar
5. User results table

### 1. Page Header

Retain the existing page title and short description pattern from `AdminPageHeader`.

The header should continue to communicate:

- This is the user operations area
- The page supports review, account changes, and account removal workflows

### 2. Summary Cards

Add a compact summary row beneath the header with four cards:

- Total users
- Active users
- Disabled users
- Admin or elevated users

Purpose:

- Provide at-a-glance operational context
- Help admins understand whether filters are narrowing from a large or small population
- Make the page feel like a control surface rather than a plain data dump

Behavior:

- Cards are informational in version one
- Cards do not need click-to-filter behavior in the first release
- Counts should reflect the current dataset definitions, not the filtered subset, unless implementation simplicity strongly favors filtered counts; if filtered counts are used, label that clearly

## Search Design

### Search Placement

Place the search field on the left side of the persistent control bar, before filter controls.

### Search Targets

The search should support matching against:

- Email
- Display name
- User ID

### Search Interaction

- One search box for all supported fields
- Placeholder should make the multi-field behavior obvious
- Search should work together with filters rather than replacing them
- Search term should persist during filter changes and paging

### Search Trigger

Preferred behavior:

- Submit-based search with explicit form submit or Enter key

Reasoning:

- More stable for server-rendered admin pages
- Easier to preserve query params and avoid noisy request churn
- Lower implementation risk than instant search

If the implementation later supports debounced search cleanly, that can be an enhancement, but it is not required for this design.

## Filter Design

### Always-Visible Filters

Keep three high-frequency filters visible in the main control bar:

- Permission
- User type
- Account status

These should be the fastest path for routine operational slicing.

### “More Filters”

Place lower-frequency filters in an expandable or popover-based “More filters” control. Initial candidates:

- Registration date range
- Has bound device or session
- Has trial records
- Has donations or certificates
- Soft-deleted only or include deleted

This keeps the page compact while still allowing meaningful segmentation.

### Reset

Provide a visible `Reset` action at the right side of the filter area.

Reset behavior:

- Clear search
- Clear all visible and advanced filters
- Return the list to the default state
- Clear pagination back to the first page if pagination is present

### Filter Chips

If implementation is straightforward, show active filter chips below the control bar. This is optional for version one but recommended because it helps explain why the list is narrow.

## Bulk Selection and Bulk Action Design

### Selection Model

Add a selection checkbox column at the start of the table.

Support:

- Row checkbox per user
- Header checkbox for select-all on current page

Version one scope:

- Select current page only
- No cross-page bulk selection required

This keeps mental and technical complexity reasonable.

### Conditional Bulk Toolbar

When one or more users are selected, display a bulk action toolbar directly below the search/filter bar.

When zero users are selected, this toolbar should not appear.

Toolbar contents:

- Selected count
- Bulk enable
- Bulk disable
- Bulk change role/type
- Bulk soft delete
- Clear selection

### Bulk Change Role/Type

Do not perform bulk role or type mutation inline from the toolbar itself.

Instead:

- Clicking the action opens a modal or compact dialog
- The admin chooses the target role or type
- The dialog clearly states how many users are affected
- Confirmation is required before submit

Reasoning:

- Prevents accidental mass changes
- Makes the intent explicit
- Supports validation before execution

### Bulk Delete

Bulk delete in version one means bulk soft delete only.

The action should:

- Use destructive styling
- Require confirmation
- Clearly say the selected users will be disabled or moved into deleted status, not permanently erased

## Delete Design

### Soft Delete on List Page

The list page should expose soft delete as the only delete action.

Recommended placement:

- In the row actions menu, not as a permanently visible red button

Recommended language:

- “Soft delete”
- Or a product-specific phrase such as “Disable and mark deleted”

The wording should make it obvious that the record is not permanently erased.

### Permanent Delete on Detail Page

Permanent delete belongs only in the single-user detail page.

Place it in a visually distinct danger section near the bottom of the page:

- Separate card
- Red-accented header or border treatment
- Clear irreversible warning copy

The danger section should explain:

- The user will be permanently removed
- Which related records will be removed
- Which operational traces remain for audit requirements, if any

### Permanent Delete Confirmation

Permanent delete must require a hardened confirmation flow:

- Confirmation dialog or dedicated inline confirmation area
- Require the admin to type either the user email or a fixed confirmation token such as `DELETE`
- Disable submit until the confirmation matches

This action must never be one click.

### Delete Impact Messaging

Before permanent deletion, surface relevant dependency information if available:

- Donations
- Certificates
- Device sessions
- Trial records
- Audit implications

If implementation cannot fully compute all dependencies before submit, the UI should still show a generic irreversible warning and the server must remain authoritative.

## Table Layout

The current table is too action-dense inside middle columns. The updated table should prioritize scanning.

### Recommended Columns

- Selection checkbox
- User information
- Permission
- User type
- Status
- Device or trial summary
- Created at
- Actions

### User Information Cell

Use a stacked presentation:

- Primary line: email or preferred top-level identifier
- Secondary line: display name
- Tertiary line: user ID in subdued mono text

This preserves detail without requiring extra columns.

### Permission and Status

Permission and status should use badges where possible:

- Owner or admin roles should stand out visually
- Disabled or deleted states should be easy to scan

### Actions Column

Use a compact action strategy:

- Preferred primary action: `View details`
- Secondary actions in a `More` menu

Possible row actions:

- View details
- Edit
- Soft delete

Avoid showing too many inline buttons in every row.

## Button Hierarchy and Layout Rules

### Hierarchy

- Primary buttons: dark filled, reserved for the most important submit action in a region
- Secondary buttons: outlined or neutral
- Tertiary actions: text or subtle menu items
- Destructive actions: red, only when context already indicates risk

### Layout

- Keep the search input wider than individual filters
- Keep filter controls aligned in one row on desktop where possible
- Allow wrapping into two rows on medium widths rather than shrinking controls too far
- On mobile or narrow screens, stack controls vertically while preserving order: search first, filters second, reset last

## Feedback and States

### Success Feedback

Continue using the existing admin feedback banner system for:

- Soft delete success
- Bulk action success
- Permanent delete success
- Bulk role/type update success

Messages should state both action and count where appropriate.

Examples:

- “Soft-deleted 3 users.”
- “Updated account status for 12 users.”

### Error Feedback

Errors should also return through the feedback banner, with clear recovery language when possible.

Examples:

- “Could not delete 2 users because they still have protected related records.”
- “Bulk role update failed. No users were changed.”

### Empty States

Handle at least two empty states:

- No users exist
- No users match the current search and filters

The second state should offer a clear `Reset filters` action.

### Confirmation States

Confirmation should be required for:

- Bulk soft delete
- Permanent delete
- Bulk role/type changes

Bulk enable and disable may skip confirmation if product wants speed, but a confirmation step is still recommended when many users are selected.

## Data and Query Considerations

The list page currently fetches the newest users plus trial and desktop session summaries. The enhanced page will likely need additional query parameters and derived counts.

Version one can stay server-rendered and query-param driven:

- Search term in URL
- Filters in URL
- Selection handled in client interactions or form posts

This approach fits the existing page architecture and keeps deep linking possible.

### Soft Delete Data Model

Soft delete needs a stable representation. Preferred approaches:

- Reuse `account_status` if it can safely gain a `deleted` value
- Or add an explicit `deleted_at` timestamp and optionally `deleted_by`

Recommendation:

- Prefer explicit soft-delete fields if the schema allows it cleanly
- If schema churn must stay minimal, extending `account_status` may be acceptable, but only if it does not blur disabled versus deleted semantics

Disabled and deleted should remain distinct concepts:

- Disabled: account is blocked but still operationally present
- Deleted: account is intentionally removed from active operations but still recoverable or auditable until permanent delete

### Permanent Delete Behavior

Permanent deletion should be enforced server-side only after:

- Authorization check
- Dependency check
- Audit log write if policy requires it

The UI must never be treated as the sole safeguard.

## Accessibility and Interaction Quality

- All icon-only or condensed actions need accessible labels
- Bulk toolbar appearance should not steal keyboard focus
- Confirmation dialogs must have clear cancel paths
- Destructive buttons must not be adjacent to primary safe actions without spacing separation
- Filters and search must be fully keyboard operable
- Selection count updates should be available to assistive technology through status text where practical

## Testing Scope

The implementation should be verified at the interaction level for:

- Search by email, display name, and user ID
- Combining multiple filters
- Resetting filters
- Selecting rows and clearing selection
- Bulk enable, disable, soft delete, and role/type changes
- Soft delete from list page
- Permanent delete confirmation on detail page
- Empty search results and empty dataset states
- Feedback messages after each operation

## Implementation Notes

Expected implementation areas:

- `src/app/[locale]/admin/users/page.tsx`
- `src/app/[locale]/admin/users/[id]/page.tsx`
- `src/app/[locale]/admin/actions.ts`
- `src/components/admin/admin-shell.tsx`
- `messages/*.json`
- Related tests for admin workflows

Where possible, new interaction pieces should be extracted into focused admin components instead of making the list page file significantly larger.

## Recommended Rollout

Implement in this order:

1. Search and filter infrastructure
2. Table restructuring and summary cards
3. Selection model and bulk toolbar
4. Bulk operations
5. Soft delete flow
6. Detail-page danger zone and permanent delete flow
7. Feedback and test coverage refinement

This sequence delivers incremental value while reducing destructive-action risk early.
