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
  fingerprint?: (file: File) => string;
  onError?: (error: Error) => void;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  onSuccess?: () => void;
  removeFingerprintOnSuccess?: boolean;
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
  deliveryModeFileHelp: "Upload installers for macOS Apple Silicon, macOS Intel, and Windows.",
  deliveryModeLink: "Use download links",
  deliveryModeLinkHelp: "Provide primary download links for each platform. Backup links are optional.",
  macAppleSiliconBackupUrl: "macOS M chip backup URL",
  macAppleSiliconFile: "macOS M chip installer",
  macAppleSiliconPrimaryUrl: "macOS M chip primary URL",
  macIntelBackupUrl: "macOS Intel backup URL",
  macIntelFile: "macOS Intel installer",
  macIntelPrimaryUrl: "macOS Intel primary URL",
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
      platforms: ["macos_arm64", "macos_x64", "windows"],
      assets: {
        macos_arm64: {
          contentType: "application/octet-stream",
          fileName: "GitBook-arm64.dmg",
          fileSize: 42,
          storagePath: "release-1/macos_arm64/GitBook-arm64.dmg",
        },
        macos_x64: {
          contentType: "application/octet-stream",
          fileName: "GitBook-x64.dmg",
          fileSize: 42,
          storagePath: "release-1/macos_x64/GitBook-x64.dmg",
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

    expect(screen.getByLabelText("macOS M chip installer")).toBeInTheDocument();
    expect(screen.getByLabelText("macOS Intel installer")).toBeInTheDocument();
    expect(screen.getByLabelText("Windows installer")).toBeInTheDocument();
    expect(screen.getByText("Max 50 MB per file. Use download links for larger installers.")).toBeInTheDocument();
    expect(screen.queryByLabelText("macOS M chip primary URL")).not.toBeInTheDocument();
  });

  it("shows only link fields when link mode is selected", () => {
    render(<AdminReleaseDeliveryModeFields labels={labels} locale="en" />);

    fireEvent.click(screen.getByLabelText("Use download links"));

    expect(screen.queryByLabelText("macOS M chip installer")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("macOS Intel installer")).not.toBeInTheDocument();
    expect(screen.getByLabelText("macOS M chip primary URL")).toBeInTheDocument();
    expect(screen.getByLabelText("macOS Intel primary URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Windows backup URL")).toBeInTheDocument();
  });

  it("blocks files larger than 50 MB before starting upload", () => {
    render(<AdminReleaseDeliveryModeFields labels={labels} locale="en" />);

    const oversizedFile = new File(["x"], "TooBig.dmg");
    Object.defineProperty(oversizedFile, "size", { value: 50_000_001 });

    fireEvent.change(screen.getByLabelText("macOS M chip installer"), {
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

    fireEvent.change(screen.getByLabelText("macOS M chip installer"), {
      target: { files: [new File(["mac-arm"], "GitBook-arm64.dmg")] },
    });
    fireEvent.change(screen.getByLabelText("macOS Intel installer"), {
      target: { files: [new File(["mac-intel"], "GitBook-x64.dmg")] },
    });
    fireEvent.change(screen.getByLabelText("Windows installer"), {
      target: { files: [new File(["win"], "GitBook.exe")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create release" }));

    await waitFor(() => expect(uploadMocks.prepareSoftwareReleaseUpload).toHaveBeenCalled());
    expect(uploadMocks.start).toHaveBeenCalledTimes(3);

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

    fireEvent.change(screen.getByLabelText("macOS M chip installer"), {
      target: { files: [new File(["mac-arm"], "GitBook-arm64.dmg")] },
    });
    fireEvent.change(screen.getByLabelText("macOS Intel installer"), {
      target: { files: [new File(["mac-intel"], "GitBook-x64.dmg")] },
    });
    fireEvent.change(screen.getByLabelText("Windows installer"), {
      target: { files: [new File(["win"], "GitBook.exe")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create release" }));

    await waitFor(() => expect(uploadMocks.start).toHaveBeenCalledTimes(3));
    latestUploadOptions[0]?.onSuccess?.();

    await waitFor(() => expect(uploadMocks.finalizeSoftwareReleaseUpload).not.toHaveBeenCalled());
  });

  it("uploads and finalizes only the selected platforms for a partial release", async () => {
    uploadMocks.prepareSoftwareReleaseUpload.mockResolvedValue({
      bucket: "software-releases",
      releaseId: "release-2",
      storageEndpoint: "https://project.storage.supabase.co/storage/v1/upload/resumable",
      platforms: ["macos_arm64", "windows"],
      assets: {
        macos_arm64: {
          contentType: "application/octet-stream",
          fileName: "GitBook-arm64.dmg",
          fileSize: 42,
          storagePath: "release-2/macos_arm64/GitBook-arm64.dmg",
        },
        windows: {
          contentType: "application/octet-stream",
          fileName: "GitBook.exe",
          fileSize: 42,
          storagePath: "release-2/windows/GitBook.exe",
        },
      },
    });

    render(
      <form>
        <input name="version" defaultValue="v1.5.0" />
        <input name="released_at" defaultValue="2026-05-20" />
        <input name="macos_arm64_file" defaultValue="raw-mac-file-should-not-be-submitted" />
        <input name="macos_x64_file" defaultValue="raw-intel-file-should-not-be-submitted" />
        <input name="windows_file" defaultValue="raw-windows-file-should-not-be-submitted" />
        <AdminReleaseDeliveryModeFields labels={labels} locale="en" />
      </form>,
    );

    fireEvent.change(screen.getByLabelText("macOS M chip installer"), {
      target: { files: [new File(["mac-arm"], "GitBook-arm64.dmg")] },
    });
    fireEvent.change(screen.getByLabelText("Windows installer"), {
      target: { files: [new File(["win"], "GitBook.exe")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create release" }));

    await waitFor(() => expect(uploadMocks.start).toHaveBeenCalledTimes(2));
    expect(uploadMocks.prepareSoftwareReleaseUpload).toHaveBeenCalledWith(expect.any(FormData));

    const preparedFormData = uploadMocks.prepareSoftwareReleaseUpload.mock.calls[0]?.[0] as FormData;
    expect(preparedFormData.get("version")).toBe("v1.5.0");
    expect(preparedFormData.get("released_at")).toBe("2026-05-20");
    expect(preparedFormData.get("macos_arm64_file")).toBeNull();
    expect(preparedFormData.get("macos_x64_file")).toBeNull();
    expect(preparedFormData.get("windows_file")).toBeNull();
    expect(preparedFormData.get("macos_arm64_file_name")).toBe("GitBook-arm64.dmg");
    expect(preparedFormData.get("macos_x64_file_name")).toBeNull();
    expect(preparedFormData.get("windows_file_name")).toBe("GitBook.exe");

    act(() => latestUploadOptions[0]?.onSuccess?.());
    await waitFor(() => expect(uploadMocks.finalizeSoftwareReleaseUpload).not.toHaveBeenCalled());

    act(() => latestUploadOptions[1]?.onSuccess?.());
    await waitFor(() => expect(uploadMocks.finalizeSoftwareReleaseUpload).toHaveBeenCalled());

    const finalizeFormData = uploadMocks.finalizeSoftwareReleaseUpload.mock.calls[0]?.[0] as FormData;
    expect(finalizeFormData.get("version")).toBe("v1.5.0");
    expect(finalizeFormData.get("released_at")).toBe("2026-05-20");
    expect(finalizeFormData.get("macos_arm64_file")).toBeNull();
    expect(finalizeFormData.get("macos_x64_file")).toBeNull();
    expect(finalizeFormData.get("windows_file")).toBeNull();
    expect(finalizeFormData.get("macos_arm64_storage_path")).toBe("release-2/macos_arm64/GitBook-arm64.dmg");
    expect(finalizeFormData.get("macos_x64_storage_path")).toBeNull();
    expect(finalizeFormData.get("windows_storage_path")).toBe("release-2/windows/GitBook.exe");
  });

  it("uses release-specific resumable upload fingerprints and clears them after success", async () => {
    render(
      <form>
        <input name="version" defaultValue="v1.4.0" />
        <input name="released_at" defaultValue="2026-05-10" />
        <AdminReleaseDeliveryModeFields labels={labels} locale="en" />
      </form>,
    );

    const file = new File(["mac-arm"], "GitBook-arm64.dmg");
    Object.defineProperty(file, "lastModified", { value: 1770000000000 });

    fireEvent.change(screen.getByLabelText("macOS M chip installer"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create release" }));

    await waitFor(() => expect(uploadMocks.start).toHaveBeenCalledTimes(1));
    expect(latestUploadOptions[0]?.removeFingerprintOnSuccess).toBe(true);
    await expect(latestUploadOptions[0]?.fingerprint?.(file)).resolves.toContain("release-1/macos_arm64/GitBook-arm64.dmg");
  });
});
