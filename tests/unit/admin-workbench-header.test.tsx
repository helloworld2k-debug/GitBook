import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminWorkbenchHeader } from "@/components/admin/admin-workbench-header";

describe("AdminWorkbenchHeader", () => {
  it("renders title, result summary, primary action, secondary actions, filters, and selection toolbar in stable regions", () => {
    render(
      <AdminWorkbenchHeader
        description="Manage accounts and access."
        filters={
          <form aria-label="User filters">
            <input aria-label="Search users" />
          </form>
        }
        primaryAction={<button type="button">Create user</button>}
        resultSummary="24 of 120 users"
        secondaryActions={<button type="button">Export</button>}
        selectionToolbar={<div aria-label="Bulk user actions" role="toolbar">Bulk actions</div>}
        title="Users"
      />,
    );

    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByText("Manage accounts and access.")).toBeInTheDocument();
    expect(screen.getByText("24 of 120 users")).toBeInTheDocument();

    const actions = screen.getByRole("group", { name: "Workbench actions" });
    expect(within(actions).getByRole("button", { name: "Create user" })).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: "Export" })).toBeInTheDocument();

    expect(screen.getByRole("form", { name: "User filters" })).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Bulk user actions" })).toBeInTheDocument();
  });

  it("omits optional regions when they are not provided", () => {
    render(<AdminWorkbenchHeader resultSummary="8 threads" title="Feedback" />);

    expect(screen.getByRole("heading", { name: "Feedback" })).toBeInTheDocument();
    expect(screen.getByText("8 threads")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Workbench actions" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin-workbench-filters")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin-workbench-selection-toolbar")).not.toBeInTheDocument();
  });
});
