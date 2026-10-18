# Judge Q&A cheat sheet

Short, true answers to the questions judges are likely to ask at our table, grouped by track. Every claim here is backed by the code, a test, or `competitors.txt`. Rubrics are in `docs/JUDGING.md`. Keep answers under 20 seconds and offer to show it in the app.

## The 10-second version

"A shared fund with a card for everyone. Each member puts in their share and gets their own card. Anyone pays, then the group agrees on the split afterwards: AI reads the receipt, everyone claims what they had, and it settles to the exact cent. Nobody fronts the bill and nobody chases a friend for money."

## Anyone

**How is this different from Splitwise or Venmo?**
They track debt after one person has paid. We stop the debt from existing: the group's money is already in the fund, every member pays with their own card, and the split is agreed afterwards. There's no repayment step.

**Isn't this just a joint account?**
A joint account lets anyone drain it. We have guardrails: one open charge at a time by default, members who skip their top-up can only spend their own balance, withdrawals are locked while a split is pending, and a split not agreed in 7 days freezes the group.

**Is the money real?**
No. Deposits, cards, wallets and debt recovery are simulated, and the app says so on Home, Card, Activity and Profile. Accounts, shared state, live updates and AI receipt reading are real and running in production.

**What would it take to go live?**
A partner bank for pooled funds and a card issuer for consumer cards (Stripe Issuing consumer programs are invite-only today). The rules engine stays the same: the code that validates a split today would approve a real card tap.

## VISA: Reimagine Shopping

**Where is the generative AI?**
Receipt photos go to Google Gemini (vision), which returns structured JSON: line items, tax and tip. That becomes a claim board where each person taps what they had. It took about 3 seconds in our live test and read every item exactly.

**What if the AI is wrong?**
We never trust it blindly. The server checks that items plus tax plus tip equal the actual card charge. If they don't, Gemini's lines stay as a draft. Nobody can claim until a person saves a version that equals the charge. The payer fixes the pre-filled items; everyone else can review them. A discount folds into the item above it. The AI drafts; it never agrees to a split or moves money for anyone.

**Can someone add a note?**
Any joined member can leave one shared note on a sent charge, up to 280 characters. They edit it in Activity. The split shows it read-only. A note never changes an amount or an approval.

**How does this help commerce?**
For merchants, a group check becomes one card payment instead of splitting at the register. Checkout is faster, the group keeps spending on a card it already has in its wallet, and the post-purchase split no longer costs anyone a favour or a Venmo request.

**Trust and privacy?**
- Each person sees only their own groups; other groups' data never reaches their phone, and live updates carry only a version number.
- Search hides everyone's email and phone unless you typed it exactly. Another member's email and phone stay hidden after that, including once they have joined.
- Consent guards: accepting an invite or a split requires the exact amount or version you reviewed, so a stale screen can't agree to a different number (the server returns 409 and asks you to review again).
- Demo receipt photos are synthetic, as Google's free-tier terms require.

**Why should Visa care?**
It's a new reason for a group to carry and use a card: one shared fund, a card per member, used every week by roommates, couples and trips. Recurring group spend, not a one-off dinner.

## Technical (DubHacks functionality, Gemini, anyone technical)

**What's the stack?**
React Native / Expo app (iOS, Android, web), hosted on Vercel. Supabase: Auth for accounts, Postgres for state, Realtime for live updates, and one Edge Function as the whole backend. Gemini for receipts.

**What's clever about the backend?**
The same TypeScript rules engine (`domain.ts`) runs in the app for the offline demo and on the server for real accounts, so there's one implementation of every rule. The server derives who you are from your login token, never from the request, and filters every response to your groups.

**What about two people acting at once?**
Every write is compare-and-set on a version number, retried up to 6 times; approvals carry the version the person saw, so a race can't sneak through a changed split. Our network tests run two clients against the real server code, including concurrent-write cases.

**How do you know it works?**
- 18/18 live end-to-end check against the deployed server: sign-up, invite with the reviewed amount (and refusal of a stale or old-app acceptance), wallet, purchase, Gemini photo scan, item claims, both lock, settlement with balances correct to the cent.
- Two-account rehearsal on the hosted app with live updates.
- Unit tests for split math and every rule, network tests, server tests.

**Money math?**
All amounts are integer cents. Splits are allocated so they always add up to the charge exactly, for any group size. Tax and tip follow each person's item total.

## SideShift: Best Startup Idea

**How does it spread?**
It's multiplayer by design: creating a group invites 1-3 more people, and every purchase notifies everyone with a share. Each new user arrives through a friend who already uses it. Natural communities: roommates, couples, trips, sports teams, creator meetups and their crews.

**Why now, and why us?**
The closest card products (Cino, Splita) are Europe and UK only, and the main US split app (Split, splitapp.co) lists virtual cards as "not live yet". Its reviews complain about scan accuracy, fees and slow payouts, which our flow removes: scans are checked against the charge and there's no repayment step.

## DubHacks NEXT

**Who's the user?**
People with standing shared costs: roommates and couples first (groceries, utilities, household), then trips and teams.

**Who pays, and for what?**
Revenue from card interchange on group spend (the group spends from our card instead of one person's), plus a premium tier for larger groups, trips and extra features. Users don't pay to repay friends; that step disappears.

**What did you learn and change this weekend?**
- Rebuilt the product around a standing group fund after the schema discussion on Saturday.
- Found and fixed consent bugs: stale approvals, an invite accepted at an old amount, a forming group auto-charging its creator.
- Switched receipt reading to Gemini's free tier when cost mattered, with a check step.
- Ran a security review and fixed a contact-details leak in search.
- Three people coordinated with AI agents over a shared message board, with reviewed handoffs and tests before every merge.

**Will you keep building?**
(Answer honestly as a team.)

## Questions to be ready for

| Question | Short answer |
|---|---|
| What if someone doesn't pay their share? | They can only spend their own balance until they top up; a negative balance is charged to their personal card, and if that fails they're suspended. |
| What if the group can't agree? | After 7 days the split escalates and the group freezes until it's resolved. |
| Can someone take the money and run? | Withdrawals are locked while a split is pending, and spending is limited by the rules above. |
| Is my receipt data private? | It's only visible to your group. For the demo we use synthetic receipts. |
| Why not just use one person's credit card? | That's the problem: one person fronts the money and chases everyone. |
