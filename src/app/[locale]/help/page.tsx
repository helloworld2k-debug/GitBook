import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { resolvePageLocale } from "@/lib/i18n/page-locale";

export const dynamic = "force-dynamic";

type HelpPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HelpPage({ params }: HelpPageProps) {
  const { locale: localeParam } = await params;
  const locale = resolvePageLocale(localeParam);
  const t = await getTranslations("help");

  const faqs = [
    {
      q: t("faq.download.q"),
      a: t("faq.download.a"),
    },
    {
      q: t("faq.install.q"),
      a: t("faq.install.a"),
    },
    {
      q: t("faq.cloudSync.q"),
      a: t("faq.cloudSync.a"),
    },
    {
      q: t("faq.trialCode.q"),
      a: t("faq.trialCode.a"),
    },
    {
      q: t("faq.certificate.q"),
      a: t("faq.certificate.a"),
    },
  ];

  return (
    <>
      <main className="tech-shell flex-1">
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <p className="inline-flex min-h-8 items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold uppercase text-cyan-200">
            {t("eyebrow")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-white">{t("title")}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">{t("subtitle")}</p>

          <section className="mt-8 glass-panel rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white">{t("gettingStarted.title")}</h2>
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-white">{t("gettingStarted.download.title")}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{t("gettingStarted.download.description")}</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li className="flex gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>{t("gettingStarted.download.step1")}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>{t("gettingStarted.download.step2")}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cyan-400">•</span>
                    <span>{t("gettingStarted.download.step3")}</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-semibold text-white">{t("gettingStarted.install.title")}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{t("gettingStarted.install.description")}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-cyan-300/15 bg-slate-950/60 p-3">
                    <p className="text-sm font-semibold text-white">{t("gettingStarted.install.mac.title")}</p>
                    <p className="mt-1 text-xs text-slate-300">{t("gettingStarted.install.mac.description")}</p>
                  </div>
                  <div className="rounded-md border border-cyan-300/15 bg-slate-950/60 p-3">
                    <p className="text-sm font-semibold text-white">{t("gettingStarted.install.windows.title")}</p>
                    <p className="mt-1 text-xs text-slate-300">{t("gettingStarted.install.windows.description")}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-white">{t("gettingStarted.signin.title")}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{t("gettingStarted.signin.description")}</p>
                <p className="mt-2 text-sm text-slate-300">{t("gettingStarted.signin.note")}</p>
              </div>
            </div>
          </section>

          <section className="mt-8 glass-panel rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white">{t("cloudSync.title")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{t("cloudSync.description")}</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-md border border-cyan-300/15 bg-slate-950/60 p-4">
                <h4 className="text-sm font-semibold text-white">{t("cloudSync.trial.title")}</h4>
                <p className="mt-1 text-xs text-slate-300">{t("cloudSync.trial.description")}</p>
              </div>
              <div className="rounded-md border border-cyan-300/15 bg-slate-950/60 p-4">
                <h4 className="text-sm font-semibold text-white">{t("cloudSync.contributors.title")}</h4>
                <p className="mt-1 text-xs text-slate-300">{t("cloudSync.contributors.description")}</p>
              </div>
            </div>
          </section>

          <section className="mt-8 glass-panel rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white">{t("faq.title")}</h2>
            <dl className="mt-4 space-y-6">
              {faqs.map((item, index) => (
                <div key={index}>
                  <dt className="text-sm font-semibold text-white">{item.q}</dt>
                  <dd className="mt-1 text-sm leading-6 text-slate-300">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-8 glass-panel rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white">{t("contact.title")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{t("contact.description")}</p>
            <Link className="neon-button mt-4 inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-white" href="/support">
              {t("contact.button")}
            </Link>
          </section>
        </section>
      </main>
    </>
  );
}
