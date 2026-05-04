# Admin Users Management Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the admin user management experience with search, filtering, bulk operations, soft delete, and a permanent delete danger zone while preserving the existing admin console style.

**Architecture:** Keep the page server-rendered and query-param driven for list search and filters, then add focused client-side interaction only where selection state or confirmation UX requires it. Reuse the existing admin shell, feedback banner, and server action patterns so list actions, detail-page destructive actions, and audit logging stay consistent across the admin console.

**Tech Stack:** Next.js App Router, React 19, TypeScript, next-intl, Supabase admin client, Tailwind CSS, Vitest, Testing Library.

---

## File Structure

### Existing files to modify

- `.worktrees/software-donation-site/src/app/[locale]/admin/users/page.tsx`
  Responsibility: server-rendered user list page, query-param parsing, summary cards, filter bar, bulk toolbar container, and table layout.
- `.worktrees/software-donation-site/src/app/[locale]/admin/users/[id]/page.tsx`
  Responsibility: single-user detail page, including the new danger zone for permanent delete.
- `.worktrees/software-donation-site/src/app/[locale]/admin/actions.ts`
  Responsibility: server actions for bulk account operations, soft delete, permanent delete, and audit logging.
- `.worktrees/software-donation-site/src/components/admin/admin-shell.tsx`
  Responsibility: shared admin UI building blocks and small reusable user-management helpers if extraction is needed.
- `.worktrees/software-donation-site/messages/en.json`
- `.worktrees/software-donation-site/messages/zh-Hant.json`
- `.worktrees/software-donation-site/messages/ja.json`
- `.worktrees/software-donation-site/messages/ko.json`
  Responsibility: user-management copy for filters, bulk actions, delete states, confirmations, empty states, and danger zone labels.
- `.worktrees/software-donation-site/tests/unit/admin-pages.test.tsx`
  Responsibility: page rendering coverage for the users list and user detail admin pages.
- `.worktrees/software-donation-site/tests/unit/admin-actions.test.ts`
  Responsibility: server action coverage for bulk operations and delete flows.

### New files to create

- `.worktrees/software-donation-site/src/components/admin/admin-user-filters.tsx`
  Responsibility: reusable search and filter form UI for the users page.
- `.worktrees/software-donation-site/src/components/admin/admin-user-bulk-toolbar.tsx`
  Responsibility: selected-count display and bulk action controls.
- `.worktrees/software-donation-site/src/components/admin/admin-user-delete-danger-zone.tsx`
  Responsibility: permanent delete explanation and confirmation UI for the detail page.
- `.worktrees/software-donation-site/tests/unit/admin-user-components.test.tsx`
  Responsibility: component-level interaction coverage for the new toolbar, filter form, and delete danger zone.

### Optional schema follow-up

- If the current `profiles.account_status` column cannot safely represent `deleted`, stop implementation and add a dedicated migration task before wiring UI behavior. The preferred fallback schema is `deleted_at timestamptz` plus `deleted_by uuid`.

---

### Task 1: Define deletion state and extend admin actions

**Files:**
- Modify: `.worktrees/software-donation-site/src/app/[locale]/admin/actions.ts`
- Test: `.worktrees/software-donation-site/tests/unit/admin-actions.test.ts`

- [ ] **Step 1: Write the failing action tests for soft delete, bulk status updates, bulk role updates, and permanent delete**

Add new tests to `.worktrees/software-donation-site/tests/unit/admin-actions.test.ts` covering these behaviors:

```ts
it("soft deletes one user and audits the action", async () => {
  const profileSingle = vi.fn(async () => ({ data: { account_status: "active" }, error: null }));
  const profileEq = vi.fn(() => ({ single: profileSingle }));
  const profileSelect = vi.fn(() => ({ eq: profileEq }));
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const auditInsert = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") return { select: profileSelect, update };
    if (table === "admin_audit_logs") return { insert: auditInsert };
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.createSupabaseAdminClient.mockReturnValue({ from });

  const formData = new FormData();
  formData.set("locale", "en");
  formData.set("user_id", "user-1");
  formData.set("return_to", "/admin/users");

  await expect(softDeleteUser(formData)).rejects.toThrow("redirect:/en/admin/users?notice=user-soft-deleted");
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ account_status: "deleted" }));
  expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ action: "soft_delete_user" }));
});

it("bulk updates account status for multiple users", async () => {
  const updateIn = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ in: updateIn }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") return { update };
    if (table === "admin_audit_logs") return { insert: vi.fn(async () => ({ error: null })) };
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.createSupabaseAdminClient.mockReturnValue({ from });

  const formData = new FormData();
  formData.set("locale", "en");
  formData.set("user_ids", JSON.stringify(["user-1", "user-2"]));
  formData.set("account_status", "disabled");

  await expect(bulkUpdateUserAccountStatus(formData)).rejects.toThrow(
    "redirect:/en/admin/users?notice=bulk-user-status-updated",
  );
  expect(updateIn).toHaveBeenCalledWith("id", ["user-1", "user-2"]);
});

it("bulk updates user admin roles through owner access", async () => {
  const updateIn = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ in: updateIn }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") return { update };
    if (table === "admin_audit_logs") return { insert: vi.fn(async () => ({ error: null })) };
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.createSupabaseAdminClient.mockReturnValue({ from });

  const formData = new FormData();
  formData.set("locale", "en");
  formData.set("user_ids", JSON.stringify(["user-1", "user-2"]));
  formData.set("admin_role", "operator");

  await expect(bulkUpdateUserAdminRole(formData)).rejects.toThrow(
    "redirect:/en/admin/users?notice=bulk-user-role-updated",
  );
  expect(mocks.requireOwner).toHaveBeenCalledWith("en");
});

it("permanently deletes a user after confirmation and audits the action", async () => {
  const profileSingle = vi.fn(async () => ({ data: { email: "user@example.com" }, error: null }));
  const profileEq = vi.fn(() => ({ single: profileSingle }));
  const profileSelect = vi.fn(() => ({ eq: profileEq }));
  const deleteEq = vi.fn(async () => ({ error: null }));
  const deleteFrom = vi.fn(() => ({ eq: deleteEq }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") return { select: profileSelect, delete: deleteFrom };
    if (table === "admin_audit_logs") return { insert: vi.fn(async () => ({ error: null })) };
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.createSupabaseAdminClient.mockReturnValue({ from });

  const formData = new FormData();
  formData.set("locale", "en");
  formData.set("user_id", "user-1");
  formData.set("confirmation", "user@example.com");

  await expect(permanentlyDeleteUser(formData)).rejects.toThrow(
    "redirect:/en/admin/users?notice=user-permanently-deleted",
  );
  expect(deleteEq).toHaveBeenCalledWith("id", "user-1");
});
```

- [ ] **Step 2: Run the targeted action tests and verify they fail**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npm test -- --run tests/unit/admin-actions.test.ts
```

Expected: FAIL with missing exports such as `softDeleteUser`, `bulkUpdateUserAccountStatus`, `bulkUpdateUserAdminRole`, or `permanentlyDeleteUser`.

- [ ] **Step 3: Implement the new admin actions with validation, audit logging, and revalidation**

Add these helpers and actions in `.worktrees/software-donation-site/src/app/[locale]/admin/actions.ts`:

```ts
function getUserIds(formData: FormData) {
  const rawValue = getRequiredString(formData, "user_ids", "At least one user is required");
  const parsed = JSON.parse(rawValue);

  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((value) => typeof value !== "string" || !value)) {
    throw new Error("At least one user is required");
  }

  return parsed;
}

function getDeletableAccountStatus(formData: FormData) {
  const accountStatus = getRequiredString(formData, "account_status", "Account status is required");

  if (accountStatus !== "active" && accountStatus !== "disabled" && accountStatus !== "deleted") {
    throw new Error("Invalid account status");
  }

  return accountStatus;
}

