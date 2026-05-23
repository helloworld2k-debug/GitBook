# Admin License Code Operations Design

## Goal

Make the admin redemption-code area faster for operators who create, search, edit, delete, and deliver license codes every day.

## Current State

`/admin/licenses` already supports batch generation, filtering, bulk status/channel updates, soft delete, audited reveal, redemptions, entitlements, desktop sessions, cloud sync leases, and security signals. The page is powerful but overloaded. The high-frequency operator path is buried among cloud-sync diagnostics, and existing server actions for single-code edit/delete are not exposed clearly in the list.

## Product Shape

The first screen should behave like an operations console:

- Show the batch-generation form and focused code-management controls near the top.
- Keep search, filters, selection summary, and bulk actions close to the license-code table.
- Expose single-code edit and delete actions from each row.
- Keep diagnostics, security signals, redemptions, entitlements, sessions, and leases available below the code-management workflow.

## Supported Operations

- Create batches for trial, 1-month, 3-month, and 1-year codes.
- Search by id, label, masked code, or channel note.
- Filter by channel, duration, status, redemption state, deleted state, and created date.
- Reveal and copy encrypted plaintext code with audit logging.
- Edit one code's label, channel, and trial-day count when it is a trial code.
- Soft-delete one code with audit logging.
- Bulk activate, deactivate, soft-delete, and apply channel metadata.

## Constraints

- Do not store raw codes.
- Do not weaken reveal audit logging.
- Paid durations stay fixed. Operators must not edit month, quarter, or year duration lengths from the admin UI.
- Soft delete remains the delete model.
- Keep the optional-table fallback behavior for partially migrated Supabase environments.
- Preserve URL-backed filters and pagination.

## Testing

- Unit tests cover page rendering for edit/delete controls and management summaries.
- Action tests cover single-code metadata updates and soft delete.
- Component tests cover bulk selection, metadata submission, and destructive confirmation behavior.
- Existing migration-version duplicate failure is a baseline issue and should be reported separately if it remains outside this work.
