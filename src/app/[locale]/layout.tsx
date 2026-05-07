import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { LocaleChrome } from "@/components/locale-chrome";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default async function LocaleLayout({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider messages={null}>
      <LocaleChrome footer={<SiteFooter />} header={<SiteHeader />}>
        {children}
      </LocaleChrome>
    </NextIntlClientProvider>
  );
}
