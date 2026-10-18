# chipin scroll story

A separate, scroll-driven presentation of the chipin demo. This folder owns its entire copy of the phone app and assets; it does not import or modify `design-preview`, the mobile app, or the backend. The source snapshot is commit `16a119f`.

Run from the repository root:

```sh
python3 -m http.server 4174 --bind 127.0.0.1 --directory story-preview
```

Open **http://localhost:4174**. The original demo remains at **http://localhost:4173**.

## Controls

- **Space** starts/pause-resumes the 68-second narration timeline from your current position. The clock follows elapsed time rather than frame counts; the closing scene starts at 1:05 and holds through 1:08. At the end, Space starts again from zero. Playback labels, timestamps, replay, chapter count, and demo/explore controls are intentionally absent from the presentation.
- Playback controls the visuals only; no narration audio file is included. Start your narration alongside the story. `00:08 36` and `00:1533` are interpreted as **8.36 seconds** and **15.33 seconds**.
- Scroll in either direction to play or rewind the story. Phone state is rebuilt from a canonical snapshot, so rewinding cannot duplicate purchases or contributions.
- Scrolling, chapter navigation, or hiding the browser tab pauses playback. Resuming continues from that position; resizing preserves narration time. Space keeps its normal behavior in form fields and on other buttons/links.
- Chapter dots and the left/right arrow keys jump between scenes. The chipin wordmark returns to the beginning.
- The layout adapts to mobile screens. Reduced-motion mode removes large camera moves, rotations, and scan animation while retaining every scene.

## Narration and scenes

The supplied narration is preserved in the accessible chapter transcript in `story.js`; the visible headings are shorter visual cues. Brand spelling is normalized to **chipin**.

| Scene | Visual |
| --- | --- |
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
| Everyone is in sync | The app's existing group statistics menu, with spending by member and charge history. |
| Just chipin | Closing wordmark and Home showing $24 in settled personal spending. |

### Narration cues

| Time | Visual cue |
| --- | --- |
| 0:00 | Meet chipin |
| 0:02 | Shared groups |
| 0:06 | Cards fan out beside the group view |
| 0:08.36 | Set the $500 monthly budget |
| 0:14 | Group invitation |
| 0:15.33 | Review the contribution before agreeing |
| 0:17 | Four $125 contributions fund the group |
| 0:19 | Every member has a card |
| 0:22 | Ready to pay |
| 0:27 | Purchase confirmed; available funds decrease |
| 0:29 | Buyer proposes the split |
| 0:31 | Equal shares |
| 0:35 | Custom amounts |
| 0:40 | Meet Henry |
| 0:45 | Henry's dinner payment confirmed |
| 0:50 | Receipt photo |
| 0:52 | Gemini scan (item review at 0:54) |
| 0:55 | Claim items (selection at 0:56.5; grouped results at 0:58) |
| 1:00 | Charges, balances, and next period |
| 1:05 | Closing scene |
| 1:08 | Playback stops |

The piecewise time map preserves manual scrolling and aligns phone actions to narration independently of chapter height. `window.chipinStoryTimeline` exposes `play()`, `pause()`, `seekTime(seconds)`, `cues`, and `getState()` for rehearsing and checking cue positions.

The receipt contains $120 of food, $10.20 tax, and $24 tip. Exclusive item claims allocate $46.26 / $43.69 / $28.27 / $35.98 to Connor / Henry / Saahil / Nathan. Purchases reduce buying power once; split edits and approvals do not debit the card again. The final two scenes use a settled store-purchase snapshot: Connor's $24 share appears in monthly spending, while dinner remains pending and buying power stays $281.80. Earlier scenes restore the unsettled snapshot when rewound.

This is a scripted product presentation: the receipt and its extraction are fixtures, and no Gemini, wallet, payment, or backend request runs. Google Fonts is the only optional external asset request. All phone and receipt assets are local or generated inline.

Photo, icon, merchant-mark, and bird-logo sources are recorded in the [original preview's asset notes](../design-preview/README.md). The original Feather license is retained in the copied app source.

The transparent Gemini sparkle in scene nine is downloaded unchanged from [Google's official asset](https://www.gstatic.com/lamda/images/gemini_sparkle_4g_512_lt_f94943af3be039176192d.png), referenced by [Gemini](https://gemini.google.com/), and served locally as `assets/gemini-logo.png`.

## Editing

- `story.js`: narration cues in seconds, chapter pacing (viewport heights), camera poses, scroll progress, playback, chapter navigation, and Explore mode.
- `story.css` and `index.html`: stage layout, typography, phone frame, card fan, and receipt prop.
- `phone/story-bridge.js`: deterministic scene and phase state, receipt fixture, and scripted phone actions.
- `phone/story-embed.css`: presentation-only framing and scene-specific emphasis inside the phone.
- `phone/app.js`, `phone/styles.css`, and `phone/assets`: copied source demo. Adjust the story wrapper/bridge first, to keep the phone consistent with the original.

`postMessage` communication is restricted to the same origin and expected parent/iframe window. Scrolling, snapshots, and animation use browser APIs with no new dependencies or build step.