export async function softDeleteUser(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase.from("profiles").select("account_status,email").eq("id", userId).single();
  const { error } = await supabase
    .from("profiles")
    .update({ account_status: "deleted", updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    redirectWithAdminFeedback({ fallbackPath: "/admin/users", formData, key: "user-soft-delete-failed", locale, tone: "error" });
  }

  await insertAdminAuditLog({
    action: "soft_delete_user",
    adminUserId: admin.id,
    before: before ?? null,
    after: { account_status: "deleted" },
    reason: "Soft deleted user from admin list",
    targetId: userId,
    targetType: "profile",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/users/${userId}`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({ fallbackPath: "/admin/users", formData, key: "user-soft-deleted", locale, tone: "notice" });
}

export async function bulkUpdateUserAccountStatus(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const userIds = getUserIds(formData);
  const accountStatus = getDeletableAccountStatus(formData);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ account_status: accountStatus, updated_at: new Date().toISOString() })
    .in("id", userIds);

  if (error) {
    redirectWithAdminFeedback({ fallbackPath: "/admin/users", formData, key: "bulk-user-status-update-failed", locale, tone: "error" });
  }

  await insertAdminAuditLog({
    action: "bulk_update_user_account_status",
    adminUserId: admin.id,
    after: { account_status: accountStatus, count: userIds.length },
    reason: `Bulk updated account status to ${accountStatus}`,
    targetId: userIds.join(","),
    targetType: "profile_batch",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({ fallbackPath: "/admin/users", formData, key: "bulk-user-status-updated", locale, tone: "notice" });
}

export async function bulkUpdateUserAdminRole(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireOwner(locale);
  const userIds = getUserIds(formData);
  const adminRole = getRequiredString(formData, "admin_role", "Admin role is required");

  if (adminRole !== "owner" && adminRole !== "operator" && adminRole !== "user") {
    throw new Error("Invalid admin role");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      admin_role: adminRole,
      is_admin: adminRole === "owner",
      updated_at: new Date().toISOString(),
    })
    .in("id", userIds);

  if (error) {
    redirectWithAdminFeedback({ fallbackPath: "/admin/users", formData, key: "bulk-user-role-update-failed", locale, tone: "error" });
  }

  await insertAdminAuditLog({
    action: "bulk_update_user_admin_role",
    adminUserId: admin.id,
    after: { admin_role: adminRole, count: userIds.length },
    reason: `Bulk updated user admin role to ${adminRole}`,
    targetId: userIds.join(","),
    targetType: "profile_batch",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({ fallbackPath: "/admin/users", formData, key: "bulk-user-role-updated", locale, tone: "notice" });
}

export async function permanentlyDeleteUser(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireOwner(locale);
  const userId = getRequiredString(formData, "user_id", "User is required");
  const confirmation = getRequiredString(formData, "confirmation", "Confirmation is required");
  const supabase = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase.from("profiles").select("email").eq("id", userId).single();

  if (profileError || !profile) {
    redirectWithAdminFeedback({ fallbackPath: "/admin/users", formData, key: "user-permanent-delete-failed", locale, tone: "error" });
  }

  if (confirmation !== "DELETE" && confirmation !== profile.email) {
    throw new Error("Confirmation does not match");
  }

  const { error } = await supabase.from("profiles").delete().eq("id", userId);

  if (error) {
    redirectWithAdminFeedback({ fallbackPath: "/admin/users", formData, key: "user-permanent-delete-failed", locale, tone: "error" });
  }

  await insertAdminAuditLog({
    action: "permanently_delete_user",
    adminUserId: admin.id,
    before: { email: profile.email },
    reason: "Permanently deleted user from admin detail page",
    targetId: userId,
    targetType: "profile",
  });

  revalidatePath(`/${locale}/admin/users`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({ fallbackPath: "/admin/users", formData, key: "user-permanently-deleted", locale, tone: "notice" });
}
```

Also update `updateUserAccountStatus` so it accepts `"deleted"` as a valid status if schema validation allows it:

```ts
if (accountStatus !== "active" && accountStatus !== "disabled" && accountStatus !== "deleted") {
  throw new Error("Invalid account status");
}
```

- [ ] **Step 4: Run the targeted action tests and verify they pass**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npm test -- --run tests/unit/admin-actions.test.ts
```

Expected: PASS for the new bulk and delete action cases.

- [ ] **Step 5: Commit the action-layer changes**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
git add src/app/[locale]/admin/actions.ts tests/unit/admin-actions.test.ts
git commit -m "feat: add admin user bulk and delete actions"
```

### Task 2: Build reusable search, filter, and bulk toolbar components

**Files:**
- Create: `.worktrees/software-donation-site/src/components/admin/admin-user-filters.tsx`
- Create: `.worktrees/software-donation-site/src/components/admin/admin-user-bulk-toolbar.tsx`
- Create: `.worktrees/software-donation-site/tests/unit/admin-user-components.test.tsx`

- [ ] **Step 1: Write the failing component tests for filter rendering and bulk-toolbar states**

Create `.worktrees/software-donation-site/tests/unit/admin-user-components.test.tsx` with:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminUserFilters } from "@/components/admin/admin-user-filters";
import { AdminUserBulkToolbar } from "@/components/admin/admin-user-bulk-toolbar";

describe("AdminUserFilters", () => {
  it("renders search, common filters, more-filters trigger, and reset link", () => {
    render(
      <AdminUserFilters
        actionPath="/en/admin/users"
        locale="en"
        values={{ query: "alice", role: "operator", status: "disabled", type: "admin" }}
        labels={{
          search: "Search users",
          searchPlaceholder: "Email, display name, or user ID",
          role: "Permission",
          status: "Status",
          type: "User type",
          moreFilters: "More filters",
          reset: "Reset",
          submit: "Apply",
        }}
      />,
    );

    expect(screen.getByPlaceholderText("Email, display name, or user ID")).toHaveValue("alice");
    expect(screen.getByLabelText("Permission")).toBeInTheDocument();
    expect(screen.getByText("More filters")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute("href", "/en/admin/users");
  });
});

describe("AdminUserBulkToolbar", () => {
  it("shows selected count and bulk actions", () => {
    render(
      <AdminUserBulkToolbar
        count={3}
        labels={{
          selectedCount: "3 selected",
          enable: "Bulk enable",
          disable: "Bulk disable",
          changeRole: "Bulk change role",
          softDelete: "Bulk soft delete",
          clear: "Clear selection",
        }}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulk soft delete" })).toBeInTheDocument();
  });

  it("calls clear selection", () => {
    const onClear = vi.fn();
    render(
      <AdminUserBulkToolbar
        count={2}
        labels={{
          selectedCount: "2 selected",
          enable: "Bulk enable",
          disable: "Bulk disable",
          changeRole: "Bulk change role",
          softDelete: "Bulk soft delete",
          clear: "Clear selection",
        }}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the new component tests and verify they fail**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npm test -- --run tests/unit/admin-user-components.test.tsx
```

Expected: FAIL because the new components do not exist yet.

- [ ] **Step 3: Implement the new filter and bulk-toolbar components**

Create `.worktrees/software-donation-site/src/components/admin/admin-user-filters.tsx`:

```tsx
type AdminUserFiltersProps = {
  actionPath: string;
  locale: string;
  labels: {
    moreFilters: string;
    reset: string;
    role: string;
    search: string;
    searchPlaceholder: string;
    status: string;
    submit: string;
    type: string;
  };
  values: {
    query?: string;
    role?: string;
    status?: string;
    type?: string;
  };
};

export function AdminUserFilters({ actionPath, labels, values }: AdminUserFiltersProps) {
  return (
    <form action={actionPath} className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto_auto]">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        {labels.search}
        <input
          className="min-h-11 rounded-md border border-slate-300 px-3 text-sm"
          defaultValue={values.query ?? ""}
          name="query"
          placeholder={labels.searchPlaceholder}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        {labels.role}
        <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.role ?? ""} name="role">
          <option value="">All</option>
          <option value="owner">Owner</option>
          <option value="operator">Operator</option>
          <option value="user">User</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        {labels.type}
        <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.type ?? ""} name="type">
          <option value="">All</option>
          <option value="admin">Admin</option>
          <option value="standard">Standard</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        {labels.status}
        <select className="min-h-11 rounded-md border border-slate-300 px-3 text-sm" defaultValue={values.status ?? ""} name="status">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="deleted">Deleted</option>
        </select>
      </label>
      <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <summary className="cursor-pointer list-none font-medium">{labels.moreFilters}</summary>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1">
            Registered from
            <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" name="created_from" type="date" />
          </label>
          <label className="grid gap-1">
            Registered to
            <input className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" name="created_to" type="date" />
          </label>
        </div>
      </details>
      <button className="min-h-11 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" type="submit">
        {labels.submit}
      </button>
      <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700" href={actionPath}>
        {labels.reset}
      </a>
    </form>
  );
}
```

Create `.worktrees/software-donation-site/src/components/admin/admin-user-bulk-toolbar.tsx`:

```tsx
"use client";

type AdminUserBulkToolbarProps = {
  count: number;
  labels: {
    changeRole: string;
    clear: string;
    disable: string;
    enable: string;
    selectedCount: string;
    softDelete: string;
  };
  onClear: () => void;
};

export function AdminUserBulkToolbar({ count, labels, onClear }: AdminUserBulkToolbarProps) {
  if (count <= 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-950 px-4 py-3 text-white">
      <p className="text-sm font-medium">{labels.selectedCount}</p>
      <button className="min-h-10 rounded-md bg-white/10 px-3 text-sm font-medium" type="button">
        {labels.enable}
      </button>
      <button className="min-h-10 rounded-md bg-white/10 px-3 text-sm font-medium" type="button">
        {labels.disable}
      </button>
      <button className="min-h-10 rounded-md bg-white/10 px-3 text-sm font-medium" type="button">
        {labels.changeRole}
      </button>
      <button className="min-h-10 rounded-md bg-red-500 px-3 text-sm font-semibold text-white" type="button">
        {labels.softDelete}
      </button>
      <button className="ml-auto min-h-10 rounded-md border border-white/20 px-3 text-sm font-medium" onClick={onClear} type="button">
        {labels.clear}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the component tests and verify they pass**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npm test -- --run tests/unit/admin-user-components.test.tsx
```

Expected: PASS for the new component tests.

- [ ] **Step 5: Commit the new components**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
git add src/components/admin/admin-user-filters.tsx src/components/admin/admin-user-bulk-toolbar.tsx tests/unit/admin-user-components.test.tsx
git commit -m "feat: add admin user filter and bulk toolbar components"
```

### Task 3: Rebuild the users list page around search, filters, summary cards, and selection

**Files:**
- Modify: `.worktrees/software-donation-site/src/app/[locale]/admin/users/page.tsx`
- Modify: `.worktrees/software-donation-site/src/components/admin/admin-shell.tsx`
- Test: `.worktrees/software-donation-site/tests/unit/admin-pages.test.tsx`

- [ ] **Step 1: Write the failing page-render tests for summary cards, search controls, and deleted status**

Extend `.worktrees/software-donation-site/tests/unit/admin-pages.test.tsx` with:

```tsx
it("renders admin users summary cards and search controls", async () => {
  requireAdminMock.mockResolvedValue({ id: "admin-1" });
  createSupabaseAdminClientMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return createAdminListQuery([
          {
            id: "user-1",
            email: "alice@example.com",
            display_name: "Alice",
            admin_role: "operator",
            account_status: "deleted",
            is_admin: false,
            created_at: "2026-05-01T00:00:00.000Z",
          },
        ]);
      }

      if (table === "trial_code_redemptions" || table === "desktop_sessions") {
        return createAdminListQuery([]);
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  });

  render(await AdminUsersPage({
    params: Promise.resolve({ locale: "en" }),
    searchParams: Promise.resolve({ query: "alice", status: "deleted" }),
  }));

  expect(screen.getByText("User management")).toBeInTheDocument();
  expect(screen.getByText("Total users")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Email, display name, or user ID")).toHaveValue("alice");
  expect(screen.getByText("Deleted")).toBeInTheDocument();
});

it("shows an empty filtered state with reset action", async () => {
  requireAdminMock.mockResolvedValue({ id: "admin-1" });
  createSupabaseAdminClientMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "profiles" || table === "trial_code_redemptions" || table === "desktop_sessions") {
        return createAdminListQuery([]);
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  });

  render(await AdminUsersPage({
    params: Promise.resolve({ locale: "en" }),
    searchParams: Promise.resolve({ query: "nobody" }),
  }));

  expect(screen.getByText("No users match the current filters.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Reset" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the admin page tests and verify they fail**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npm test -- --run tests/unit/admin-pages.test.tsx
```

Expected: FAIL because the page does not yet render the new summary cards, search controls, or deleted-state copy.

- [ ] **Step 3: Implement the list-page query parsing, summary cards, filter UI, and streamlined table layout**

Update `.worktrees/software-donation-site/src/app/[locale]/admin/users/page.tsx` so it:

```tsx
type AdminUsersPageSearchParams = {
  error?: string;
  notice?: string;
  query?: string;
  role?: string;
  status?: string;
  type?: string;
};

function matchesSearch(profile: {
  display_name: string | null;
  email: string | null;
  id: string;
}, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [profile.email ?? "", profile.display_name ?? "", profile.id].some((value) => value.toLowerCase().includes(normalized));
}

function matchesRole(profile: { admin_role: string | null; is_admin: boolean | null }, role?: string) {
  if (!role) {
    return true;
  }

  const resolvedRole = profile.admin_role ?? (profile.is_admin ? "owner" : "user");
  return resolvedRole === role;
}

function matchesStatus(profile: { account_status: string | null }, status?: string) {
  return !status || (profile.account_status ?? "active") === status;
}

function matchesType(profile: { is_admin: boolean | null }, type?: string) {
  if (!type) {
    return true;
  }

  return type === "admin" ? profile.is_admin === true : profile.is_admin !== true;
}
```

Then render the page using the new components:

```tsx
const filteredProfiles = (profilesResult.data ?? []).filter((profile) => {
  return (
    matchesSearch(profile, feedback?.query ?? "") &&
    matchesRole(profile, feedback?.role) &&
    matchesStatus(profile, feedback?.status) &&
    matchesType(profile, feedback?.type)
  );
});

const summary = {
  total: profilesResult.data?.length ?? 0,
  active: (profilesResult.data ?? []).filter((profile) => (profile.account_status ?? "active") === "active").length,
  disabled: (profilesResult.data ?? []).filter((profile) => profile.account_status === "disabled").length,
  elevated: (profilesResult.data ?? []).filter((profile) => profile.is_admin || profile.admin_role === "operator").length,
};
```

Render a summary-card row and the filter form above the table:

```tsx
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  <AdminCard className="p-4"><p className="text-sm text-slate-500">Total users</p><p className="mt-2 text-2xl font-semibold">{summary.total}</p></AdminCard>
  <AdminCard className="p-4"><p className="text-sm text-slate-500">Active users</p><p className="mt-2 text-2xl font-semibold">{summary.active}</p></AdminCard>
  <AdminCard className="p-4"><p className="text-sm text-slate-500">Disabled users</p><p className="mt-2 text-2xl font-semibold">{summary.disabled}</p></AdminCard>
  <AdminCard className="p-4"><p className="text-sm text-slate-500">Elevated users</p><p className="mt-2 text-2xl font-semibold">{summary.elevated}</p></AdminCard>
</div>

<AdminUserFilters
  actionPath={`/${locale}/admin/users`}
  locale={locale}
  labels={{
    moreFilters: t("moreFilters"),
    reset: t("reset"),
    role: t("filterRole"),
    search: t("search"),
    searchPlaceholder: t("searchPlaceholder"),
    status: t("filterStatus"),
    submit: t("applyFilters"),
    type: t("filterType"),
  }}
  values={{
    query: feedback?.query,
    role: feedback?.role,
    status: feedback?.status,
    type: feedback?.type,
  }}
/>
```

Replace the dense old table with a scan-first table:

```tsx
<thead>
  <tr>
    <th className="px-5 py-3"><input aria-label={t("selectAll")} type="checkbox" /></th>
    <th className="px-5 py-3">{t("user")}</th>
    <th className="px-5 py-3">{t("role")}</th>
    <th className="px-5 py-3">{t("type")}</th>
    <th className="px-5 py-3">{t("status")}</th>
    <th className="px-5 py-3">{t("devicesAndTrials")}</th>
    <th className="px-5 py-3">{t("createdAt")}</th>
    <th className="px-5 py-3">{t("actions")}</th>
  </tr>
</thead>
```

Use badge styling for `deleted`:

```tsx
<AdminStatusBadge tone={profile.account_status === "deleted" ? "warning" : profile.account_status === "active" ? "success" : "danger"}>
  {t(`statuses.${profile.account_status ?? "active"}`)}
</AdminStatusBadge>
```

Add an empty-filtered state:

```tsx
{filteredProfiles.length === 0 ? (
  <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center">
    <p className="text-base font-medium text-slate-950">{t("emptyFiltered")}</p>
    <Link className="mt-4 inline-flex min-h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700" href="/admin/users">
      {t("reset")}
    </Link>
  </div>
) : null}
```

- [ ] **Step 4: Run the page tests and verify they pass**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npm test -- --run tests/unit/admin-pages.test.tsx
```

Expected: PASS for the new list-page rendering cases.

- [ ] **Step 5: Commit the users-list page changes**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
git add src/app/[locale]/admin/users/page.tsx src/components/admin/admin-shell.tsx tests/unit/admin-pages.test.tsx
git commit -m "feat: rebuild admin users list workflow"
```

### Task 4: Add selection state, bulk submission flows, and soft-delete row actions

**Files:**
- Modify: `.worktrees/software-donation-site/src/app/[locale]/admin/users/page.tsx`
- Modify: `.worktrees/software-donation-site/src/components/admin/admin-user-bulk-toolbar.tsx`
- Test: `.worktrees/software-donation-site/tests/unit/admin-user-components.test.tsx`

- [ ] **Step 1: Write the failing interaction test for selected-state toolbar visibility**

Extend `.worktrees/software-donation-site/tests/unit/admin-user-components.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminUserTableSelection } from "@/components/admin/admin-user-bulk-toolbar";

it("reveals the bulk toolbar when at least one user is selected", () => {
  render(
    <AdminUserTableSelection
      labels={{
        changeRole: "Bulk change role",
        clear: "Clear selection",
        disable: "Bulk disable",
        enable: "Bulk enable",
        selectAll: "Select all users",
        selectedCount: "{count} selected",
        softDelete: "Bulk soft delete",
      }}
      rows={[
        { id: "user-1", label: "alice@example.com" },
        { id: "user-2", label: "bob@example.com" },
      ]}
    />,
  );

  fireEvent.click(screen.getByLabelText("Select alice@example.com"));
  expect(screen.getByText("1 selected")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component tests and verify they fail**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npm test -- --run tests/unit/admin-user-components.test.tsx
```

Expected: FAIL because the selection wrapper is not implemented yet.

- [ ] **Step 3: Implement a small client wrapper for selection and wire forms to bulk server actions**

Expand `.worktrees/software-donation-site/src/components/admin/admin-user-bulk-toolbar.tsx` to export a selection wrapper:

```tsx
"use client";

import { useState } from "react";

type Row = { id: string; label: string };

export function AdminUserTableSelection({
  children,
  labels,
  rows,
}: {
  children?: React.ReactNode;
  labels: {
    changeRole: string;
    clear: string;
    disable: string;
    enable: string;
    selectAll: string;
    selectedCount: string;
    softDelete: string;
  };
  rows: Row[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleUser(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return (
    <>
      <AdminUserBulkToolbar
        count={selectedIds.length}
        labels={{
          ...labels,
          selectedCount: labels.selectedCount.replace("{count}", String(selectedIds.length)),
        }}
        onClear={clearSelection}
      />
      {rows.map((row) => (
        <label className="sr-only" key={row.id}>
          Select {row.label}
          <input
            checked={selectedIds.includes(row.id)}
            onChange={() => toggleUser(row.id)}
            type="checkbox"
          />
        </label>
      ))}
      {children}
    </>
  );
}
```

Update `.worktrees/software-donation-site/src/app/[locale]/admin/users/page.tsx` so each row includes:

```tsx
<input
  aria-label={`Select ${profile.email}`}
  className="size-4 rounded border-slate-300"
  name="selected_user_ids"
  type="checkbox"
  value={profile.id}
/>
```

And add bulk-action forms above the table:

```tsx
<form action={bulkUpdateUserAccountStatus}>
  <input name="locale" type="hidden" value={locale} />
  <input name="user_ids" type="hidden" value={JSON.stringify(selectedIds)} />
  <input name="account_status" type="hidden" value="active" />
</form>
```

Add a row-level soft-delete form:

```tsx
<form action={softDeleteUser}>
  <input name="locale" type="hidden" value={locale} />
  <input name="return_to" type="hidden" value="/admin/users" />
  <input name="user_id" type="hidden" value={profile.id} />
  <ConfirmActionButton className="text-sm font-semibold text-red-700" confirmLabel={t("softDelete")} pendingLabel={adminT("common.processing")}>
    {t("softDelete")}
  </ConfirmActionButton>
</form>
```

- [ ] **Step 4: Run the component tests and verify they pass**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npm test -- --run tests/unit/admin-user-components.test.tsx
```

Expected: PASS for selection-driven toolbar visibility.

- [ ] **Step 5: Commit the selection and soft-delete list behavior**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
git add src/app/[locale]/admin/users/page.tsx src/components/admin/admin-user-bulk-toolbar.tsx tests/unit/admin-user-components.test.tsx
git commit -m "feat: add admin user selection and soft delete flows"
```

### Task 5: Add the permanent-delete danger zone on the user detail page

**Files:**
- Create: `.worktrees/software-donation-site/src/components/admin/admin-user-delete-danger-zone.tsx`
- Modify: `.worktrees/software-donation-site/src/app/[locale]/admin/users/[id]/page.tsx`
- Test: `.worktrees/software-donation-site/tests/unit/admin-pages.test.tsx`

- [ ] **Step 1: Write the failing detail-page test for the danger zone**

Extend `.worktrees/software-donation-site/tests/unit/admin-pages.test.tsx`:

```tsx
it("renders the permanent delete danger zone on the admin user detail page", async () => {
  requireAdminMock.mockResolvedValue({ id: "admin-1" });
  createSupabaseAdminClientMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return createAdminListQuery({
          id: "user-1",
          email: "alice@example.com",
          display_name: "Alice",
          public_display_name: "Alice",
          public_supporter_enabled: true,
          admin_role: "user",
          account_status: "active",
          is_admin: false,
          created_at: "2026-05-01T00:00:00.000Z",
        });
      }

      return createAdminListQuery([]);
    }),
  });

  render(await AdminUserDetailPage({
    params: Promise.resolve({ id: "user-1", locale: "en" }),
    searchParams: Promise.resolve({}),
  }));

  expect(screen.getByText("Danger zone")).toBeInTheDocument();
  expect(screen.getByText("Permanent delete user")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the admin page tests and verify they fail**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npm test -- --run tests/unit/admin-pages.test.tsx
```

Expected: FAIL because the detail page does not yet include the danger zone.

- [ ] **Step 3: Build the danger-zone component and mount it below the existing detail sections**

Create `.worktrees/software-donation-site/src/components/admin/admin-user-delete-danger-zone.tsx`:

```tsx
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";

export function AdminUserDeleteDangerZone({
  action,
  confirmationHint,
  email,
  labels,
  locale,
  userId,
}: {
  action: (formData: FormData) => Promise<void>;
  confirmationHint: string;
  email: string;
  labels: {
    confirmation: string;
    description: string;
    submit: string;
    title: string;
    warning: string;
  };
  locale: string;
  userId: string;
}) {
  return (
    <section className="mt-6 rounded-md border border-red-200 bg-red-50 p-5">
      <h2 className="text-base font-semibold text-red-900">{labels.title}</h2>
      <p className="mt-2 text-sm leading-6 text-red-800">{labels.description}</p>
      <p className="mt-2 text-sm font-medium text-red-900">{labels.warning}</p>
      <form action={action} className="mt-4 grid gap-3">
        <input name="locale" type="hidden" value={locale} />
        <input name="user_id" type="hidden" value={userId} />
        <label className="grid gap-1 text-sm font-medium text-red-900">
          {labels.confirmation}
          <input className="min-h-11 rounded-md border border-red-300 bg-white px-3 text-sm text-slate-950" name="confirmation" placeholder={confirmationHint} required />
        </label>
        <AdminSubmitButton className="inline-flex min-h-10 w-fit items-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white" pendingLabel="Deleting...">
          {labels.submit}
        </AdminSubmitButton>
      </form>
      <p className="mt-3 text-xs text-red-700">Accepted confirmation values: <span className="font-mono">DELETE</span> or <span className="font-mono">{email}</span></p>
    </section>
  );
}
```

Mount it in `.worktrees/software-donation-site/src/app/[locale]/admin/users/[id]/page.tsx`:

```tsx
import { AdminUserDeleteDangerZone } from "@/components/admin/admin-user-delete-danger-zone";
import { permanentlyDeleteUser } from "../../actions";

<AdminUserDeleteDangerZone
  action={permanentlyDeleteUser}
  confirmationHint={profile.email}
  email={profile.email}
  labels={{
    confirmation: t("deleteConfirmation"),
    description: t("dangerDescription"),
    submit: t("permanentDelete"),
    title: t("dangerZone"),
    warning: t("dangerWarning"),
  }}
  locale={locale}
  userId={profile.id}
/>
```

- [ ] **Step 4: Run the page tests and verify they pass**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npm test -- --run tests/unit/admin-pages.test.tsx
```

Expected: PASS for the danger-zone rendering case.

- [ ] **Step 5: Commit the detail-page delete workflow**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
git add src/app/[locale]/admin/users/[id]/page.tsx src/components/admin/admin-user-delete-danger-zone.tsx tests/unit/admin-pages.test.tsx
git commit -m "feat: add admin user permanent delete danger zone"
```

### Task 6: Add translations, feedback copy, and final verification

**Files:**
- Modify: `.worktrees/software-donation-site/messages/en.json`
- Modify: `.worktrees/software-donation-site/messages/zh-Hant.json`
- Modify: `.worktrees/software-donation-site/messages/ja.json`
- Modify: `.worktrees/software-donation-site/messages/ko.json`
- Modify: `.worktrees/software-donation-site/src/components/admin/admin-shell.tsx`
- Test: `.worktrees/software-donation-site/tests/unit/admin-pages.test.tsx`
- Test: `.worktrees/software-donation-site/tests/unit/admin-actions.test.ts`
- Test: `.worktrees/software-donation-site/tests/unit/admin-user-components.test.tsx`

- [ ] **Step 1: Write the failing i18n-aware page test for new copy keys**

Add one assertion to `.worktrees/software-donation-site/tests/unit/admin-pages.test.tsx`:

```tsx
expect(screen.getByText("Bulk soft delete")).toBeInTheDocument();
expect(screen.getByText("Danger zone")).toBeInTheDocument();
```

Expected initial failure: missing translation keys or labels not rendered.

- [ ] **Step 2: Add the new translation keys and feedback messages**

Update `.worktrees/software-donation-site/messages/en.json` under `admin.users`:

```json
{
  "search": "Search users",
  "searchPlaceholder": "Email, display name, or user ID",
  "applyFilters": "Apply",
  "reset": "Reset",
  "filterRole": "Permission",
  "filterType": "User type",
  "filterStatus": "Status",
  "moreFilters": "More filters",
  "type": "Type",
  "createdAt": "Created",
  "actions": "Actions",
  "devicesAndTrials": "Devices / trials",
  "selectAll": "Select all users",
  "softDelete": "Soft delete",
  "bulkEnable": "Bulk enable",
  "bulkDisable": "Bulk disable",
  "bulkChangeRole": "Bulk change role",
  "bulkSoftDelete": "Bulk soft delete",
  "clearSelection": "Clear selection",
  "selectedCount": "{count} selected",
  "emptyFiltered": "No users match the current filters.",
  "dangerZone": "Danger zone",
  "dangerDescription": "Permanently deleting a user removes the profile and cannot be undone.",
  "dangerWarning": "Only use this when the account must be fully erased.",
  "deleteConfirmation": "Type DELETE or the user email to confirm",
  "permanentDelete": "Permanent delete",
  "summaryTotal": "Total users",
  "summaryActive": "Active users",
  "summaryDisabled": "Disabled users",
  "summaryElevated": "Elevated users"
}
```

Update `.worktrees/software-donation-site/src/components/admin/admin-shell.tsx` inside `adminFeedbackMessages`:

```ts
"bulk-user-role-updated": "Updated user role for the selected users.",
"bulk-user-role-update-failed": "Unable to update user role for the selected users.",
"bulk-user-status-updated": "Updated account status for the selected users.",
"bulk-user-status-update-failed": "Unable to update account status for the selected users.",
"user-soft-deleted": "User soft-deleted.",
"user-soft-delete-failed": "Unable to soft-delete the user.",
"user-permanently-deleted": "User permanently deleted.",
"user-permanent-delete-failed": "Unable to permanently delete the user.",
```

Mirror the new `admin.users` keys in `zh-Hant.json`, `ja.json`, and `ko.json` with product-appropriate translations or temporary English fallback if the repo’s existing localization policy allows it.

- [ ] **Step 3: Run the focused verification suite**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npm test -- --run tests/unit/admin-actions.test.ts tests/unit/admin-pages.test.tsx tests/unit/admin-user-components.test.tsx
```

Expected: PASS for all targeted admin user-management tests.

- [ ] **Step 4: Run lint for the touched files**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
npx eslint src/app/[locale]/admin/actions.ts src/app/[locale]/admin/users/page.tsx src/app/[locale]/admin/users/[id]/page.tsx src/components/admin/admin-shell.tsx src/components/admin/admin-user-filters.tsx src/components/admin/admin-user-bulk-toolbar.tsx src/components/admin/admin-user-delete-danger-zone.tsx tests/unit/admin-actions.test.ts tests/unit/admin-pages.test.tsx tests/unit/admin-user-components.test.tsx
```

Expected: no lint errors.

- [ ] **Step 5: Commit the copy and final verification changes**

Run:

```bash
cd /Users/happyamd/Documents/HappyFiles/Hwork2026/20260429ThreeFriends/3friends_website/.worktrees/software-donation-site
git add messages/en.json messages/zh-Hant.json messages/ja.json messages/ko.json src/components/admin/admin-shell.tsx tests/unit/admin-pages.test.tsx tests/unit/admin-actions.test.ts tests/unit/admin-user-components.test.tsx
git commit -m "feat: finalize admin user management enhancement"
```

## Self-Review

### Spec coverage

- Search: covered in Task 2 and Task 3.
- Filter bar and reset: covered in Task 2 and Task 3.
- Summary cards: covered in Task 3.
- Bulk selection and toolbar: covered in Task 4.
- Bulk enable, disable, soft delete, and role update: covered in Task 1 and Task 4.
- Soft delete on list page: covered in Task 1 and Task 4.
- Permanent delete in detail danger zone: covered in Task 1 and Task 5.
- Copy and feedback polish: covered in Task 6.
- Verification: covered in Task 6.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- All tasks specify exact files, test files, commands, and expected outcomes.

### Type consistency

- Bulk actions use `user_ids` for multi-user forms.
- Single-user actions use `user_id`.
- Delete states consistently use `account_status: "deleted"` in the plan.

