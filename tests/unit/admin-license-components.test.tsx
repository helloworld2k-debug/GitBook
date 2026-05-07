import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminLicenseBulkToolbar } from "@/components/admin/admin-license-bulk-toolbar";

const labels = {
  activate: "Activate",
  applyMetadata: "Apply channel",
  channel: "Channel",
  clearSelection: "Clear selection",
  deactivate: "Deactivate",
  delete: "Delete",
  internal: "Internal",
  other: "Other",
  partner: "Partner",
  selectedCount: "{count} selected",
  taobao: "Taobao",
  xianyu: "Xianyu",
};

describe("AdminLicenseBulkToolbar", () => {
  it("submits bulk delete without channel metadata", () => {
    document.body.innerHTML = `
      <form id="bulk-license-form">
        <input name="locale" type="hidden" value="en" />
      </form>
      <input form="bulk-license-form" type="checkbox" name="license_code_ids" value="code-1" checked />
      <input form="bulk-license-form" type="checkbox" name="license_code_ids" value="code-2" checked />
    `;
    const form = document.getElementById("bulk-license-form") as HTMLFormElement;
    const submit = vi.fn((event: SubmitEvent) => event.preventDefault());
    form.addEventListener("submit", submit);

    render(<AdminLicenseBulkToolbar formId="bulk-license-form" labels={labels} />);

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "taobao" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const submittedData = new FormData(form);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submittedData.get("bulk_action")).toBe("delete");
    expect(submittedData.get("channel_type")).toBeNull();
    expect(Array.from(form.querySelectorAll<HTMLInputElement>('input[data-bulk-generated="true"][name="license_code_ids"]')).map((input) => input.value)).toEqual(["code-1", "code-2"]);
  });

  it("submits channel metadata only for the metadata action", () => {
    document.body.innerHTML = `
      <form id="bulk-license-form">
        <input name="locale" type="hidden" value="en" />
      </form>
      <input form="bulk-license-form" type="checkbox" name="license_code_ids" value="code-1" checked />
    `;
    const form = document.getElementById("bulk-license-form") as HTMLFormElement;
    form.addEventListener("submit", (event) => event.preventDefault());

    render(<AdminLicenseBulkToolbar formId="bulk-license-form" labels={labels} />);

    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "xianyu" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply channel" }));

    const submittedData = new FormData(form);
    expect(submittedData.get("bulk_action")).toBe("metadata");
    expect(submittedData.get("channel_type")).toBe("xianyu");
    expect(form.querySelector<HTMLInputElement>('input[data-bulk-generated="true"][name="license_code_ids"]')?.value).toBe("code-1");
  });
});
