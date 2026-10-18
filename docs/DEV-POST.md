# The receipt is a draft, not a decision

Publish this on DEV from a human account for the MLH DEV Writing Challenge. Link the published URL from Devpost if the form allows it. Do not paste an API key or a Gemini project number into the post.

---

Shared expenses still work the old way. One roommate pays for dinner. Everyone else owes them. The app that tracks the debt does not stop the debt from existing.

Split Bill flips the order. A group sets a budget for a period, everyone deposits an equal share, and each person gets a card on that fund. Whoever is at the store pays. Afterward the group agrees on the split. Nobody fronts the bill, and nobody chases a friend.

The interesting part is not the split math. Exact cents are table stakes. The interesting part is making a vision model useful without letting it decide who pays.

## One rules file, two places

The business rules live in one TypeScript module, `domain.ts`. The Expo app uses it for the local demo. A Supabase Edge Function runs the same file for signed-in accounts. Invites, deposits, receipt claims, locks, and settlement all go through it. The server does not trust a balance the phone computed. It replays the call for the signed-in user and writes with compare-and-set, so two people tapping at once cannot overwrite each other.

Realtime is a version ping, not a dump of every group. A member's screen refetches only what that member is allowed to see.

Money in the hackathon build is simulated. Deposits, cards, wallets, and debt recovery are labeled that way in the product. The rules that would approve a real tap are the ones already running.

## Gemini reads the receipt. The charge is the judge.

After a purchase, the payer can photograph the receipt. The photo goes to Gemini (`gemini-3.5-flash-lite` by default) once, after the server has checked that this person is allowed to scan that open charge. The model returns items, tax, and tip as JSON.

Then a boring check runs. If the items, tax, and tip do not add up to the card charge, the receipt becomes one editable line. A client cannot submit its own read. People fix the line by hand, or they split by percent or amount instead.

When the numbers match, the items become a claim board. Each person claims what they had. Someone can suggest that another person shared an item, and only that person can accept the suggestion. Everyone locks their own selection. Tax and tip follow the items. The split settles to the cent, on both phones, without a manual refresh.

We verified this on the deployed function with a synthetic receipt. Demo photos should stay synthetic or redacted. A free Gemini key has quotas, and the unpaid terms are the wrong place for someone else's dinner receipt.

Claude remains a fallback when only that key is set. With neither key, a photo scan returns `scan_off` and the sample receipt is still there for the demo.

## Consent is the amount you saw

A stale screen is a bad place to agree. Accepting an invite sends the deposit amount that was on screen. Accepting a split sends the proposal that was on screen. If the group changed either one, the server rejects the call and the app asks the person to look again. Locking a receipt works the same way: a claim change or an accepted edit unlocks everyone.

Search hides other people's contact details. Opening a group you were invited to does not reveal an email or phone the search results had already masked.

## What we would tell another team

Put the model behind a check you can explain in one sentence. Ours is: the read must equal the charge, or it is not the receipt.

Keep the rules in one file if the demo and the server can share it. The bugs we found were consent and privacy bugs, not rounding bugs, and one module made them fixable overnight.

Say what is simulated. Judges can watch a claim board settle. They should not be asked to believe a browser charged a real card.

The hosted app is https://splitbill-hackathon.vercel.app. On the sign-in screen, Explore the demo needs no account. The code is https://github.com/henryehrnman/Split-Bill.
