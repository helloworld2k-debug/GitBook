import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import Home from "../page";
import { type Locale, supportedLocales } from "@/config/site";

type LocalizedPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export default async function LocalizedHome({ params }: LocalizedPageProps) {
  const { locale } = await params;

  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return <Home />;
}
