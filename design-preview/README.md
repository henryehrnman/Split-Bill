# chipin design preview

A standalone HTML/CSS/JavaScript prototype with sample data. It connects to no backend or payment provider. Changes last only for this page and reset on reload.

[Editable Figma screens](https://www.figma.com/design/qaMNm6FfZ3PqWzvN8gtjN9?node-id=2-67) · [UI structure and decisions](https://www.figma.com/board/6JqIwrEf6oP1uttKnfp3e5?node-id=3-214)

From the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory design-preview
```

Open **http://localhost:4173**. Mobile layouts support 390px and 430px viewports; desktop adds a preview frame.

- **Home:** settled personal spending, the first three pending charges, and **See rest** for all five.
- **Groups:** create and invitation actions at the top, photo cards, and group-specific funds, card, members, budget, statistics, and settings.
- **Spending:** settled-only totals and cumulative charts; pending and settled charges appear together. Orange titles and a Pending label distinguish unsettled charges, which open their current split.
- **Splits:** receipt review, equal/item/custom proposals, and approval-to-waiting states. Draft edits do not change the current allocation until submitted. Approval alone never settles a charge.

Invitation and group-creation flows disclose contribution caps and activation conditions. Funding actions use a review step and transfer no money. Photos load from `assets/apartment.jpg`, `assets/weekend.jpg`, and `assets/roadtrip.jpg`. Inter loads from Google Fonts with a system fallback. Icons are official [Feather SVGs](https://github.com/feathericons/feather) (MIT). No package installation or build step is required.

Group photos: [apartment by deborah cortelazzi](https://unsplash.com/photos/tidy-room-filled-with-furnitures-gREquCUXQLI), [weekend by Stefan Vladimirov](https://unsplash.com/photos/white-plates-with-assorted-foods-Q_Moi2xjieU), and [road trip by Sebastian Unrau](https://unsplash.com/photos/trees-on-forest-with-sun-rays-sp-p7uuT0tw), used under the [Unsplash license](https://unsplash.com/license).
