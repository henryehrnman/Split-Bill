# chipin design preview

A standalone HTML/CSS/JavaScript prototype with sample data. It connects to no backend or payment provider. Changes last only for this page and reset on reload.

[Editable Figma screens](https://www.figma.com/design/qaMNm6FfZ3PqWzvN8gtjN9?node-id=2-67) · [UI structure and decisions](https://www.figma.com/board/6JqIwrEf6oP1uttKnfp3e5?node-id=3-214)

From the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory design-preview
```

Open **http://localhost:4173**. Mobile layouts support 390px and 430px viewports; desktop adds a preview frame.

- **Home:** settled personal spending, the first three pending charges, and a blue **+2 more** link for the remaining charges. The link count updates after locally simulated purchases.
- **Groups:** create and invitation actions at the top, photo cards, a swipe/keyboard carousel for card and spending with accessible dot controls, and Funds/Card controls plus an inline group-specific charge history. The settings icon contains name/photo editing, members, budget, and the default split.
- **Spending:** settled-only totals and cumulative charts; pending and settled charges appear together. Selecting a legend group emphasizes its line, grays the others, and filters the charge list; selecting it again restores all. Orange titles and a Pending label distinguish unsettled charges, which open their current split.
- **Splits:** read-only current proposals with **Make changes** and **Accept my share/items**. Editing creates a separate draft; cancel/back preserves the current proposal and approvals. Submitting a changed method, item, assignment, tax/tip or receipt resets approvals; unchanged submission preserves them. Only your own acceptance is recorded. Only Your share and the current amount pin while scrolling; draft/context copy stays in the page. Approval alone never settles a charge.
- **Receipts:** attach a local image, use clearly labeled sample items, or enter items manually. Images are not uploaded and no OCR is performed. Itemized proposals require every item to have assignees and the full bill to reconcile. Shared items and proportional tax/tip allocations conserve cents.

**Mock wallet:** tap a group card to open a tap-ready wallet inspired by the native Apple Pay layout, within the surrounding design-preview frame. Simulate payment adds one local pending charge using that group’s member count and default split; cents are conserved and the full purchase becomes a group hold. A small amount widget defaults to $24.00 at the fixed sample merchant Blue Bottle ($6.00 each for Weekend crew). Canceling creates no charge. Approval does not settle it. No wallet or payment provider is connected. The layout follows [Apple’s native tap-ready wallet reference](https://support.apple.com/en-au/guide/iphone/iphbd4cf42b4/18.0/ios/18.0).

Invitation and group-creation flows disclose contribution caps and activation conditions. Funding actions use a review step and transfer no money. Photos load from `assets/apartment.jpg`, `assets/weekend.jpg`, and `assets/roadtrip.jpg`. Inter loads from Google Fonts with a system fallback. Icons are official [Feather SVGs](https://github.com/feathericons/feather) (MIT). No package installation or build step is required.

Group photos: [apartment by deborah cortelazzi](https://unsplash.com/photos/tidy-room-filled-with-furnitures-gREquCUXQLI), [weekend by Stefan Vladimirov](https://unsplash.com/photos/white-plates-with-assorted-foods-Q_Moi2xjieU), and [road trip by Sebastian Unrau](https://unsplash.com/photos/trees-on-forest-with-sun-rays-sp-p7uuT0tw), used under the [Unsplash license](https://unsplash.com/license).

Merchant marks identify sample purchases; brand rights remain with their owners. Sources: [Spotify](https://developer.spotify.com/documentation/general/design-and-branding/#using-our-logo), [IKEA](https://www.ikea.com), and [Shell](https://en.wikipedia.org/wiki/File:Shell_logo.svg) via [Simple Icons](https://github.com/simple-icons/simple-icons); [Whole Foods Market](https://www.wholefoodsmarket.com/) official favicon; [Blue Bottle](https://en.wikipedia.org/wiki/File:Blue_Bottle_Coffee_logo.svg), [Trader Joe’s](https://commons.wikimedia.org/wiki/File:Trader_Joes_Logo.svg), and [Costco](https://commons.wikimedia.org/wiki/File:Costco_Wholesale_logo_2010-10-26.svg) via Wikimedia.

Home includes a dollar axis. Main-tab navigation slides in the selected direction, preserves each tab’s scroll position, ignores same-tab clicks, and respects reduced-motion preferences. Press states do not move controls.
