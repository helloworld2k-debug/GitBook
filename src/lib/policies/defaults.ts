export const policyPageSlugs = ["terms", "privacy", "refund"] as const;

export type PolicyPageSlug = (typeof policyPageSlugs)[number];

export type PolicyPageContent = {
  body: string;
  slug: PolicyPageSlug;
  sort_order: number;
  summary: string;
  title: string;
  updated_at?: string | null;
};

export const DEFAULT_POLICY_PAGES: PolicyPageContent[] = [
  {
    body: [
      "GitBook AI helps users download, activate, and use companion desktop software with account-based cloud sync access. By using this website, creating an account, redeeming a license code, or connecting a desktop device, you agree to use the service lawfully and responsibly.",
      "Accounts are personal to the registered user. You are responsible for keeping your login credentials, license codes, and desktop callback settings secure. Do not share, resell, automate, or abuse access in a way that interferes with other users or with partner distribution channels.",
      "License codes may be issued for trials, monthly access, quarterly access, or annual access. Cloud sync availability follows the active entitlement on your account. If you already have valid access, eligible paid license code time may be added after the current period according to the rules shown in the product experience.",
      "Third-party channel partners may distribute license codes under separate commercial arrangements. We may pause, revoke, or investigate codes when fraud, leakage, automated redemption, payment disputes, or other abnormal activity is detected.",
      "The service, downloads, account tools, and support features are provided with reasonable care but without a guarantee of uninterrupted availability. We may update these terms when product capabilities, security controls, or partner requirements change.",
    ].join("\n\n"),
    slug: "terms",
    sort_order: 10,
    summary: "Rules for using GitBook AI downloads, accounts, license codes, desktop authorization, and cloud sync access.",
    title: "Terms of Service",
  },
  {
    body: [
      "We collect the information needed to operate GitBook AI accounts, license redemption, desktop authorization, cloud sync entitlement checks, support requests, and security monitoring. This may include account email, display name, login status, license activity, entitlement dates, device session identifiers, IP address, user agent, and support messages you submit.",
      "Payment and contribution records may include provider references, transaction status, amount, currency, and related operational notes. We do not use public policy pages to request sensitive payment credentials, and payment processing may be handled by third-party providers.",
      "Security logs help us detect abuse such as repeated invalid license attempts, suspicious registration patterns, or leaked channel codes. These logs are used for fraud prevention, service reliability, and admin troubleshooting.",
      "We keep operational records for as long as needed to provide the service, meet accounting or dispute requirements, investigate security incidents, and maintain admin audit history. Access to admin tools is limited to authorized operators.",
      "You may contact support to ask about your account information, cloud sync entitlement status, license redemption records, or support history. We may need to verify account ownership before making changes.",
    ].join("\n\n"),
    slug: "privacy",
    sort_order: 20,
    summary: "How GitBook AI handles account, license, desktop authorization, cloud sync, support, payment, and security data.",
    title: "Privacy Policy",
  },
  {
    body: [
      "GitBook AI may receive contributions, paid license purchases, or partner-issued license code activations. Refund handling depends on the channel, payment provider, and whether the license or cloud sync entitlement has already been used.",
      "For direct website payments, contact support with your account email, transaction reference, purchase time, and a clear description of the issue. We will review duplicate payments, accidental purchases, failed activations, and serious product access problems in good faith.",
      "License codes distributed by third-party channels such as partners or marketplaces may need to be handled through the original seller or channel first. We can still help verify whether a code was redeemed, disabled, or affected by a service issue.",
      "Refunds may be declined when a code has been redeemed and the granted access has been substantially used, when abuse or automated account activity is detected, or when the request conflicts with the terms of the original sales channel.",
      "Approved refunds may revoke or shorten the related cloud sync entitlement. Processing time depends on the payment provider or partner channel.",
    ].join("\n\n"),
    slug: "refund",
    sort_order: 30,
    summary: "How direct payments, partner license codes, activation issues, and cloud sync entitlement refunds are reviewed.",
    title: "Refund Policy",
  },
];

export function isPolicyPageSlug(value: string): value is PolicyPageSlug {
  return policyPageSlugs.includes(value as PolicyPageSlug);
}

export function getDefaultPolicyPage(slug: PolicyPageSlug) {
  return DEFAULT_POLICY_PAGES.find((page) => page.slug === slug) ?? DEFAULT_POLICY_PAGES[0];
}
