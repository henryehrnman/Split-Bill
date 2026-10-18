# The receipt is a draft, not a decision

Publish this on DEV from a human account for the MLH DEV Writing Challenge. Link the published URL from Devpost if the form allows it. Do not paste an API key or a Gemini project number into the post. Title alternative that leads with the agent story: "Five AI agents, one repo, one night: building chipin".

---

Shared expenses still work the old way. One roommate pays for dinner. Everyone else owes them. The app that tracks the debt does not stop the debt from existing.

chipin flips the order. A group sets a budget for a period, and each person gets their own card on one shared fund. When the last invite is answered, everyone's share is collected, never more than the amount each person approved when they joined. Whoever is at the store pays from the fund. Afterward the group agrees on the split. Nobody fronts the bill, and nobody chases a friend.

The interesting part is not the split math. Exact cents are table stakes. The interesting part is making a vision model useful without letting it decide who pays.

## One rules file, two places

The business rules live in one TypeScript module, `domain.ts`. The Expo app uses it for the local demo. A Supabase Edge Function runs the same file for signed-in accounts. Invites, deposits, receipt claims, locks, and settlement all go through it. The server does not trust a balance the phone computed. It replays the call for the signed-in user and writes with compare-and-set, so two people tapping at once cannot overwrite each other.

Realtime is a version ping, not a dump of every group. A member's screen refetches only what that member is allowed to see.

Money in the hackathon build is simulated. Deposits, cards, wallets, and debt recovery are labeled that way in the product. The rules that would approve a real tap are the ones already running.

## Gemini reads the receipt. The charge is the judge.

After a purchase, the payer can photograph the receipt. The photo goes to Gemini (`gemini-3.5-flash-lite` by default) once, after the server has checked that this person is allowed to scan that open charge. The model returns items, tax, and tip as JSON.

Then a boring check runs. If the items, tax, and tip do not add up to the card charge, Gemini's lines stay a draft. Nobody can claim them, and the server enforces that, not just the screen. The payer corrects the pre-filled list, and the save has to equal the charge before anyone can pick their items. A discount folds into the item above it. A client cannot submit its own read.

When the numbers match, each person picks the items they had and confirms. Tax and tip follow the items. The split settles to the cent, in both browsers, without a manual refresh.

We verified this on the deployed function with a synthetic receipt. A live check on that server passes 18 of 18 steps: signup, invite, a purchase, the photo scan, claims, locks, and settlement. Demo photos should stay synthetic or redacted. A free Gemini key has quotas, and its unpaid terms are the wrong place for someone else's dinner receipt.

## Consent is the amount you saw

A stale screen is a bad place to agree. Joining a group sends the contribution amount that was on screen, and nobody is charged more than they approved. Accepting a split sends the proposal that was on screen. If the group changed either one, the server rejects the call and the app asks the person to look again.

Search hides other people's contact details. Joining a group does not reveal an email or phone the search results had already masked.

## Five agents, three laptops, one message board

Three of us built chipin overnight, each with our own AI coding agents: two Claude Opus agents, two GPT agents, and a Grok agent in Cursor, plus a read-only helper for part of the night. They worked in parallel on the same repo. What kept them from wrecking each other was Devtalk, a small coordination hub one of us ran on a laptop that every agent connected to.

Devtalk has a few rules, and they did most of the work:

- **Join, then wait.** Each agent joins with its model and machine name and a stated goal. A human approves it on the host page before it can do anything. When the host removed a session, that agent had to ask to rejoin.
- **Claim before you edit.** An agent reserves the exact files it will touch. If another agent already claimed them, or has unpublished changes to them, the claim is refused. That refusal is the feature: we never had two agents rewriting the same file.
- **One integrator.** Agents push to their own branches and post a handoff with the commit and paths. One agent merges to main, runs the full test suite, deploys the server, and posts the result.
- **Messages are requests, not orders.** The board is for questions, handoffs, and blockers. When a message on the board asked an agent to email someone outside the team, the agents refused and left it to a human. Instructions come from the person you work for.

It caught real bugs. One agent, auditing another's work, showed that an uncorrected receipt draft could still be claimed by calling the server directly, because only the screen hid it. The server owner added the guard and deployed it within the hour. A review of a new funding rule found that a member could have been charged more than the amount they approved; the fix landed on the same branch before it shipped. Docs went through the same loop. One agent wrote them, another fact-checked them against the live server, and wrong claims were corrected before judges saw them.

It also had friction. Claims compare each agent against its last published commit, so an idle agent whose checkpoint was stale could block everyone from a file it no longer cared about. More than once the fix was a human telling a sleeping agent to "checkpoint." If you build something like this, make stale reservations expire on their own.

## What we would tell another team

Put the model behind a check you can explain in one sentence. Ours is: the read must equal the charge, or it is not the receipt.

Keep the rules in one file if the demo and the server can share it. The bugs we found were consent and privacy bugs, not rounding bugs, and one module made them fixable overnight.

If you run several agents, give them a referee. File claims, one integrator, and handoffs in writing turned five fast agents into one team instead of five merge conflicts.

Say what is simulated. Judges can watch a claim board settle. They should not be asked to believe a browser charged a real card.

The hosted app is https://splitbill-hackathon.vercel.app, and the code is https://github.com/henryehrnman/Split-Bill.
