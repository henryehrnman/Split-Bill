# chipin video demo

The scroll-driven site used for the chipin video, now also the pitch deck: a problem chapter, the 12 product scenes, then four pitch chapters (market, competition, business model, projections) before the close. The pitch figures and their sources are in `docs/PITCH.md`. This is a self-contained copy of `story-preview` at `e5634cb`; its phone prototype originally came from `16a119f`. All runtime files and image assets live inside this directory, so it can be copied or cherry-picked on its own.

Run from the repository root:

```sh
python3 -m http.server 4174 --bind 127.0.0.1 --directory demo
```

Open **http://localhost:4174**. If that port is already in use, choose another port. You can also serve the repository root and open `/demo/`; all runtime paths are relative. Use an HTTP server rather than opening `index.html` as a file so parent/phone messaging has a shared origin.

For pitch-deck stills, use the right arrow to step cue by cue, or the chapter dots to choose a scene. The `window.chipinStoryTimeline.seekTime(seconds)` console helper can stop at an exact narration cue, such as `70` for group statistics or `122` for the closing Home. The full scene and cue list is below.

## Controls

- **Space** starts/pause-resumes the 125-second timeline from your current position. The clock follows elapsed time rather than frame counts; the problem chapter runs 0:00 to 0:10, the product story (the recorded video narration, offset by 10 seconds) runs 0:10 to 1:15, the pitch chapters run 1:15 to 2:02, and the closing scene starts at 2:02 and holds through 2:05. At the end, Space starts again from zero. Playback labels, timestamps, replay, chapter count, and demo/explore controls are intentionally absent from the presentation.
- Playback controls the visuals only; no narration audio file is included. Start your narration alongside the story. `00:08 36` and `00:1533` are interpreted as **8.36 seconds** and **15.33 seconds**.
- Scroll in either direction to play or rewind the story. Phone state is rebuilt from a canonical snapshot, so rewinding cannot duplicate purchases or contributions.
- The page scrollbar is hidden; wheel, trackpad, touch, and keyboard scrolling remain available.
- Scrolling, chapter navigation, or hiding the browser tab pauses playback. Resuming continues from that position; resizing preserves narration time. Space keeps its normal behavior in form fields and on other buttons/links.
- Left/right arrow keys step to the next or previous narration cue (the table below), scrolling smoothly so the transitions inside a scene play on the way. Chapter dots jump between scenes. The chipin wordmark returns to the beginning.
- The layout adapts to mobile screens. Reduced-motion mode removes large camera moves, rotations, and scan animation while retaining every scene.

## Narration and scenes

The supplied narration is preserved in the accessible chapter transcript in `story.js`; the visible headings are shorter visual cues. Brand spelling is normalized to **chipin**.

| Scene | Visual |
| --- | --- |
| The problem | The phone is off-stage. Henry fronts $154.20 at Din Tai Fung; his Venmo-style requests come back paid, late and ignored; then the list of what payment apps do not do. |
| Meet chipin | The phone arrives beside the wordmark. |
| One shared fund | Apartment, ski trip, and shared groups. |
| Agree on a budget | $500 every month, four people, $125 each. |
| Invite and chip in | Contribution consent, then the funded group. |
| A card for everyone | Shared fund with a card for each member. |
| Whoever is there pays | A $64 purchase; buying power becomes $436. |
| Split your way | $16 each, then a $24 / $16 / $12 / $12 proposal. |
| Be like Henry | Henry pays $154.20 at Din Tai Fung; buying power becomes $281.80. |
| Snap the receipt | Receipt image, a staged Gemini scan, then six editable items. |
| Claim your items | Personal selection, confirmation, and a per-person breakdown. |
| Everyone is in sync | The app's existing group statistics menu with the original humanized Apartment history and spending by member. |
| The market | The phone leaves; TAM / SAM / SOM rings ($2.0T US P2P flow, $60B shared spend by 18–34 groups, $1.25B chipin year 3) with counting figures. |
| The competition | Feature matrix against Splitwise, Venmo, Cash App and Revolut/Monzo, filling in row by row; chipin's column is lit. |
| How we make money | Deposits flow into the group fund, then out as 3.75% yield on the invested float and 0.9% net interchange on card taps. |
| Projections | Three stacked revenue bars ($0.33M, $2.4M, $12.7M), then year-three float, card spend and contribution margin. |
| Just chipin | Closing wordmark and Home showing $238.20 in settled personal spending, with pending charges directly below the spend card. |

