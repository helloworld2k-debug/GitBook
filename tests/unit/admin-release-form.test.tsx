import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminReleaseDeliveryModeFields } from "@/components/admin/admin-release-delivery-mode-fields";

const uploadMocks = vi.hoisted(() => ({
  finalizeSoftwareReleaseUpload: vi.fn(),
  prepareSoftwareReleaseUpload: vi.fn(),
  start: vi.fn(),
  abort: vi.fn(),
  findPreviousUploads: vi.fn(async () => []),
  getSession: vi.fn(async () => ({ data: { session: { access_token: "token-1" } } })),
  resumeFromPreviousUpload: vi.fn(),
}));

const latestUploadOptions: {
  onError?: (error: Error) => void;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  onSuccess?: () => void;
}[] = [];

vi.mock("@/app/[locale]/admin/actions/releases", () => ({
  finalizeSoftwareReleaseUpload: uploadMocks.finalizeSoftwareReleaseUpload,
  prepareSoftwareReleaseUpload: uploadMocks.prepareSoftwareReleaseUpload,
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: uploadMocks.getSession,
    },
  }),
}));

vi.mock("tus-js-client", () => ({
  Upload: vi.fn().mockImplementation(function (_file: File, options: (typeof latestUploadOptions)[number]) {
    latestUploadOptions.push(options);
    return {
      abort: uploadMocks.abort,
      findPreviousUploads: uploadMocks.findPreviousUploads,
      resumeFromPreviousUpload: uploadMocks.resumeFromPreviousUpload,
      start: uploadMocks.start,
    };
  }),
}));

const labels = {
  deliveryMode: "Delivery mode",
  deliveryModeFile: "Upload files",
  deliveryModeFileHelp: "Upload one installer for macOS and one for Windows.",
  deliveryModeLink: "Use download links",
  deliveryModeLinkHelp: "Provide primary download links for both platforms. Backup links are optional.",
  macBackupUrl: "macOS backup URL",
  macFile: "macOS installer",
  macPrimaryUrl: "macOS primary URL",
  maxFileSizeHelp: "Max 50 MB per file. Use download links for larger installers.",
  pauseUpload: "Pause",
  retryUpload: "Retry",
  resumeUpload: "Resume",
  uploadComplete: "Complete",
  uploadFailed: "Upload failed",
  uploadIdle: "Ready",
  uploadLimitError: "Installer files must be 50 MB or smaller. Use download links for larger installers.",
  uploadProgress: "Upload progress",
  uploadUploading: "Uploading",
  windowsBackupUrl: "Windows backup URL",
  windowsFile: "Windows installer",
  windowsPrimaryUrl: "Windows primary URL",
};

describe("AdminReleaseDeliveryModeFields", () => {
  beforeEach(() => {
    latestUploadOptions.length = 0;
    Object.values(uploadMocks).forEach((mock) => {
      if (typeof mock === "function" && "mockReset" in mock) {
        mock.mockReset();
      }
    });
    uploadMocks.findPreviousUploads.mockResolvedValue([]);
    uploadMocks.getSession.mockResolvedValue({ data: { session: { access_token: "token-1" } } });
    uploadMocks.prepareSoftwareReleaseUpload.mockResolvedValue({
      bucket: "software-releases",
      releaseId: "release-1",
      storageEndpoint: "https://project.storage.supabase.co/storage/v1/upload/resumable",
      assets: {
        macos: {
          contentType: "application/octet-stream",
          fileName: "GitBook.dmg",
          fileSize: 42,
          storagePath: "release-1/macos/GitBook.dmg",
        },
        windows: {
          contentType: "application/octet-stream",
          fileName: "GitBook.exe",
          fileSize: 42,
          storagePath: "release-1/windows/GitBook.exe",
        },
      },
    });
    uploadMocks.finalizeSoftwareReleaseUpload.mockResolvedValue(undefined);
  });

  it("shows only upload fields when file mode is selected", () => {
    render(<AdminReleaseDeliveryModeFields labels={labels} locale="en" />);

    expect(screen.getByLabelText("macOS installer")).toBeInTheDocument();
    expect(screen.getByLabelText("Windows installer")).toBeInTheDocument();
    expect(screen.getByText("Max 50 MB per file. Use download links for larger installers.")).toBeInTheDocument();
    expect(screen.queryByLabelText("macOS primary URL")).not.toBeInTheDocument();
  });

  it("shows only link fields when link mode is selected", () => {
    render(<AdminReleaseDeliveryModeFields labels={labels} locale="en" />);

    fireEvent.click(screen.getByLabelText("Use download links"));

    expect(screen.queryByLabelText("macOS installer")).not.toBeInTheDocument();
    expect(screen.getByLabelText("macOS primary URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Windows backup URL")).toBeInTheDocument();
  });

  it("blocks files larger than 50 MB before starting upload", () => {
    render(<AdminReleaseDeliveryModeFields labels={labels} locale="en" />);

    const oversizedFile = new File(["x"], "TooBig.dmg");
    Object.defineProperty(oversizedFile, "size", { value: 50_000_001 });

    fireEvent.change(screen.getByLabelText("macOS installer"), {
      target: { files: [oversizedFile] },
    });

    expect(screen.getByText(/Installer files must be 50 MB or smaller/)).toBeInTheDocument();
    expect(uploadMocks.prepareSoftwareReleaseUpload).not.toHaveBeenCalled();
  });

  it("starts resumable uploads, shows progress, and exposes pause and resume controls", async () => {
    render(
      <form>
        <input name="version" defaultValue="v1.4.0" />
        <input name="released_at" defaultValue="2026-05-10" />
        <AdminReleaseDeliveryModeFields labels={labels} locale="en" />
      </form>,
    );

    fireEvent.change(screen.getByLabelText("macOS installer"), {
      target: { files: [new File(["mac"], "GitBook.dmg")] },
    });
    fireEvent.change(screen.getByLabelText("Windows installer"), {
      target: { files: [new File(["win"], "GitBook.exe")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create release" }));

    await waitFor(() => expect(uploadMocks.prepareSoftwareReleaseUpload).toHaveBeenCalled());
    expect(uploadMocks.start).toHaveBeenCalledTimes(2);

    act(() => {
      latestUploadOptions[0]?.onProgress?.(25, 100);
    });
    expect(await screen.findByText(/25%/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Pause" })[0]);
    expect(uploadMocks.abort).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  it("finalizes only after both platform uploads complete", async () => {
    render(
      <form>
        <input name="version" defaultValue="v1.4.0" />
        <input name="released_at" defaultValue="2026-05-10" />
        <AdminReleaseDeliveryModeFields labels={labels} locale="en" />
      </form>,
    );

    fireEvent.change(screen.getByLabelText("macOS installer"), {
      target: { files: [new File(["mac"], "GitBook.dmg")] },
    });
    fireEvent.change(screen.getByLabelText("Windows installer"), {
      target: { files: [new File(["win"], "GitBook.exe")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create release" }));

    await waitFor(() => expect(uploadMocks.start).toHaveBeenCalledTimes(2));
    latestUploadOptions[0]?.onSuccess?.();

    await waitFor(() => expect(uploadMocks.finalizeSoftwareReleaseUpload).not.toHaveBeenCalled());
  });
});
