import { redirect } from "next/navigation";
import { getActionLocale } from "@/lib/i18n/action-locale";

type DonatePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function DonatePage({ params }: DonatePageProps) {
  const { locale } = await params;
  const safeLocale = getActionLocale(locale);

  redirect(`/${safeLocale}/contributions`);
}
