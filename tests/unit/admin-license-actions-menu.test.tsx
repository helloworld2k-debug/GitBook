import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminLicenseActionsMenu } from "@/components/admin/admin-license-actions-menu";

const labels = {
  action: "Action",
  activate: "Activate",
  active: "Active",
  channel: "Channel",
  close: "Close",
  code: "Code",
  confirmDeleteHelp: "Click again to confirm this action.",
  copied: "Copied",
  copy: "Copy code",
  deactivate: "Deactivate",
  deleteCode: "Delete code",
  deleteCodeConfirm: "Delete this license code?",
  duration: "Duration",
  editCode: "Edit code",
  hide: "Hide",
  inactive: "Inactive",
  redemptions: "Redemptions",
  reveal: "Reveal",
  revealError: "Unable to reveal this code.",
  save: "Save",
  trialDays: "Trial days",
};

const channels = {
  internal: "Internal",
  other: "Other",
  partner: "Partner",
  taobao: "Taobao",
  xianyu: "Xianyu",
};

describe("AdminLicenseActionsMenu", () => {
  it("renders the row action menu outside clipping table containers", () => {
    render(
      <div data-testid="clipping-table-shell" className="max-w-40 overflow-hidden">
        <AdminLicenseActionsMenu
          channels={channels}
          code={{
            batchId: "batch-1",
            channelType: "taobao",
            codeMask: "1MAB-****-****-MNOP",
            deletedAt: null,
            durationKind: "month_1",
            durationLabel: "1 month",
            id: "license-code-1",
            isActive: true,
            label: "Taobao May monthly",
            maxRedemptions: 1,
            redemptionCount: 0,
            trialDays: 30,
          }}
          labels={labels}
          locale="en"
        />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Action" }));

    const clippingShell = screen.getByTestId("clipping-table-shell");
    const menu = screen.getByRole("menu");

    expect(clippingShell).not.toContainElement(menu);
  });

  it("opens a row action menu and submits delete only after confirmation", () => {
    render(
      <AdminLicenseActionsMenu
        channels={channels}
        code={{
          batchId: "batch-1",
          channelType: "taobao",
          codeMask: "1MAB-****-****-MNOP",
          deletedAt: null,
          durationKind: "month_1",
          durationLabel: "1 month",
          id: "license-code-1",
          isActive: true,
          label: "Taobao May monthly",
          maxRedemptions: 1,
          redemptionCount: 0,
          trialDays: 30,
        }}
        labels={labels}
        locale="en"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    const menu = screen.getByRole("menu");

    expect(within(menu).getByRole("button", { name: "Reveal" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Edit code" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete code" }));

    expect(screen.getByText("Click again to confirm this action.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete this license code?" }));

    const deleteForm = screen.getByTestId("license-code-delete-form");
    expect(deleteForm).toHaveFormValues({
      locale: "en",
      trial_code_id: "license-code-1",
    });
  });

  it("opens the edit drawer with paid duration locked and trial duration editable", () => {
    render(
      <AdminLicenseActionsMenu
        channels={channels}
        code={{
          batchId: "batch-1",
          channelType: "internal",
          codeMask: "T2YQ-****-****-9XU6",
          deletedAt: null,
          durationKind: "trial_3_day",
          durationLabel: "2 days",
          id: "license-code-2",
          isActive: true,
          label: "h test01",
          maxRedemptions: 1,
          redemptionCount: 0,
          trialDays: 2,
        }}
        labels={labels}
        locale="en"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit code" }));

    const dialog = screen.getByRole("dialog", { name: "Edit code" });
    const overlay = dialog.parentElement;

    expect(overlay).not.toBeNull();
    expect(overlay).toHaveClass("fixed", "z-[120]");
    expect(within(dialog).getByDisplayValue("h test01")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Trial days")).not.toBeDisabled();
    expect(within(dialog).getByText("T2YQ-****-****-9XU6")).toBeInTheDocument();
  });

  it("hides status and delete actions for deleted codes", () => {
    render(
      <AdminLicenseActionsMenu
        channels={channels}
        code={{
          batchId: null,
          channelType: "partner",
          codeMask: "1YFL-****-****-UY8R",
          deletedAt: "2026-05-01T00:00:00.000Z",
          durationKind: "year_1",
          durationLabel: "1 year",
          id: "license-code-3",
          isActive: false,
          label: "ryan",
          maxRedemptions: 1,
          redemptionCount: 0,
          trialDays: 365,
        }}
        labels={labels}
        locale="en"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Action" }));

    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete code" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal" })).toBeInTheDocument();
  });
});
