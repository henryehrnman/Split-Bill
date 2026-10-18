# DubHacks '26 judging: what we must do to win

Source: the official DubHacks '26 Hacker Guide, its Submissions and Judging page, the Official Judges Rubric, the VISA rubric and the track pages (read October 17, 2026). Winning these tracks is the team's top priority until judging ends.

**Our tracks:** VISA: Reimagine Shopping (title) · SideShift Best Startup Idea (sponsored side) · DubHacks NEXT (non-sponsored) · MLH Best Use of Gemini API (non-sponsored) · MLH DEV Writing Challenge (non-sponsored).

## Hard requirements (miss one and we can't win)

| Requirement | Deadline | Owner | Status |
|---|---|---|---|
| Draft on Devpost (https://dubhacks-2026.devpost.com/) with an overview and our tracks | **Sat 10:30 PM PDT** | Henry | copy in `docs/SUBMISSION.md` |
| Final Devpost submission; Devpost locks, no edits after | **Sun 10:00 AM PDT** | Henry | |
| **Video on Devpost.** "Teams who do not submit a video will not be allowed to judge." VISA judges from a **3-minute** video | Sun 10:00 AM | Saahil + Connor (record), Saahil Jr (script) | not recorded |
| Code uploaded and linked on Devpost; the guide recommends a **public** GitHub repo | Sun 10:00 AM | Henry | **repo is private**; history scanned, no secrets |
| Exactly one title track (VISA), at most 3 sponsored side tracks (SideShift), any number of non-sponsored | Draft | Henry | |
| Gemini Project Number in the Devpost field (a number, not the project ID, never the API key) | Draft | Henry | |
| Whole team at the judging workshop, HUB Ballroom, arrive **~10:20 AM**, workshop 10:30 AM | Sun | everyone | |
| Check the hacker profile (http://profile.dubhacks.co/) for our judging round; it can change | Sun | everyone | |
| Present in under 3 minutes, leave time for Q&A; stay at the table for the whole 50-minute round (side-track judges come any time) | Sun | everyone | |
| Only work done 12:30 PM Sat to 10 AM Sun is presented; at least 70% of code written during the event | | | 0.5% of current source lines predate 12:30 PM Sat (git blame) |

## VISA: Reimagine Shopping (title track, $5,000)

Brief: use generative AI to make commerce smarter across discovery, decision-making, personalization, checkout, **payments**, loyalty, **post-purchase**. Judged virtually from the 3-minute Devpost video.

| Criterion | Weight | How we score it (show it in the video) |
|---|---|---|
| Innovation | 25% | A shared fund with a card per member: the group pays as one, then AI turns the receipt into a claim board. Nobody fronts the bill. |
| User experience | 25% | Clean phone UI, one tap to scan, live updates on both phones, exact-cent results. Keep the video fast and polished. |
| Technical execution | 20% | Gemini vision reads items, tax and tip as structured JSON; the server checks the read against the card charge; same rules run in the app and on the server. |
| Commerce impact | 15% | Group purchases become one card payment for the merchant (no split-check at the register), faster checkout, groups keep spending on the shared card (engagement, loyalty). |
| Trust and responsibility | 15% | The AI drafts, it never agrees or moves money; a read that doesn't match the charge is rejected; consent guards require the exact amount or version a person reviewed; each user sees only their groups; contact details hidden in search; demo receipts are synthetic; money is simulated and the app says so. |

## DubHacks general rubric (used by DubHacks judges)

Functionality 30% · Design 20% · Creativity 20% · Track applicability 30%, each scored 1-8. "Excellent" means the project works robustly, the UI looks professional, the solution is unique, and it is an exemplary demonstration of the track.

## SideShift: Best Startup Idea ($1,500 + work trial)

Open to any stack. They want the strongest startup concept and ideas that **know how they'd get in front of people**: creators, social, "something with a shot at spreading." Judged in person at our table.

Pitch: every purchase pulls the whole group into the app (built-in invites), groups are social by nature (roommates, trips, teams, creator meetups), and one member's invite brings 2-4 more.

## DubHacks NEXT ($200 + guaranteed interview; pathway into UW's startup incubator)

They look for: a meaningful problem with a clear target user; builder energy and resourceful execution; **evidence of learning and iteration over the weekend**; **revenue potential (who would pay, what for, why)**; a team that will keep building. Judged in person.

Answers to prepare: target user is roommates and couples with recurring shared costs; revenue from card interchange on group spend, plus a premium tier for larger groups and trips; iteration evidence is our commit and Devtalk history (schema rewrite, consent bugs found and fixed, free Gemini switch, security fix); state that the team plans to continue.

## MLH: Best Use of Gemini API (MLH swag kits)

Gemini must be central and visible. Ours reads the receipt photo into the claim board in about 3 seconds and is verified live. Put the Gemini Project Number in Devpost and name Gemini in "Built with". Show a real photo scan in the video.

## MLH: DEV Writing Challenge ($100)

Publish a post about the project on DEV (dev.to). Selection considers technical substance, originality, clear storytelling and community popularity. Make it useful and shareable: the shared rules engine, the Gemini check step, consent guards, and how three people and their AI agents coordinated a build overnight. A human must publish it from their own DEV account; link it from Devpost if possible.

## Video plan (critical path)

Under 3 minutes, phone screen recording of https://splitbill-hackathon.vercel.app:

1. Problem (10s): someone always fronts the bill.
2. Group fund and cards (30s): create group, invite, join with the reviewed deposit.
3. AI receipt scan (45s): pay, photograph a synthetic receipt, Gemini fills the claim board.
4. Claim, suggest, lock, settle live on two phones (45s).
5. Trust (20s): AI checked against the charge, exact-amount consent, simulated money.
6. Close (10s): commerce impact and what's next.

Follow `docs/DEMO.md` for the click path.
