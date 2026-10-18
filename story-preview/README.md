# chipin scroll story

A separate, scroll-driven presentation of the chipin demo. This folder owns its entire copy of the phone app and assets; it does not import or modify `design-preview`, the mobile app, or the backend. The source snapshot is commit `16a119f`.

Run from the repository root:

```sh
python3 -m http.server 4174 --bind 127.0.0.1 --directory story-preview
```

Open **http://localhost:4174**. The original demo remains at **http://localhost:4173**.

## Controls

- Scroll in either direction to play or rewind the story. Phone state is rebuilt from a canonical snapshot, so rewinding cannot duplicate purchases or contributions.
- Chapter dots and the left/right arrow keys jump between scenes. Replay returns to the beginning.
- **Explore the app** pauses the timeline and enables the phone's ordinary controls. **Back to story** or Escape restores the scripted scene.
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
| Everyone is in sync | Both charges, group money, personal balances, and next period. |
| Just chipin | Closing wordmark and phone. |

The receipt contains $120 of food, $10.20 tax, and $24 tip. Exclusive item claims allocate $46.26 / $43.69 / $28.27 / $35.98 to Connor / Henry / Maya / Jordan. Purchases reduce buying power once; split edits and approvals do not debit the card again. The inherited demo keeps personal balances separate until settlement.

This is a scripted product presentation: the receipt and its extraction are fixtures, and no Gemini, wallet, payment, or backend request runs. Google Fonts is the only optional external asset request. All phone and receipt assets are local or generated inline.

Photo, icon, merchant-mark, and bird-logo sources are recorded in the [original preview's asset notes](../design-preview/README.md). The original Feather license is retained in the copied app source.

## Editing

- `story.js`: narration, chapter pacing (viewport heights), camera poses, scroll progress, chapter navigation, and Explore mode.
- `story.css` and `index.html`: stage layout, typography, phone frame, card fan, and receipt prop.
- `phone/story-bridge.js`: deterministic scene and phase state, receipt fixture, and scripted phone actions.
- `phone/story-embed.css`: presentation-only framing and scene-specific emphasis inside the phone.
- `phone/app.js`, `phone/styles.css`, and `phone/assets`: copied source demo. Adjust the story wrapper/bridge first, to keep the phone consistent with the original.

`postMessage` communication is restricted to the same origin and expected parent/iframe window. Scrolling, snapshots, and animation use browser APIs with no new dependencies or build step.
