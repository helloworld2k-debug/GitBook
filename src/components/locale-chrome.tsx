"use client";

import { usePathname } from "next/navigation";

type LocaleChromeProps = {
  children: React.ReactNode;
  footer: React.ReactNode;
  header: React.ReactNode;
};

function isAdminPath(pathname: string | null) {
  const segments = (pathname ?? "").split("/").filter(Boolean);

  return segments[1] === "admin";
}

export function LocaleChrome({ children, footer, header }: LocaleChromeProps) {
  const hidePublicChrome = isAdminPath(usePathname());

  return (
    <div className="flex min-h-dvh flex-col">
      {hidePublicChrome ? null : header}
      {children}
      {hidePublicChrome ? null : footer}
    </div>
  );
}
