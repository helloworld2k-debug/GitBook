import { notFound } from "next/navigation";
import { supportedLocales } from "@/config/site";

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export default function VersionsPage() {
  notFound();
}