### Narration cues

| Time | Visual cue |
| --- | --- |
| 0:00 | The problem: someone always fronts the bill |
| 0:05 | Payment apps only settle up after |
| 0:10 | Meet chipin |
| 0:12 | Shared groups |
| 0:16 | Cards fan out beside the group view |
| 0:18.36 | Set the $500 monthly budget |
| 0:24 | Group invitation |
| 0:25.33 | Review the contribution before agreeing |
| 0:27 | Four $125 contributions fund the group |
| 0:29 | Every member has a card |
| 0:32 | Ready to pay |
| 0:37 | Purchase confirmed; available funds decrease |
| 0:39 | Buyer proposes the split |
| 0:41 | Equal shares |
| 0:45 | Custom amounts |
| 0:50 | Meet Henry |
| 0:55 | Henry's dinner payment confirmed |
| 1:00 | Receipt photo |
| 1:02 | Gemini scan (item review at 1:04) |
| 1:05 | Claim items (selection at 1:06.5; grouped results at 1:08) |
| 1:10 | Charges, balances, and next period |
| 1:15 | The market: $2 trillion moves between friends |
| 1:21 | Our wedge: 25M people, $60B of shared spend |
| 1:26 | The competition: everyone else settles up after |
| 1:32 | Only chipin does all of it |
| 1:38 | How we make money: deposits earn yield |
| 1:44 | Spending earns interchange |
| 1:50 | Projections: three-year model |
| 1:56 | $12.7M revenue in year three |
| 2:02 | Closing scene |
| 2:05 | Playback stops |

The piecewise time map preserves manual scrolling and aligns phone actions to narration independently of chapter height. `window.chipinStoryTimeline` exposes `play()`, `pause()`, `seekTime(seconds)`, `cues`, and `getState()` for rehearsing and checking cue positions.

The receipt contains $120 of food, $10.20 tax, and $24 tip. Exclusive item claims allocate $46.26 / $43.69 / $28.27 / $35.98 to Connor / Henry / Saahil / Nathan. Purchases reduce buying power once; split edits and approvals do not debit the card again.

The final two screens are independent example snapshots. Scene 11 reuses the original ten Apartment history rows, preserving the varied transaction dates, uneven shares, and member totals of $486.20 / $410.00 / $452.00 / $423.00. Scene 12 scales that pattern with exact cent allocation so Connor's monthly spend is $238.20. Both scripted purchases stay pending, and current buying power stays $281.80. Rewinding restores the appropriate scene snapshot. The closing Home uses fixed spacing rather than distributing unused height between sections.

This is a scripted product presentation: the receipt and its extraction are fixtures, and no Gemini, wallet, payment, or backend request runs. Google Fonts is the only optional external asset request. All phone and receipt assets are local or generated inline.

Photo, icon, merchant-mark, and bird-logo sources are recorded in the [asset notes](ASSETS.md). The original Feather license is retained in the copied app source.

The transparent Gemini sparkle in scene nine is downloaded unchanged from [Google's official asset](https://www.gstatic.com/lamda/images/gemini_sparkle_4g_512_lt_f94943af3be039176192d.png), referenced by [Gemini](https://gemini.google.com/), and served locally as `assets/gemini-logo.png`.

## Editing

- `story.js`: narration cues in seconds, chapter pacing (viewport heights), camera poses, scroll progress, playback, and chapter navigation.
- `story.css` and `index.html`: stage layout, typography, phone frame, card fan, and receipt prop.
- `phone/story-bridge.js`: deterministic scene and phase state, receipt fixture, and scripted phone actions.
- `phone/story-embed.css`: presentation-only framing and scene-specific emphasis inside the phone.
- `phone/app.js`, `phone/styles.css`, and `phone/assets`: copied source demo. Adjust the story wrapper/bridge first, to keep the phone consistent with the original.

`postMessage` communication is restricted to the same origin and expected parent/iframe window. Scrolling, snapshots, and animation use browser APIs with no new dependencies or build step.
