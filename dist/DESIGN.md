# Split Bill design system and UX audit
Updated October 15, 2026. This specification is binding guidance for ongoing design work; preserve the native app as canonical.

## Research findings
“Vibecoded” is an informal judgment, not a measurable interface category. Microsoft Research's March 2026 paper examines homogenization risks and proposes deliberate challenges to default outputs; it does not establish that one color/font proves AI authorship. NN/g's visual-design guidance emphasizes typographic consistency, grid alignment, hierarchy and restrained palettes. Its consistency heuristic favors predictable conventions. Apply those principles to the task, rather than copying another app's screen.
Sources:
- https://www.microsoft.com/en-us/research/publication/interrogating-design-homogenization-in-web-vibe-coding/
- https://www.nngroup.com/articles/why-does-design-look-good/
- https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
- https://www.nngroup.com/articles/consistency-and-standards/

## Audit of previous implementation (source-based, not user testing)
1. Large slogan titles displaced useful information on every screen.
2. Nearly all content used similarly rounded colored boxes, flattening hierarchy.
3. Unicode glyphs used as navigation icons differed in weight, alignment and rendering.
4. Every action looked primary; three large approval buttons dominated the split screen.
5. Repeated implementation explanations and simulation warnings competed with task content.
6. Excessive bold weights, weak secondary-text contrast, arbitrary radii and spacing made screens feel assembled rather than designed.
7. Long screens buried the main action. Profile was unnecessarily a fifth navigation tab while already available through the avatar.

## Direction: a focused social payments utility
Quiet white canvas, charcoal ink, cobalt action color. Warm participant colors add human distinction without fake photos. Group-card art uses dark navy with simple concentric arcs as an intentional physical-card detail. Real tasks lead: active bill, your share, approvals, wallet choice, receipt. No invented transaction history, testimonials or balances.

## Tokens
Typography: DM Sans Regular / Medium / Bold, bundled locally for native and web. Money uses tabular numerals and a 58/68 display scale; screens use 28/35; section titles 17/24; body 15/22; supporting text 12/18. Do not add additional typefaces or font weights without a purpose.
Color: ink #171a20; action #2459e8; muted #626a78; divider #e8ebf0; surface #f5f6f8; positive #17794c. Accent color is reserved for actions/selection, not large decorative blocks on every screen.
Spacing: 4/8/12/16/24/32 scale, 24-point screen inset. Inputs and buttons at least 48/52 points; interactive approval targets 44 points high. Radius: 10 inputs, 12 buttons, 14 secondary panels, 18 active bill, 20 payment card. Standard Feather icons at 18–24 points.

## Interaction rules
- Four bottom destinations: Home, Split, Card, Activity. Profile via avatar.
- One main action in a persistent footer on checkout screens.
- Bill edit fields live behind an explicit Edit bill disclosure, not in the first-view foreground.
- Equal / percentage / amount selector exposes selected state.
- People use aligned rows; inline approval actions retain disabled/approved states.
- Wallet choices are selection rows; choose first, then simulate payment. Do not use official provisioning branding or imply real wallet connection.
- Decline scenario lives behind Demo scenarios; freeze is a standard card control.
- Persistent Demo badge plus contextual no-money text; technical implementation detail lives in profile and project docs.
- Empty activity has an honest empty state and a clear next action. Receipt only appears after simulated success.
- Keep all engine invariants: approval reset, invalid-input blocks, freeze and wallet gates, decline/retry, duplicate guard.

## Verification and next review
Run TypeScript/lint, existing payment reducer tests and web export. Browser-control skill is unavailable in this environment, so visual browser/device QA remains outstanding; do not claim screenshots or usability testing happened. Next review: 320/390/430 widths, OS large text, keyboard visibility, VoiceOver/TalkBack, font loading, touch target spacing, route refresh and sticky footer on small screens. Ask Henry for feedback after the published revision; aesthetic success is not established by compiling.
