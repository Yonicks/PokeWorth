# Release checklist (P6.5)

## Before the first build (owner)
- [ ] Final app icon, Android adaptive icon (foreground, monochrome) and iOS icon in `assets/` (they are still Expo template art).
- [ ] Choose `ios.bundleIdentifier` (Android package is `com.pokeworth.app`; rename in `app.json` if wanted).
- [ ] Expo account is logged in (`bunx`/`npx eas-cli login`); project is linked (`extra.eas.projectId`).
- [ ] Google Play developer account (Android) and Apple Developer account (iOS, $99/year) for store submission.

## Config already in place
- Name PokeWorth, dark-only UI, navy splash and adaptive icon background (`#031229`).
- `runtimeVersion` policy `appVersion`; `eas.json` build profiles map to channels `development`, `preview`, `production`.
- Camera and photo permission texts; microphone permission off.
- OCR debug panel only in `__DEV__`; no demo data.

## Each release
1. Bump `version` in `app.json` (it is the runtime version, so bump it whenever native code or plugins change).
2. `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`.
3. Preview build for testers: `npx eas-cli@latest build --profile preview --platform android`.
4. Install on a clean device: app name, icon, navy splash; no dev menu or debug panel; Profile → About shows sources and the disclaimer.
5. Production build: `npx eas-cli@latest build --profile production --platform android` (build number auto-increments).
6. JavaScript-only fixes after release: `npx eas-cli@latest update --channel production --message "…"` (only reaches builds with the same runtime version).
7. Submit: `npx eas-cli@latest submit --profile production --platform android`.

## Store listing
- Short description: scan a Pokémon card or binder page, see its market price and track your collection value.
- Screenshots (phone, portrait): Home, Scan, Card Details with price chart, Portfolio, Binder review.
- Disclaimers in the listing: prices are estimates; not affiliated with Nintendo or The Pokémon Company; card data from TCGdex.

## Privacy answers
- No account, no sign-in, no analytics or ads.
- Collection, history and scan log are stored only on the device (AsyncStorage); backup is a file the user saves.
- Card photos are read on the device. In Expo Go and on web only, a photo is sent to OCR.space for reading; development and release builds do not.
- Network calls: TCGdex (card data and prices), Frankfurter/ECB (exchange rate).
- Camera and photo library are used only to identify cards.

## Sign-off (acceptance layers 1–3 from `docs/acceptance-tests.md`)
| Layer | Result | Date |
|---|---|---|
| 1 Automated (`npm test`, tsc, lint, doctor) | | |
| 2 Emulator | | |
| 3 Real phone | | |
