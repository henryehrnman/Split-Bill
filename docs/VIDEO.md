# Final video plan

The Devpost video is required to be judged, and the VISA track is judged only from it. Hard limits: **under 3 minutes**, uploaded and linked on Devpost by **10:00 AM Sunday, October 18**. Target 2:40 so a slow upload or a long title card can't push it over.

The film is a personal user story. The story is the humans' to write; this plan fixes what the judges must see and where it fits. Rubric weights are from `docs/JUDGING.md`; talking points are in `docs/QA-PREP.md`; the click path is `docs/DEMO.md`.

## Must show (each one maps to VISA points)

| Shot | Why | Rubric |
|---|---|---|
| A real photo of a receipt turning into the claim board | The generative AI step, visible | Technical execution 20, Innovation 25 |
| Two phones updating live: claims, a suggested edit accepted, both lock, the split settles | The group experience end to end | User experience 25 |
| One card payment at the store for the whole group | No split-check at the register; the group keeps spending on one card | Commerce impact 15 |
| The trust beat: the read must add up to the charge, people claim their own items, joining needs the exact deposit you reviewed, and money is simulated | AI drafts, people decide | Trust and responsibility 15 |
| Gemini named on screen or in voiceover | MLH Best Use of Gemini API | |

## Structure (about 2:40)

| Time | Beat | Story (humans fill in) | On screen |
|---|---|---|---|
| 0:00–0:20 | **The problem** | The character who always fronts the bill: the dinner, the Venmo requests, the awkward "you owe me $38.17". | Live action. No app yet. |
| 0:20–0:45 | **The fix: one fund, a card each** | The friends decide to try it. | Phone A: create group, budget $300 every 2 weeks, invite by handle. Phone B: the invitation shows the deposit; tap **Join · deposit $150.00**. Then Card: their own card, "Demo virtual card". |
| 0:45–1:00 | **Paying together** | Back at the restaurant: nobody reaches for their wallet. One person pays. | Live action of the tap (staged), then Phone A: Card → **Juniper · $154.20** approved. |
| 1:00–1:35 | **Gemini reads the receipt** | The payer snaps the receipt at the table. | Split → By item → **Take photo** of the printed synthetic receipt. Hold on the claim board as it appears (six items, tax $10.20, tip $24.00). Caption: "Gemini reads the items. The server checks they add up to the $154.20 charge." |
| 1:35–2:10 | **Everyone claims their own** | The friends tap what they had, across the table. | Side-by-side screen recordings: B claims Rigatoni, Branzino, Tiramisu, Burrata; A claims pizza, water, Burrata (shared). A suggests B on the pizza; B taps **Accept**. Both **Lock in my items**; the split confirms on both phones. |
| 2:10–2:25 | **Trust** | One line from the character, or voiceover. | Quick cuts: the claim board total matching the charge; the "Your items" total; Activity with the settled charge and each person's share. Voiceover: "The AI only drafts. If its read doesn't match the charge, it's rejected. Nobody's balance moves until the people who were there agree. Money and cards are simulated in this prototype." |
| 2:25–2:40 | **Close** | The character doesn't front the bill anymore. | Logo, "Split Bill", hosted URL https://splitbill-hackathon.vercel.app, team names. |

Keep claims accurate to the build: money, deposits, cards and wallets are simulated; accounts, live updates and the Gemini read are real. Don't show or say "Apple Pay", a real tap at a terminal, or real bank charges as working features. A staged tap is fine if a caption says it is simulated.

## Who records what

| Piece | Who | Notes |
|---|---|---|
| Live-action story shots | Saahil + Connor (humans) | Phone camera, landscape or vertical, but pick one. |
| Phone screen recordings (A and B) | Connor's two iPhones | iOS Screen Recording on both, started before the beat; trim later. |
| Synthetic receipt prop | Saahil Jr. can generate it | Must total **$154.20** with the sample items so the claim steps match. |
| Hosted accounts and group named for the story | Saahil Jr. can set them up | Fresh group per take, since old charges stay. |
| Edit, captions, voiceover | Humans | Under 3:00 including titles. Export 1080p. |
| Upload and link on Devpost | Henry | YouTube (unlisted is fine) or Vimeo, then paste the link before 10:00 AM. |

## Before recording

- Both phones: hosted URL added to the Home Screen (hides Safari's address bar), signed in to the story accounts, Do Not Disturb on, battery and clock tidy.
- Check "Live updates on" under the title on both phones.
- Start a new group for each take. The server can't be reset, so a failed take leaves its charge behind; just make another group.
- Lock in last. Any claim change or accepted edit unlocks everyone.
- If the photo read fails or doesn't add up, use **Use sample receipt** for that take, or retake the photo.

## After recording

- Watch it once against the "Must show" table.
- Check the runtime is under 3:00.
- Upload, set to public or unlisted, open the link in a private window to confirm it plays, then paste it into Devpost.
