import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { resolvePageLocale } from "@/lib/i18n/page-locale";

export async function setupAdminPage(locale: string, path: string) {
  const safeLocale = resolvePageLocale(locale);
  const user = await requireAdmin(safeLocale, path);

  return { locale: safeLocale, user };
}

export async function setupUserPage(locale: string, path: string) {
  const safeLocale = resolvePageLocale(locale);
  const user = await requireUser(safeLocale, path);

  return { locale: safeLocale, user };
}
