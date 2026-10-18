# chipin — pitch deck: business, competition, market

Slide-ready material to add after the problem/product slides. Research date: October 18, 2026. Figures marked **est.** are our assumptions; everything else is cited in §4. The product rules referenced here are the ones in `schema.txt` and running on the server today.

One line: *A shared fund with a card for everyone: spend together, agree on the split after, and nobody ever fronts the bill or chases a friend for money.*

---

## 1. Business model and projections

### How chipin makes money

| Leg | Mechanism | Rate we assume | Grounding |
|---|---|---|---|
| **Float yield** | Members pre-fund their group (e.g. $300 every 2 weeks). Those balances sit in FBO accounts at a partner bank and are swept into government money-market / T-bill instruments. chipin keeps the yield; members keep $1-for-$1 liquidity. | **3.75% blended** (est.) | 3-month T-bill 4.10% secondary / 4.28% constant-maturity; government money-market funds 3.5–3.9% 7-day yield (Oct 15–18, 2026). PayPal earned ~$1.23B of "interest on customer balances" in 2025 on the same principle. |
| **Interchange** | Every member's chipin Visa charges the group fund. As a prepaid/debit program at a Durbin-exempt sponsor bank, each tap earns interchange from the merchant. | **1.4% gross → 0.9% net** to chipin after sponsor bank + processor share (est.) | Fed Reg II data: exempt dual-message debit averaged 1.41% of transaction value (2024); prepaid 1.54% (2023). Splitwise, Cash App, Venmo and Step all monetize this way. |
| **Fronting** | chipin settles the merchant from pooled funds. Where a member's share takes them below $0, we recover from their personal card (schema 3.iii). Cost is small and bounded; yield on the pool covers it. | 0.10% of spend lost (est.) | A member below $0 cannot pay until recovered (2.iv); a failed recovery suspends them (3.iii); chargebacks freeze the group (4.ii). |
| Upside, not in base case | Pro tier (Splitwise Pro is $3.99/mo), trip/travel add-ons, merchant-funded offers. | — | 5% attach at $3.99/mo ≈ **+$0.96M** in Year 3. |

