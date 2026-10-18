# Demo script

For the hackathon presentation on October 18, 2026: a 90-second pitch, then a 3-minute live demo on two phones using the hosted app at https://splitbill-hackathon.vercel.app (shared accounts on the deployed Supabase server). Money, cards and wallets are simulated throughout.

## Before the demo

- Two phones, each with the hosted URL added to the Home Screen (Safari → Share → Add to Home Screen) and signed in to its own account. Phone A is the presenter (pays); Phone B is a second member. Create the accounts ahead of time with **Create account** (email, password, name, handle); note both handles.
- Don't create the group ahead of time. Each run (rehearsals included) starts with a new group so no open charge is left over. The server can't be reset (`DEMO_MODE` is off), so old rehearsal groups simply stay in the accounts; pick the new one.
- Open both phones on Home and check that the "Live updates reconnecting" line isn't showing.
- Have the backup video ready, and a laptop with the same URL open.

## 90-second pitch

1. **Problem (20s).** Shared spending between roommates, partners and friends runs on one person fronting the money and chasing everyone afterwards. Splitting apps track the debt; they don't stop it from piling up.
2. **Product (30s).** Split Bill flips the order. A group sets a budget per period, say $300 every two weeks, and everyone deposits their equal share into a group fund up front. Every member gets their own card on that fund in Apple or Google Wallet. Whoever is at the store just pays.
3. **Agreement (25s).** After each purchase the payer sends the first split: equal, by percent, by amount, or item by item from the receipt. Everyone with a share has to agree before the next purchase, and every cent is allocated. Balances update when the split settles; if someone goes negative, their own card covers it.
4. **AI where it helps (15s).** Snap the receipt and a vision model turns it into items, tax and tip. It only drafts: the read has to add up to the charge, and people still claim and lock in their own items. AI never moves money or agrees for anyone.

## 3-minute demo

| Time | Phone | Do | Say |
|---|---|---|---|
| 0:00 | A | Home → **Create a group**. Name "Roommates", budget 300, **Every 2 weeks**, search Phone B's handle and pick the profile, **Create & send invites**. | "I set the budget and invite by exact handle, email or phone." |
| 0:30 | B | Home shows the invitation with the group details. Tap **Join · deposit $150.00**. | "Each person sees the terms before joining and deposits their equal share." |
| 0:50 | A | **Card** tab → pick **Apple Wallet** (simulated setup). | "Every member has their own card on the shared fund." |
| 1:05 | A | Under "Make a purchase (demo)", tap **Juniper · $154.20** (stands in for tapping the card at a restaurant). | "Dinner just came out of the group fund." |
| 1:15 | A | **Split** tab → **Use sample receipt** (or **Take photo** if the receipt model is on). The claim board appears and is sent to the group. | "The receipt becomes items. Tax and tip follow what each person had." |
| 1:35 | B | Home shows the pending split under the fund. Open **Split**, tap their name on Rigatoni, Branzino and Tiramisu, share the Burrata, **Lock in my items**. | "Phone B updated live. Everyone claims their own items." |
| 2:05 | A | Claim the rest, tap B's name on one item to suggest a change; B approves it. Then **Lock in my items**. | "You can suggest an edit to someone else's items, but only they can approve it." |
| 2:30 | both | The split confirms on its own. Show the balances on Home and the charge on **Activity**. | "Everyone agreed, so it settled. The card is free for the next purchase." |
| 2:45 | A | — | Close with the line below. |

**Closing line:** "Money and cards are simulated tonight by design. Real cards need Stripe Issuing approval, Apple's wallet approval, and a partner bank for pooled funds. The rules engine that would approve real taps is the same code you just watched run on the server."

**Shorter path if time runs low:** after 1:05 skip the receipt. Tap **Send default** on Phone A, then **Accept split** on Phone B; the even split settles straight away.

## If something goes wrong

- **The server is slow or down:** sign out and tap **Explore the demo** on the sign-in screen (or **Try demo mode** on Profile). It runs entirely in the browser with seeded users. Tap the "Demo · Name" badge to switch between people instead of passing phones. In the seed data, Maya's Juniper charge is already pending.
- **Phone B doesn't update:** tap "Live updates reconnecting · Tap to refresh" if it shows; otherwise close and reopen the app, which reloads the group.
- **The photo read doesn't add up:** the receipt becomes a single line to fix by hand. Switch to **Use sample receipt** and keep going.
- **Nothing works:** play the backup video.

## Backup video

Record the 3-minute demo above once, on both phones side by side, against the hosted URL. Keep it on the presenter's laptop and phone, offline.
