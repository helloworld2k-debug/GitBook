# Navigation, Footer, and Feedback Updates Design

## Requirements

- Hide the public website header and footer on admin routes so the admin console does not show duplicate public navigation.
- Replace legacy Stripe-facing payment labels with service-neutral legacy-provider wording across supported locales.
- Show an operator-visible marker on the admin Feedback navigation item when open feedback threads need follow-up.
- Rename the public navigation `Download` item to `Home` in every locale.
- Remove the homepage Related content section from rendered UI.
- Remove footer navigation links and redesign the footer as non-clickable product/support context.
- Keep English, Traditional Chinese, Japanese, and Korean translations aligned with the UI changes.

## Design Notes

- Admin feedback does not currently have a dedicated per-admin unread-read table. The marker uses the existing `support_feedback.status = open` definition, which matches the dashboard pending feedback metric and avoids schema churn.
- Admin route chrome hiding is handled at locale layout level so every `/[locale]/admin/*` page benefits from the same rule.
- Footer links were removed entirely; the footer now presents brand context, support availability, platform coverage, and copyright.
- Download CTA labels remain unchanged because they describe actual platform downloads, not the top navigation item.

