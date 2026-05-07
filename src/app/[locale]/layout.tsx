import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default async function LocaleLayout({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider messages={null}>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        {children}
        <SiteFooter />
      </div>
    </NextIntlClientProvider>
  );
}
