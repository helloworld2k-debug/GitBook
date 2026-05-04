# GitBook AI Contribution Website Design

Date: 2026-04-29

## Summary

GitBook AI is an international software download website with:

- public downloads
- account-based contribution history
- Dodo Payments checkout
- certificate issuance after successful paid contributions
- desktop license and cloud sync account integration
- lightweight admin and support tooling

The website uses contribution/support language in public and operator-facing copy. Downloads remain public. Contributions are voluntary and do not gate basic downloads.

## Product Decisions

- Brand: `GitBook AI`
- Payment provider: `Dodo Payments`
- User-facing terminology: `Contribute`, `Support`, `Contribution`
- Routes: locale-prefixed public pages plus authenticated dashboard and admin surfaces
- Certificates: generated and controlled by backend systems only
- Admin tools: contributions, certificates, releases, licenses, users, support feedback, and audit logs

## Experience Model

- Visitors can download software without signing in.
- Users sign in before making a contribution.
- Successful Dodo payment events create contribution records, certificates, and license entitlement updates.
- Users can review contribution history, certificates, and account status in the dashboard.
- Operators can review contribution records and support workflows in the admin console.

## Notes

- Internal storage may still use legacy `donation*` naming for compatibility.
- Public and operational copy should not reintroduce `donation`, `Donate`, `Three Friends`, `Stripe`, or `PayPal` language.
- This document supersedes the older multi-provider donation-site framing.
