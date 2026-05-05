import { redirect } from "next/navigation";
import { defaultLocale } from "@/config/site";

export default function Home() {
  redirect(`/${defaultLocale}`);
}
