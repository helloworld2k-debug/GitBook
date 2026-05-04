type FormStatusBannerProps = {
  message: string;
  tone?: "error" | "notice" | "warning";
};

export function FormStatusBanner({ message, tone = "notice" }: FormStatusBannerProps) {
  const toneClass = {
    error: "border-red-300/30 bg-red-400/10 text-red-100",
    notice: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    warning: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  }[tone];

  return (
    <p
      className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
