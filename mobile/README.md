# Split Bill mobile
Native React Native / Expo application with Home, Split, Card, Activity and Profile routes. The hosted web review is exported from this same source.

## Run
`npm ci` then `npx expo start`. For browser review: `npx expo start --web`. Use a compatible Expo Go version for native preview, or create a development build. No actual banking or Wallet integration is installed.

## Verify
`npm run typecheck`, `npm run lint`, `npm test`, `npx expo export --platform web`.

## Build for distribution
App identifiers are proposed defaults; confirm ownership before registration. Connect Henry's Expo/EAS account and the relevant Apple Developer / Google Play developer accounts. Configure signing and run `npx eas-cli@latest build --profile preview --platform android` for an internal APK, or the corresponding iOS build with valid Apple provisioning. Production submission requires actual store metadata, privacy policy, support URL, screenshots, reviewer credentials where relevant, and provider/program approval for any live financial service. No store account or EAS project is configured yet. No signed binary has been produced.

## Issuing boundary
The generated demo ID is an internal session reference, not a card PAN. Card generation is modeled after unanimous approval, with a spend cap equal to the bill. Apple Wallet and Google Wallet actions are explicit simulations. Real provisioning belongs behind an authenticated server and issuer-approved SDK integration. Never place secret keys or PAN/CVC in client storage/logs. See docs/WALLET_PLAN.md in the parent repository.
