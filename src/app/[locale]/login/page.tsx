import { getTranslations } from "next-intl/server";

export default async function LoginPage() {
  const t = await getTranslations("nav");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold">{t("signIn")}</h1>
      <p className="mt-3 text-sm text-slate-600">
        Sign in with email magic link, Google, GitHub, or Apple to continue.
      </p>
      <div className="mt-8 rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
        Sign-in methods are configured through Supabase Auth.
      </div>
    </main>
  );
}
