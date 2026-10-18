# chipin — first submission

Paste-ready copy for the project application. Money, deposits, wallets, cards, and debt recovery are simulated. There is no real wallet provisioning and no in-store payment.

## 1. Short elevator pitch

A shared fund and a card for everyone in the group, so nobody fronts the bill.

Gemini turns that card payment into a claim board: it reads the receipt, the server checks the read against the charge, and the people who were there agree before anyone's balance moves.

## 2. About the project

### Inspiration

Shared spending between roommates, partners, and friends still works the old way: one person pays, then chases everyone else. Expense apps track the debt. They do not stop it from piling up. The closest shared-card products set the split at the register, or they are not available here. We wanted a standing group fund: everyone puts their share in first, anyone can pay, and the people who were there agree on the split afterward.

### What it does

A group sets a budget for a period, such as $300 every two weeks, and invites people by handle, email, or phone. Each person sees the terms and joins by depositing an equal share. Every member gets a card on that fund. Whoever is at the store pays from the fund.

After the purchase, the payer sends the first split: equal, by percent, by amount, or item by item. A receipt photo becomes line items, tax, and tip. Each person claims what they had, can suggest a change to someone else's items, and locks in their own selection. The split settles only when every item is claimed, everyone who claimed has locked, and no edit is pending. Tax and tip follow each person's items, and every cent is allocated.

An approved budget change takes effect at the next period, whether it is a raise or a cut. If a split is not agreed within 7 days, the group freezes. Balances, activity, and the next period's funding stay visible to the members. Any joined member can leave one shared note on a sent charge, up to 280 characters. It is edited in Activity and shown on the split. A note never changes an amount or an approval.

Payments are simulated. The rules that would approve a real tap are the ones running on the server.

### How we built it

chipin is a shared group fund with a virtual card per member. Three people and their AI agents built it for this hackathon. The app is React Native and Expo, so the same screens run on iOS, Android, and the web. The hosted app is https://splitbill-hackathon.vercel.app.

The backend is Supabase. Auth handles accounts. One Postgres row holds the app state, and writes use compare-and-set. A single Edge Function runs the same TypeScript rules the app uses offline (`domain.ts`), so every invite, split, refill, and settlement is checked on the server for the signed-in caller. Realtime pings refresh every member's screen without sending other groups' data.

Receipt photos go to a Gemini vision model. The read becomes the claim board only when the items, tax, and tip equal the charge. If they don't, Gemini's lines stay as a draft nobody can claim, and the board opens only after a person saves a read that matches. Accepting an invite or a split requires the amount or version the person actually reviewed, so a stale screen cannot agree to a different number.

### Challenges we ran into

A receipt scan that is almost right is worse than a blank one. If the items do not add up to the card charge, they stay a draft nobody can claim until a person saves a match. People still claim their own lines. The model drafts. It never moves money or agrees for anyone.

Agreement has to match what each person saw. An invite accepted at an old amount, or a split accepted after the proposal changed, is rejected. The member refreshes and reviews again.

Pooled consumer money needs a partner bank and a card issuer. We did not pretend to have those. Deposits, cards, wallets, and debt recovery are simulated, and the screen says so. The rules engine is the part that would stay when the money becomes real.

The hosted web build also had to serve its own fonts and icons. Until that was fixed, the app fell back to a default typeface.

### Accomplishments that we're proud of

The same rules run in the demo and on the server. Two signed-in browsers completed a hosted claim board: separate claims, a suggested edit, both people locking in, and a live settle. A synthetic receipt was read live with Gemini, and the items, tax, and tip matched the charge. A later check on the deployed server passed signup, invite, purchase, photo scan, claims, locks, and settlement. The hosted app is up, including the sign-in screen, the fund, the split, and the claim board.

### What we learned

The hard part is not splitting a number. It is getting the right people to agree, on the right amount, after the purchase. Exact cents and a claim board matter more than another IOU.

A vision model is useful only with a check. If the read does not match the charge, the group should fix it by hand instead of trusting it.

We also learned to say the simulation out loud. Judges can watch the rules run. They should not be asked to believe a browser charged a real card.

### What's next for Split Bill

A partner bank and a card issuer, then real Apple Wallet and Google Wallet provisioning, so a tap at the store is the same flow the demo already runs. A recorded two-phone walkthrough of the hosted app. Standing groups for groceries, household bills, and trips, with the period budget already in the product.

## Tracks

- Title: VISA: Reimagine Shopping
- Sponsored side: SideShift Best Startup Idea
- Non-sponsored: DubHacks NEXT, MLH Best Use of Gemini API, MLH DEV Writing Challenge

Put the Gemini Project Number in the Devpost field. It is a number, not the project ID, and it is never the API key. Rubrics and the video shot list are in `docs/JUDGING.md`.

## 3. Built with

React Native, Expo, TypeScript, Supabase, PostgreSQL, Google Gemini, Vercel

## 4. Try it out

- App: https://splitbill-hackathon.vercel.app
- Code: https://github.com/henryehrnman/Split-Bill

On the sign-in screen, choose **Explore the demo**. No account is required. Payments are simulated.

## 5. Image gallery

PNG, each under 200 KB. They are 390-point phone frames from the current build, not a 3:2 crop. Upload these seven:

| File | What it shows |
|---|---|
| `docs/screenshots/0-sign-in.png` | Hosted sign-in |
| `docs/screenshots/1-home.png` | Group fund and a pending split |
| `docs/screenshots/2-split-percent.png` | Your share, and who has accepted |
| `docs/screenshots/3-split-receipt-claims.png` | Receipt claim board |
| `docs/screenshots/4-card.png` | Member card |
| `docs/screenshots/5-activity.png` | Spend and settled charges |
| `docs/screenshots/6-new-group.png` | Budget, period, and invites |

Raw links: https://github.com/henryehrnman/Split-Bill/tree/main/docs/screenshots

Frames 1 through 6 are the in-browser demo, shown as Demo · Henry.

## 6. Video demo link

https://youtu.be/Mg6M-th_mH4

Put that link in the Devpost video field. VISA is judged from the video. The shot list is in `docs/JUDGING.md`.
