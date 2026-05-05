import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminReleaseDeliveryModeFields } from "@/components/admin/admin-release-delivery-mode-fields";

describe("AdminReleaseDeliveryModeFields", () => {
  it("shows only upload fields when file mode is selected", () => {
    render(
      <AdminReleaseDeliveryModeFields
        labels={{
          deliveryMode: "Delivery mode",
          deliveryModeFile: "Upload files",
          deliveryModeFileHelp: "Upload one installer for macOS and one for Windows.",
          deliveryModeLink: "Use download links",
          deliveryModeLinkHelp: "Provide primary download links for both platforms. Backup links are optional.",
          macBackupUrl: "macOS backup URL",
          macFile: "macOS installer",
          macPrimaryUrl: "macOS primary URL",
          windowsBackupUrl: "Windows backup URL",
          windowsFile: "Windows installer",
          windowsPrimaryUrl: "Windows primary URL",
        }}
      />,
    );

    expect(screen.getByLabelText("macOS installer")).toBeInTheDocument();
    expect(screen.getByLabelText("Windows installer")).toBeInTheDocument();
    expect(screen.queryByLabelText("macOS primary URL")).not.toBeInTheDocument();
  });

  it("shows only link fields when link mode is selected", () => {
    render(
      <AdminReleaseDeliveryModeFields
        labels={{
          deliveryMode: "Delivery mode",
          deliveryModeFile: "Upload files",
          deliveryModeFileHelp: "Upload one installer for macOS and one for Windows.",
          deliveryModeLink: "Use download links",
          deliveryModeLinkHelp: "Provide primary download links for both platforms. Backup links are optional.",
          macBackupUrl: "macOS backup URL",
          macFile: "macOS installer",
          macPrimaryUrl: "macOS primary URL",
          windowsBackupUrl: "Windows backup URL",
          windowsFile: "Windows installer",
          windowsPrimaryUrl: "Windows primary URL",
        }}
      />,
    );

    fireEvent.click(screen.getByLabelText("Use download links"));

    expect(screen.queryByLabelText("macOS installer")).not.toBeInTheDocument();
    expect(screen.getByLabelText("macOS primary URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Windows backup URL")).toBeInTheDocument();
  });
});
