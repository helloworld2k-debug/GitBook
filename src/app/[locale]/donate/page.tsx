import { redirect } from "next/navigation";
import { supportedLocales, type Locale } from "@/config/site";

type DonatePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function DonatePage({ params }: DonatePageProps) {
  const { locale } = await params;
  const safeLocale = supportedLocales.includes(locale as Locale) ? locale : "en";

  redirect(`/${safeLocale}/contributions`);
}
