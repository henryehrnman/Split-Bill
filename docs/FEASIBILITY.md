# Group checkout decision memo
Checked October 15, 2026, Pacific. First-party claims, not independent product testing. No Split Bill provider approval or partnership exists.

## Verified facts
Cino QuickSplit advertises guest link/QR contributions with Apple/Google Pay and a virtual checkout card. Its current page lists €0.20 per transaction capped at €5 monthly, QuickSplit included. Older indexed copy showed sterling pricing: verify local terms before quoting UK fees. Its footer identifies Checkout SAS as debit-card issuer. No-app invitations and group-card checkout are competitive overlap.
https://www.getcino.com/quicksplit

Cino's support article (updated May 27, 2025) lists UK plus 29 European countries, not US. Homepage broadly agrees; QuickSplit's marketing counter says 33 countries. Exact count is inconsistent. US eligibility is not established. This suggests a positioning question, not verified demand or launch permission.
https://support.getcino.com/hc/en-us/articles/8255257055389-Which-countries-is-Cino-available-in
https://www.getcino.com/

Stripe checks Issuing balance/card controls before real-time authorization, whose decision window is two seconds. Approval reserves funds; capture creates a transaction; reversals/expiry release holds. Thus prepare contributions before merchant checkout, rather than collecting from participants during the authorization callback. Authorization is not final settlement, and this does not establish how consumer contributions fund a program.
https://docs.stripe.com/issuing/purchases/authorizations

Stripe wallet tokens require approved live cards, not sandbox cards. iOS push provisioning needs Apple's payment-pass entitlement. Android needs issuer onboarding, private SDK/API access and app allowlisting. Manual access precedes push access; backend short-lived keys and card/device eligibility checks are required. Issuer provisioning differs from merchant Apple Pay acceptance.
https://docs.stripe.com/issuing/cards/digital-wallets?platform=react-native

## Recommended architecture: hypothesis
Keep native simulation. Next: item assignments, exact tax/tip and versioned proposal; each person sees their total before approval. Material edits revoke approvals/card. Add validated local recovery/receipts, then authenticated membership and server-owned versions. Model funding readiness, authorization and capture separately in the future adapter. Live adapter stays disabled.

## Unresolved questions
- Eligible country/program, accountable cardholder and authorized spender? Separate from personal cards does not mean ownerless credit.
- Who carries failed/returned funding, liquidity, disputes, fees and refunds? Do not assume atomic multi-person collection.
- How are restaurant-tip changes and forced/late captures reconciled against consent caps?
- Does Cino offer item/shared-item allocation and immutable approval? Reviewed pages do not establish absence; no exclusivity claim.
- Does item-level consent motivate switching? Needs recruited user tests.

Research stop: enough evidence for next build. Repeat research only when a concrete decision needs it.
