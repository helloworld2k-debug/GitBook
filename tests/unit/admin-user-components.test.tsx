import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminUserBulkToolbar, AdminUserSelectAllCheckbox } from "@/components/admin/admin-user-bulk-toolbar";
import { AdminUserDeleteDangerZone } from "@/components/admin/admin-user-delete-danger-zone";
import { AdminUserFilters } from "@/components/admin/admin-user-filters";

describe("AdminUserFilters", () => {
  it("renders search, common filters, more-filters trigger, and reset link", () => {
    render(
      <AdminUserFilters
        actionPath="/en/admin/users"
        labels={{
          allRoles: "All permissions",
          allStatuses: "All statuses",
          allTypes: "All user types",
          apply: "Apply",
          createdFrom: "Registered from",
          createdTo: "Registered to",
          moreFilters: "More filters",
          reset: "Reset",
          role: "Permission",
          search: "Search users",
          searchPlaceholder: "Email, display name, or user ID",
          status: "Status",
          type: "User type",
        }}
        values={{ createdFrom: "", createdTo: "", query: "alice", role: "operator", status: "disabled", type: "admin" }}
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
    document.body.innerHTML = `
      <form id="bulk-users-form">
        <input type="checkbox" name="user_ids" value="user-1" checked />
        <input type="checkbox" name="user_ids" value="user-2" checked />
        <input type="checkbox" name="user_ids" value="user-3" checked />
      </form>
    `;

    render(
      <AdminUserBulkToolbar
        canManageRoles
        formId="bulk-users-form"
        labels={{
          bulkDisable: "Bulk disable",
          bulkEnable: "Bulk enable",
          bulkRole: "Bulk change role",
          bulkSoftDelete: "Bulk soft delete",
          clearSelection: "Clear selection",
          operatorRole: "Operator",
          ownerRole: "Owner",
          roleTarget: "Target role",
          selectedCount: "{count} selected",
          userRole: "User",
        }}
      />,
    );

    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulk soft delete" })).toBeInTheDocument();
  });

  it("submits the selected users and intent through the target form", () => {
    document.body.innerHTML = `
      <form id="bulk-users-form">
        <input name="locale" type="hidden" value="en" />
        <input type="checkbox" name="user_ids" value="user-1" checked />
        <input type="checkbox" name="user_ids" value="user-2" checked />
        <input type="checkbox" name="user_ids" value="user-3" />
      </form>
    `;
    const form = document.getElementById("bulk-users-form") as HTMLFormElement;
    const submit = vi.fn((event: SubmitEvent) => event.preventDefault());
    form.addEventListener("submit", submit);

    render(
      <AdminUserBulkToolbar
        canManageRoles={false}
        formId="bulk-users-form"
        labels={{
          bulkDisable: "Bulk disable",
          bulkEnable: "Bulk enable",
          bulkRole: "Bulk change role",
          bulkSoftDelete: "Bulk soft delete",
          clearSelection: "Clear selection",
          operatorRole: "Operator",
          ownerRole: "Owner",
          roleTarget: "Target role",
          selectedCount: "{count} selected",
          userRole: "User",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Bulk disable" }));

    const submittedData = new FormData(form);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submittedData.get("intent")).toBe("disable");
    expect(submittedData.getAll("user_ids")).toEqual(["user-1", "user-2"]);
  });

  it("copies externally associated selected users into the hidden form before submit", () => {
    document.body.innerHTML = `
      <form id="bulk-users-form">
        <input name="locale" type="hidden" value="en" />
      </form>
      <input form="bulk-users-form" type="checkbox" name="user_ids" value="user-1" checked />
      <input form="bulk-users-form" type="checkbox" name="user_ids" value="user-2" checked />
      <input form="bulk-users-form" type="checkbox" name="user_ids" value="user-3" />
    `;
    const form = document.getElementById("bulk-users-form") as HTMLFormElement;
    form.addEventListener("submit", (event) => event.preventDefault());

    render(
      <AdminUserBulkToolbar
        canManageRoles={false}
        formId="bulk-users-form"
        labels={{
          bulkDisable: "Bulk disable",
          bulkEnable: "Bulk enable",
          bulkRole: "Bulk change role",
          bulkSoftDelete: "Bulk soft delete",
          clearSelection: "Clear selection",
          operatorRole: "Operator",
          ownerRole: "Owner",
          roleTarget: "Target role",
          selectedCount: "{count} selected",
          userRole: "User",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Bulk disable" }));

    const submittedData = new FormData(form);
    expect(submittedData.get("intent")).toBe("disable");
    const generatedUserIds = Array.from(form.querySelectorAll<HTMLInputElement>('input[data-bulk-generated="true"][name="user_ids"]')).map((input) => input.value);
    expect(generatedUserIds).toEqual(["user-1", "user-2"]);
    expect(submittedData.getAll("user_ids")).toContain("user-1");
    expect(submittedData.getAll("user_ids")).toContain("user-2");
  });

  it("submits every bulk intent with generated hidden fields", () => {
    document.body.innerHTML = `
      <form id="bulk-users-form">
        <input name="locale" type="hidden" value="en" />
      </form>
      <input form="bulk-users-form" type="checkbox" name="user_ids" value="user-1" checked />
      <input form="bulk-users-form" type="checkbox" name="user_ids" value="user-2" checked />
    `;
    const form = document.getElementById("bulk-users-form") as HTMLFormElement;
    const submit = vi.fn((event: SubmitEvent) => event.preventDefault());
    form.addEventListener("submit", submit);

    render(
      <AdminUserBulkToolbar
        canManageRoles
        formId="bulk-users-form"
        labels={{
          bulkDisable: "Bulk disable",
          bulkEnable: "Bulk enable",
          bulkRole: "Bulk change role",
          bulkSoftDelete: "Bulk soft delete",
          clearSelection: "Clear selection",
          operatorRole: "Operator",
          ownerRole: "Owner",
          roleTarget: "Target role",
          selectedCount: "{count} selected",
          userRole: "User",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Bulk enable" }));
    expect(new FormData(form).get("intent")).toBe("enable");

    fireEvent.click(screen.getByRole("button", { name: "Bulk disable" }));
    expect(new FormData(form).get("intent")).toBe("disable");

    fireEvent.change(screen.getByLabelText("Target role"), { target: { value: "operator" } });
    fireEvent.click(screen.getByRole("button", { name: "Bulk change role" }));
    expect(new FormData(form).get("intent")).toBe("change-role");
    expect(new FormData(form).get("admin_role")).toBe("operator");
    expect(form.querySelector<HTMLInputElement>('input[type="hidden"][name="admin_role"]')?.value).toBe("operator");

    fireEvent.click(screen.getByRole("button", { name: "Bulk soft delete" }));
    const submittedData = new FormData(form);
    expect(submittedData.get("intent")).toBe("soft-delete");
    expect(Array.from(form.querySelectorAll<HTMLInputElement>('input[data-bulk-generated="true"][name="user_ids"]')).map((input) => input.value)).toEqual(["user-1", "user-2"]);
    expect(submit).toHaveBeenCalledTimes(4);
  });

  it("clears all selected users through the toolbar", () => {
    document.body.innerHTML = `
      <form id="bulk-users-form">
        <input type="checkbox" name="user_ids" value="user-1" checked />
        <input type="checkbox" name="user_ids" value="user-2" checked />
      </form>
    `;

    render(
      <AdminUserBulkToolbar
        canManageRoles={false}
        formId="bulk-users-form"
        labels={{
          bulkDisable: "Bulk disable",
          bulkEnable: "Bulk enable",
          bulkRole: "Bulk change role",
          bulkSoftDelete: "Bulk soft delete",
          clearSelection: "Clear selection",
          operatorRole: "Operator",
          ownerRole: "Owner",
          roleTarget: "Target role",
          selectedCount: "{count} selected",
          userRole: "User",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

    const selected = document.querySelectorAll<HTMLInputElement>('input[name="user_ids"]:checked');
    expect(selected).toHaveLength(0);
  });
});

describe("AdminUserSelectAllCheckbox", () => {
  it("toggles every row checkbox in the target form", () => {
    document.body.innerHTML = `
      <form id="bulk-users-form">
        <input type="checkbox" name="user_ids" value="user-1" />
        <input type="checkbox" name="user_ids" value="user-2" />
      </form>
    `;

    render(<AdminUserSelectAllCheckbox formId="bulk-users-form" label="Select all users" />);

    fireEvent.click(screen.getByLabelText("Select all users"));

    const selected = document.querySelectorAll<HTMLInputElement>('input[name="user_ids"]:checked');
    expect(selected).toHaveLength(2);
  });
});

describe("AdminUserDeleteDangerZone", () => {
  it("renders the permanent delete explanation and confirmation field", () => {
    render(
      <AdminUserDeleteDangerZone
        action={vi.fn(async () => {})}
        email="user@example.com"
        labels={{
          confirmation: "Type DELETE or the user email to confirm",
          description: "Permanently deleting a user removes the profile and cannot be undone.",
          hint: "user@example.com",
          submit: "Permanent delete",
          title: "Danger zone",
          warning: "Only use this when the account must be fully erased.",
        }}
        locale="en"
        userId="user-1"
      />,
    );

    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Permanent delete" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
  });
});
