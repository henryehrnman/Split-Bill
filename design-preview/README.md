# Split Bill design preview

A standalone, dependency-free UI prototype. It does not connect to the application, Supabase, a payment processor, or any production data. All displayed people and amounts are sample data. Changes last for this browser page only and reset on reload.

[Editable Figma screens](https://www.figma.com/design/qaMNm6FfZ3PqWzvN8gtjN9?node-id=2-67) · [UI structure and decisions](https://www.figma.com/board/6JqIwrEf6oP1uttKnfp3e5?node-id=3-214)

From the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory design-preview
```

Open **http://localhost:4173**. Use a 390px or 430px viewport for the mobile layout; the desktop layout adds an explanatory frame.

Home, Groups, and Spending are the primary destinations. Open a pending split, review receipt details, choose an allocation method, and approve the displayed share. Approval moves to a waiting state; it does not settle the purchase or change recorded spending. Group menus contain funds review, card freeze, members, a budget proposal, group statistics, and settings. Invitations and group creation show the contribution-cap and activation conditions explicitly. Notifications, profile, spending filters, and month navigation are interactive.

Funding actions have a separate review screen and explicitly explain that no transfer occurs. Card and settings changes are local preview state. There is no purchasing, dispute handling, or demo/account switch in this prototype.

Inter is requested from Google Fonts with a system fallback. Inline icons are official Feather SVGs (MIT), downloaded from https://github.com/feathericons/feather. No JavaScript packages or build process are required.