Why yield matters even though interchange is the bigger line: it is pure margin on money that already has to sit somewhere, it scales with balances rather than headcount, and it lets the base product stay fee-free for members (the #1 complaint about Split/Venmo credit/instant fees).

### Assumptions

| Driver | Year 1 | Year 2 | Year 3 | Basis |
|---|---|---|---|---|
| Avg. monthly active members | 15,000 | 90,000 | 400,000 | est.; viral loop is built in (every charge invites the whole group). splyt reached ~50k MAU; Splitwise 10M MAU. |
| New sign-ups in year | 30,000 | 150,000 | 500,000 | est. |
| Avg. balance held per member | $70 | $85 | $100 | est.; schema example is $100/person/period, topped up every 2 weeks, so mid-period balance ≈ half plus retained surplus. |
| Card spend per member / month | $180 | $220 | $260 | est.; US P2P users move ~$600/mo (eMarketer 2024); shared groceries, dining, subscriptions, trips are a subset. |
| Yield on float | 3.75% | 3.75% | 3.75% | see above |
| Net interchange | 0.90% | 0.90% | 0.90% | see above |

### Three-year model

| $ | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Float under management (avg.) | $1.05M | $7.7M | $40.0M |
| Card spend through chipin | $32M | $238M | $1.25B |
| **Revenue: float yield** | $0.04M | $0.29M | $1.50M |
| **Revenue: net interchange** | $0.29M | $2.14M | $11.23M |
| **Total revenue** | **$0.33M** | **$2.43M** | **$12.7M** |
| Revenue per active member / yr | $22 | $27 | $32 |
| Variable costs (KYC $1.50/sign-up, cards $2/member, ACH top-ups 26×$0.15, losses 0.10% of spend, infra) | $0.20M | $1.11M | $4.76M |
| **Contribution margin** | $0.14M | $1.31M | $7.97M |
| Acquisition ($8/sign-up, referral-led) | $0.24M | $1.20M | $4.00M |
| Sponsor bank / BaaS platform minimums | $0.12M | $0.25M | $0.50M |
| Team (4 → 10 → 22 FTE) | $0.70M | $1.90M | $4.50M |
| **Net** | **−$0.92M** | **−$2.04M** | **−$1.03M** |

Read: contribution-margin positive from Year 1, operating breakeven inside Year 4 on these assumptions, roughly $4M of cumulative burn. A Pro tier or 20% higher spend per member brings Year 3 to breakeven.

### Sensitivity (Year 3)

| If… | Revenue moves |
|---|---|
| Yield 3.00% / 4.25% instead of 3.75% | $1.2M / $1.7M from float (±$0.3M) |
| Net interchange 0.60% / 1.20% instead of 0.90% | $7.5M / $15.0M from cards (±$3.7M) |
| Avg. balance $150 instead of $100 (monthly periods, trip pots) | +$0.75M |
| Spend $200/mo instead of $260 | −$2.6M |

Interchange and spend-per-member drive the outcome; the rate environment is a second-order risk. The thing to prove early is spend concentration: what share of a household's shared spend runs through the chipin card.

### What has to be true

- A sponsor bank and issuer willing to run a consumer prepaid program with pooled, multi-member funds (the risk Braid hit in 2022–23). The rules engine, compare-and-set state, and per-member authorization already exist, which is the hard part of the issuer conversation.
- Pre-funding friction is accepted because it removes the repayment step entirely.

---

## 2. Competitive analysis

### The three ways people split today, and where chipin sits

| Model | Who | What breaks |
|---|---|---|
| **Pay first, chase later** (ledger + P2P) | Splitwise, Venmo Groups, Tricount, Settle Up, Tab, Plates, Revolut Group Bills, Monzo Split, Apple Cash receipt split (iOS 27) | One person still fronts the bill; everyone else owes an IOU; the app's answer to "how do I collect?" is a reminder. |
| **Split at checkout** (shared card, preset ratio) | Cino (EU/UK only), Splita (UK waitlist), Splitwise Card (US, cardholder's own wallet) | Ratio is fixed before anyone knows who ordered what; no itemization; Cino is not available in the US. |
| **Pooled money** | Cash App Pools, PayPal Pools, Zeta (couples), Braid (shut down Sept 2023) | A pot answers "who chipped in", not "who owes whom after six dinners"; one organizer holds the card or the account. |
| **chipin** | — | Standing fund + a card per member + the split is agreed *after* the purchase by the people involved, with exact-cent itemization. |

### Feature matrix

✅ built and running · ◐ partial · ✗ absent

| | chipin | Splitwise (+Card) | Venmo Groups | Cash App Pools | Zelle | Tricount | Settle Up | Tab | Plates | Cino | Braid† | Greenlight / Step | Revolut / Monzo | Apple Cash (iOS 27) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Shared fund everyone funds up front | ✅ | ✗ (personal wallet) | ✗ | ◐ pot, no ledger | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ (pulls at tap) | ✅ | ◐ parent-funded | ✗ | ✗ |
| **A card for every member** that charges the fund | ✅ | ◐ one cardholder's wallet | ✗ | ✗ | ✗ | ◐ bunq card, EU | ✗ | ✗ | ✗ | ✅ (EU/UK) | ✅ | ◐ kids' cards, parent controls | ✗ | ✗ |
| Nobody fronts, nobody repays | ✅ | ✗ | ✗ | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | n/a | ✗ | ✗ |
| Split decided **after** purchase, by those involved | ✅ | ✅ ledger | ✅ ledger | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ preset ratio | ✗ | ✗ | ✅ | ✅ |
| Proposal → every involved member accepts | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Receipt scan → itemized claim board | ✅ (Gemini, checked against the charge) | ◐ Pro only | ✗ | ✗ | ✗ | ✗ | ◐ photo only | ✅ | ✗ manual | ✗ | ✗ | ✗ | ✗ | ✅ one receipt |
| Tax & tip proportional to items, exact cents | ✅ | ◐ manual | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ |
| Equal / % / amount / item splits | ✅ | ✅ | ◐ | ✗ | ✗ | ✅ | ✅ | item | item | ratio | ✗ | ✗ | ✅ | item |
| Recurring budget per period, auto top-up | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ recurring expenses | ✗ | ✗ | ✗ | ◐ | ✅ allowance | ◐ running split | ✗ |
| Guardrails: negative-balance recovery, freeze on dispute/chargeback | ✅ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ limits | ◐ | ✅ | ✗ | ✗ |
| Apple / Google Wallet tap to pay | ✅ (simulated today) | ✅ | ✗ | ✗ | ✗ | ◐ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Available in the US | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **✗** | **✗ closed** | ✅ | ✗ UK/EU | ✅ (fall 2026) |
| Free for members | ✅ | ◐ 4 expenses/day free; Pro $3.99/mo; 1.75% instant | ◐ 3% credit, 1.75% instant | ✅ | ✅ | ✅ | ◐ Premium | ✅ | ✅ | ✅ | — | ✗ $5.99+/mo | ✅ | ✅ |

† Braid raised ~$10M (Index, Accel), passed $10M/month in volume, and shut down in September 2023 after losing its sponsor bank for six months and a forced re-platform. Lesson we built around: own the rules engine and state; keep every partner swappable.

### Where chipin is alone

1. **The only product where every member has a card on one shared fund *and* the split is agreed afterward.** Cino and Splitwise Card put a card in play but fix the split before the receipt exists; ledger apps know who ordered what but somebody still fronted the money.
2. **Agreement is a protocol, not a reminder.** The payer sends the first proposal, only involved members are notified, each must accept the version they actually saw, and a split that stalls 7 days freezes the group. Nobody else has an approval step.
3. **Receipt scans are verified against the card charge** before anyone can claim an item. Splitwise, Settle Up and Apple read receipts; none reconcile them to a payment.
4. **Standing groups, not one-off dinners.** A budget per period with automatic top-ups is built for roommates, couples and teams. The competitors nearest to us in the US (Venmo Groups, Cash App Pools) are built for a trip or a gift.
5. **US gap.** The two live shared-card products are EU/UK; the US has pay-later ledgers and pots.

Honest weaknesses to be ready for: no bank partner yet; members pre-fund; post-purchase agreement can stall (mitigated by the default split and the 7-day freeze); Splitwise and Venmo are already on everyone's phone.

---

## 3. Market size and target audience

### How much money moves

| Layer | Size | What it is |
|---|---|---|
| US mobile P2P transaction value | **$1.7T (2024)**; eMarketer projects ~$2.2T by 2026 | Venmo, Zelle, Cash App etc. Zelle alone moved $1.2T in 2025 (+20%); Venmo ~$325B (+12%); PayPal's Venmo revenue $1.7B. |
| US P2P users | **169.6M (68% of smartphone users)**, ~$7,200 sent per user per year and rising faster than user growth as people repay each other for rent, furniture and trips | eMarketer |
| Bill-splitting app revenue (global) | **$1.26B (2025) → $3.9B (2035)**, 11.8% CAGR; North America 44.6%; group travel the fastest-growing use | Emergen Research |
| US debit + prepaid interchange pool | **$34.1B / yr** (2023); prepaid cards alone $5.2B at 1.54% of value | Federal Reserve |
| Proof the problem is big | Splitwise: 50M registered, 10M MAU, $90B+ split since 2011, profitable. Cash App: 60% of US adults take part in group money pooling. | |

### TAM / SAM / SOM

| | Definition | Size |
|---|---|---|
| **TAM** | US consumer spending that is shared between people who do not share a bank account: the $1.7T P2P flow is the visible reimbursement layer on top of it. | **$1.7T flow / ~$34B interchange pool** |
| **SAM** | Recurring shared spend by US 18–34s in standing groups (households, couples without joint accounts, friend groups) that could run through a group card. est.: 25M people × $2,400/yr of shared groceries, dining, subscriptions, trips | **≈ $60B card spend/yr → ≈ $600M revenue pool** at 0.9% net interchange + float |
| **SOM (Year 3)** | 400k active members, $1.25B spend | **≈ 2% of SAM spend, $12.7M revenue** |

### Who we are building for

| Segment | Size | Why they convert | Entry point |
|---|---|---|---|
| **College students and off-campus roommates** | 16.2M US undergraduates (fall 2025); 1.2M 18–24 householders share with unrelated roommates, >1 in 5 leaseholders in that age group | Highest frequency of small shared charges, lowest tolerance for fronting $200 of groceries, already on Venmo. Every charge invites the whole house. | Campus launch (we are at UW); groceries, utilities, streaming. |
| **Young professionals sharing a household** | 1.6M 25–34 householders share with unrelated roommates (largest house-sharing cohort, 23% of a record 6.8M house-sharing households); 17% of 25–34s live with an unmarried partner | Rent-adjacent recurring costs are where IOU apps create the most chasing; a period budget with auto top-up fits exactly. | Household fund: $300 every 2 weeks. |
| **Friend groups traveling** | Group travel is the fastest-growing bill-splitting use case; Splitwise's core trip use case; Cash App launched Pools (Jul 2025) for this | One pot, everyone has a card, itemized receipts for the big dinners, exact cents on tax and tip. | Trip fund with a one-off period. |
| Later: couples, clubs/teams, creator meetups | 6.8M house-sharing households incl. 1M+ aged 55+; 60% of US adults pool money for something | Same engine, different period. | |

### Why now

- P2P penetration is saturating (user growth 6.7% → 2.9% by 2028) while spend per user keeps rising: the fight moves from "who has the users" to "who owns the shared purchase".
- Incumbents are adding splitting features (Venmo Groups 2023, Cash App Pools 2025, Apple Cash receipt split iOS 27), which validates the behaviour but all of them keep the pay-first model.
- Rates are high enough (3.5–4.3%) that float is a real revenue line, and the rules engine that an issuer needs is already built and tested.

---

## 4. Sources

Rates and interchange
- Federal Reserve H.15, Oct 16 2026: https://www.federalreserve.gov/releases/h15/ (3-mo T-bill 4.10%, 3-mo CMT 4.28%, fed funds 3.88%)
- YieldFinder money-market yields, Oct 18 2026: https://yieldfinder.app/money_markets/ (government funds 3.50–3.89%)
- Fed, 2023 debit interchange fee revenue report: https://www.federalreserve.gov/paymentsystems/files/debitfees_costs_2023.pdf ($34.12B; prepaid 1.54%; exempt avg $0.52/txn)
- Fed, Reg II average interchange by network, 2024: https://www.federalreserve.gov/paymentsystems/regii-average-interchange-fee.htm (exempt dual-message 1.41%)
- PayPal Q4/FY2025 release: https://www.sec.gov/Archives/edgar/data/1633917/000163391726000021/pypl4q-25earningsrelease.htm (transaction margin $15,465M vs $14,235M ex interest on customer balances)

Market
- eMarketer, US mobile P2P transaction value: https://www.emarketer.com/forecasts/5aea2db5a2835f033cca36e1/595fbba30da12d095c7a2b43/ and https://www.emarketer.com/content/p2p-transaction-value-growth-outpaces-user-growth (via https://www.oberlo.com/statistics/us-mobile-payment-market)
- Zelle 2025 results: https://www.zelle.com/press-releases/zelle-posts-20-growth-12-trillion-sent-far-outpacing-consumer-spending-and-cementing
- Venmo 2025: https://finance.yahoo.com/news/paypal-holdings-inc-pypl-q4-190304207.html ; https://paymentsinfull.substack.com/p/venmo-falls-further-behind-zelle
- Cash App: https://www.businessofapps.com/data/cash-app-statistics/ ; Pools launch https://cash.app/press/cash-app-launches-pools-for-group-payments
- Emergen Research, Bill Splitting Apps Market: https://www.emergenresearch.com/industry-report/bill-splitting-apps-market
- Splitwise scale: https://www.linkedin.com/posts/10x-venture-partners_were-proud-to-share-the-progress-of-one-activity-7351700573760413698-WmK_ (10M MAU, $90B split, profitable); 50M registered via Business of Apps
- NAHB / Eye on Housing, house sharing 2023: https://www.nahb.org/blog/2025/05/house-sharing-reaches-all-time-high ; https://eyeonhousing.org/2025/04/house-sharing-is-not-just-for-young-adults/
- Census, families and living arrangements 2025: https://www.census.gov/newsroom/press-releases/2025/families-and-living-arrangements.html ; 2022 profile https://www.census.gov/library/stories/2024/05/living-arrangements.html
- National Student Clearinghouse, Final Fall Enrollment 2025: https://nscresearchcenter.org/final-fall-enrollment-trends/

Competitors
- Splitwise Card and Pay: https://www.splitwise.com/card ; https://www.splitwise.com/pay ; https://www.evenoutapp.com/guides/splitwise-card
- Venmo Groups: https://help.venmo.com/cs/articles/setting-up-a-group-vhel106 ; https://help.venmo.com/cs/articles/managing-expenses-for-venmo-groups-vhel173
- Zelle (no group feature) and fees: https://spliit.pro/blog/venmo-groups-vs-bill-splitting-apps/
- Tricount: https://tricount.com/features ; Settle Up: https://apps.apple.com/us/app/settle-up-group-expenses/id737534985
- Tab, Plates, Splid comparison: https://splittyapp.com/learn/best-bill-splitting-apps/
- Cino availability and model: https://support.getcino.com/hc/en-us/articles/8255257055389-Which-countries-is-Cino-available-in ; https://www.getcino.com/post/splitwise-alternative ; https://techcrunch.com/2025/03/04/cino-has-cracked-bill-splitting-at-the-moment-of-payment-raises-seed
- Braid shutdown: https://techcrunch.com/2023/10/09/consumer-payments-startup-braid-shuts-down-cites-struggles-with-leveraging-third-party-software/ ; https://www.fintechfutures.com/paytech/us-payments-start-up-braid-winds-down-operations
- Greenlight plans and wallet: https://greenlight.com/plans ; Step: https://walletgrower.com/blog/greenlight-vs-gohenry-vs-step-2026
- Monzo Split, Revolut Group Bills, Apple Cash receipt split (iOS 27): https://monzo.com/features/monzo-split ; https://dimesum.com/blog/bank-split-features-compared
- Earlier team research: `competitors.txt` (Oct 17, 2026)
