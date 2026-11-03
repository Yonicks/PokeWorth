# PokeWorth — Development Phases (workflow-ready)

This file is the **source of truth for the phase workflow** in
`.claude/workflows/pokeworth-phase.js`. Each phase below is a self-contained
unit a planner agent can read and turn into tasks. Keep the field names and
the `## P<n>` headings stable: the workflow looks phases up by id.

Run a phase by asking Claude Code, for example:

> Run the pokeworth-phase workflow with args `{ "phase": "P1" }`

Optional args: `{ "phase": "P3", "layout": "r2", "maxTasks": 6, "reviewRounds": 2, "dryRun": true }`
(see the workflow header for what each one does). Run phases on a feature
branch: the workflow edits the working tree but never commits or pushes.

## Conventions every phase follows

- **Context:** `docs/dev-phases.md` (this file), `pokeworth-high-level-plan-20-10-2026.md`
  (HLD), `design/home-spec.md` (Home UI spec), `AGENTS.md` (Expo rules).
- **Final approval:** `docs/acceptance-tests.md` (5 layers). Phases add the tests it lists; P6 runs the sign-off.
- **Gates** (must pass before a phase is done):
  - `npx tsc --noEmit`
  - `npx expo lint`
  - `npx tsx scripts/smoke-test.ts` (needs network; skip with a note when offline)
- **Test platforms (no paid services):** the Android emulator from Android Studio (Google Play system image) on Windows, and web (Chrome). Build development clients locally with `npx expo run:android`; the EAS free plan is the fallback. **iOS is deferred** until a Mac or a paid Apple Developer account is available. Real cards reach the emulator through the laptop webcam or imported photo files.
- **Expo rule:** before touching any Expo / React Native API, read the SDK 58
  versioned docs (`https://docs.expo.dev/versions/v58.0.0/`). Install packages
  only with `npx expo install`.
- **Routes** live in `src/app/`; components, hooks, services and utils stay outside it.
- **Prices:** never invent one. Missing data shows an explicit "No price available".
- **Demo data** lives only in `src/demo/` and never mixes with real storage.
- **needs_human** items cannot be done by agents; the workflow lists them in its report.
- **Acceptance criteria** are numbered `AC-Pn.k` and name the acceptance test that proves them (IDs from `docs/acceptance-tests.md`) where one exists.

---

## Definition of Done (every phase)

A phase is done only when all of these hold. The workflow checks 1–6; the
person running it does 7–9.

1. Every task is done, or marked blocked with the reason and a follow-up.
2. Every acceptance criterion (`AC-Pn.k`) is marked **met**, **not met** or **needs human** in `docs/status.md`.
3. Gates pass: `npx tsc --noEmit`, `npx expo lint`, `scripts/ocr-fixtures.ts`, `scripts/smoke-test.ts` (or noted offline), and `npm test` once it exists.
4. Review left no confirmed high or medium finding unfixed.
5. No new lint suppressions, untyped `any`, or unexplained TODOs.
6. Docs match the code: `docs/status.md`, plus `docs/dev-phases.md` or `docs/acceptance-tests.md` when scope or tests changed.
7. The HLD artifact (and the web prototype if behaviour it mirrors changed) is republished.
8. Work is committed on the phase's feature branch; nothing is pushed or merged without approval.
9. needs_human items are listed with who will do them.

---

## P0 · Baseline audit

- **id:** P0
- **depends_on:** none
- **goal:** Know exactly what exists before building. Map the code against the HLD and record gaps.
- **inputs:** `src/**`, `scripts/smoke-test.ts`, `app.json`, `package.json`, HLD, `design/home-spec.md`
- **tasks:**
  - P0.1 Run all gates and record results (pass/fail with output excerpts).
  - P0.2 For each HLD MVP feature (camera, OCR, matching, confirmation, price, manual search, recent scans, collection, totals), mark built / partial / missing with file references.
  - P0.3 List risky spots: unhandled errors, missing loading/empty states, hard-coded values, TODOs.
  - P0.4 Write the findings to `docs/status.md` (create it), grouped by phase P1–P6.
- **outputs:** `docs/status.md`
- **acceptance_criteria:**
  - AC-P0.1 docs/status.md lists every gate with pass/fail and an output excerpt.
  - AC-P0.2 Each of the 9 HLD MVP features has a status (built / partial / missing) and at least one file reference.
  - AC-P0.3 Each risk is filed under a phase P1–P6 with a `file:line` reference.
  - AC-P0.4 No file under `src/` changed.
- **definition_of_done:** the shared Definition of Done, plus:
  - `docs/status.md` committed.
  - HLD artifact shows the audit statuses.
- **needs_human:** none

## P1 · Scan reliability

- **id:** P1
- **depends_on:** P0
- **goal:** Capture → OCR works on real devices, with clear states when it cannot.
- **inputs:** `src/app/scan.tsx`, `src/services/ocr.service.ts`, `src/services/card-matcher.service.ts`, `app.json`
- **tasks:**
  - P1.1 Camera permission states: not asked, denied, permanently denied (offer "Open Settings" via `expo-linking`).
  - P1.2 Card alignment guide overlay (63:88 frame) and a capture button with busy state.
  - P1.3 When OCR is unavailable (Expo Go) or returns nothing, route to manual entry with the photo kept, never a dead end.
  - P1.4 Dev-only OCR debug panel (`__DEV__`) on Confirm showing raw OCR lines and the parsed name/number.
  - P1.5 Add `eas.json` with `development`, `preview` and `production` profiles (development uses a dev client).
  - P1.6 Extract the OCR-parsing checks from `scripts/smoke-test.ts` into an offline fixture script `scripts/ocr-fixtures.ts` covering: promo numbers without a slash, `TG12/TG30`, leading zeros (`004/102`), stage/HP lines, "Illus." lines.
  - P1.7 "Import photo" on Scan (`expo-image-picker`): an imported image follows the same OCR → manual entry → Confirm path as a camera photo. This lets the benchmark run from photo files on the emulator and web.
- **outputs:** updated scan flow, photo import, `eas.json`, `scripts/ocr-fixtures.ts`
- **acceptance_criteria:**
  - AC-P1.1 Given camera permission was never asked, Scan shows an explanation and "Allow camera access". (C1)
  - AC-P1.2 Given permission is permanently denied, Scan shows "Open Settings" and "Enter card manually", and both work. (C1, E3)
  - AC-P1.3 Every Scan state has a visible Cancel that leaves the screen on iOS, Android and web.
  - AC-P1.4 The 63:88 frame stays fully on screen at 375×667 and 430×932; capture controls sit above the system navigation area.
  - AC-P1.5 A second shutter tap during a capture does nothing.
  - AC-P1.6 When OCR is unavailable, finds no text, or throws, the user lands on Manual entry with the photo shown and can continue to Confirm. No path relies on `Alert` alone. (C2, E2)
  - AC-P1.7 Photo URIs never appear in route params or the URL.
  - AC-P1.8 The OCR debug panel renders only in `__DEV__` builds.
  - AC-P1.9 A development build runs on the Android emulator (`npx expo run:android`) and OCR reads a card through the webcam or an imported photo. (needs human)
  - AC-P1.10 `scripts/ocr-fixtures.ts` covers promo, TG, leading zeros, stage/HP and Illus. lines and passes offline. (G4)
  - AC-P1.11 Scan offers "Import photo"; an imported image follows the same path as a camera photo, including manual entry when OCR fails, on Android and web. (E2)
- **definition_of_done:** the shared Definition of Done, plus:
  - Development build tested on the Android emulator and recorded in `docs/status.md` (needs human). iOS deferred.
- **needs_human:** Install Android Studio with an emulator (Google Play image), run `npx expo run:android`, scan a few cards with the webcam or imported photos, and record results in `docs/status.md`. iOS deferred.

## P2 · Identification and pricing

- **id:** P2
- **depends_on:** P1
- **goal:** The right print and variant are confirmed before any price, and every price shows its source, currency and date.
- **inputs:** `src/app/confirm.tsx`, `src/app/result.tsx`, `src/services/tcgdex.service.ts`, `src/services/card-matcher.service.ts`, `src/hooks/use-cards.ts`, `src/types/card.ts`
- **tasks:**
  - P2.1 Confirm screen shows 2–5 candidates with image, set name, number and match reasons; low-confidence matches never auto-advance.
  - P2.2 Variant step: when `card.variants` has more than one printing (normal / reverse / holo / 1st edition), ask the user before showing the price.
  - P2.3 Price block on Result: provider, variant, currency, `updated` date; explicit "No price available" when the provider data is null.
  - P2.4 Manual Search screen using `useCardSearch` (name or `number/total`), reachable from Home. Results open Result for the chosen card.
  - P2.5 Matcher edge cases with fixtures in `scripts/ocr-fixtures.ts`: same name across sets, set-size disambiguation, names with `ex`/`V`/`VMAX` suffixes.
- **outputs:** updated Confirm/Result, Search route, more fixtures
- **acceptance_criteria:**
  - AC-P2.1 When two or more candidates exist, Confirm shows 2–5 of them, each with image (or a plain no-image box), set name (not the id), number and match reasons.
  - AC-P2.2 Candidates that tie on name and number are separated by set size: for a `4/102` read, Base Set Charizard (`base1-4`) ranks first. (U3)
  - AC-P2.3 A match auto-advances only when `isConfidentMatch` is true (≥ 0.85 and ≥ 0.15 ahead); otherwise the user must pick. (B3, C3)
  - AC-P2.4 For a card with more than one printing, a variant picker appears before any price. (C4, E5)
  - AC-P2.5 Every displayed price shows provider, variant, currency and date; a missing currency shows "currency unknown" and a missing date shows "date unknown". (U4)
  - AC-P2.6 A card with no price data shows "No price available" and no number. (E6)
  - AC-P2.7 Cardmarket base prices are not labelled "Normal" on holo-only cards; holo and reverse holo are separate rows. (U4)
  - AC-P2.8 Search finds a card by name and by `number/total` (e.g. `4/102`); a result opens Result. (E4)
  - AC-P2.9 Fixtures cover same name across sets, set-size tie-breaks and `ex`/`V`/`VMAX` names, and pass offline. (G4)
- **definition_of_done:** the shared Definition of Done, plus:
  - 10-card price spot-check recorded in `docs/status.md` (needs human).
- **needs_human:** Spot-check 10 real cards' prices against TCGplayer/Cardmarket websites.

## P3 · Home redesign

- **id:** P3
- **depends_on:** P2 (Search route), decision on layout
- **goal:** Implement the Home screen from `design/home-spec.md` with reusable components, tokens and tab navigation.
- **args:** `layout` = `r1` (Pikachu hero, horizontal cards, 3 tabs) or `r2` (list rows, 4 tabs with centre Scan button). **Required.**
- **inputs:** `design/home-spec.md`, `design/v1/reference/home-reference1.png`, `design/v1/reference/home-reference2.png`, `src/app/_layout.tsx`, `src/app/index.tsx`, `prototype/web/index.html` (behavioural reference only)
- **tasks:**
  - P3.1 Design tokens in `src/theme/tokens.ts` (colours, type scale, spacing, radius from spec §2).
  - P3.2 Install `react-native-svg` and a gradient solution with `npx expo install` (choose per SDK 58 docs, spec §5.3).
  - P3.3 Tabs: move Home into `src/app/(tabs)/` with `index`, `collection`, `search` (and `stats` for r2); keep `scan`, `confirm`, `result` as stack screens above the tabs. Custom tab bar component matching the chosen layout.
  - P3.4 Components in `src/components/home/`: BrandHeader + LogoMark (SVG), HeroSection, ScanCardButton, secondary action(s), SectionHeader, RecentScanCard or RecentScanRow, CollectionPromoBanner (r1).
  - P3.5 Demo data in `src/demo/home-demo-data.ts`, shown only when `__DEV__` and history is empty, with a visible "Demo" marker.
  - P3.6 Recent Scans "See All" route and a Settings stub route.
  - P3.7 Dark-only Home with a light status bar and correct safe areas; scrollable content above the tab bar.
  - P3.8 Missing art (spec §5.2 A3–A6): marked placeholder layers only. Never substitute other artwork.
- **outputs:** tab navigation, Home components, tokens, demo module
- **acceptance_criteria:**
  - AC-P3.1 All colours, type sizes, spacing and radii on Home come from `src/theme/tokens.ts`; Home components contain no hex literals.
  - AC-P3.2 Home matches the chosen reference section by section (spec §3 for r1, §4 for r2); the reviewer compares a web screenshot and finds no section missing.
  - AC-P3.3 Tabs (Home, Collection, Search, plus Stats for r2) switch without losing state; Scan, Confirm and Result open above the tabs and Back returns to the tab.
  - AC-P3.4 Scan Card, Search Manually, See All and the Collection entry point each open the right route.
  - AC-P3.5 Demo recent scans appear only when `__DEV__` and history is empty, carry a visible "Demo" marker, and never mix with stored scans.
  - AC-P3.6 Missing artwork shows marked placeholders; no unrelated or unlicensed artwork is added.
  - AC-P3.7 Home is dark in both system themes with a light status bar; nothing is hidden under the notch or tab bar at 375 and 430 pt widths.
  - AC-P3.8 Scan, Manual entry, Confirm and Result behave as before (E1 and E2 still pass).
- **definition_of_done:** the shared Definition of Done, plus:
  - Layout decision (r1 / r2) recorded in `docs/status.md`.
  - Check on the Android emulator and web by a human.
- **needs_human:** Choose `layout`; supply licensed hero art and the card-back asset; check on the Android emulator and web.

## P4 · MVP hardening

- **id:** P4
- **depends_on:** P2
- **goal:** Every screen handles slow, failed and empty states; the app is accessible and fast.
- **inputs:** all of `src/app/**`, `src/services/tcgdex.service.ts`, `src/hooks/use-cards.ts`
- **tasks:**
  - P4.1 Loading, empty, error and retry states on Home, Confirm, Result, Search (one shared component set).
  - P4.2 Network: request timeout and typed errors in `tcgdex.service.ts`; offline message; TanStack Query retry and `staleTime` tuned per query.
  - P4.3 Images through `expo-image` with caching and `low` quality thumbnails in lists.
  - P4.4 Accessibility: labels and roles on all pressables, 44 pt touch targets, Dynamic Type does not clip text.
  - P4.5 Performance: memoised list rows, stable keys, no re-render loops on focus refetch.
  - P4.6 Write `docs/photo-test-matrix.md`: glare, blur, angle, dark/busy backgrounds, sleeves, foil; expected outcome for each.
  - P4.7 Add `tsx` as a dev dependency and an `npm test` script. Set up `jest-expo` + React Native Testing Library with recorded TCGdex fixtures in `tests/fixtures/`; write unit tests U1–U5 and component tests C1–C5 from `docs/acceptance-tests.md` (C5 once P5 exists).
  - P4.8 Add Maestro flows E1–E9 from `docs/acceptance-tests.md` in `.maestro/` (E8 once P5 exists), runnable against a development build on the Android emulator.
- **outputs:** shared state components, hardened services, test matrix doc, unit/component tests, Maestro flows
- **acceptance_criteria:**
  - AC-P4.1 Home, Confirm, Result and Search each have loading, empty, error and retry states built from shared components. (C1–C4)
  - AC-P4.2 TCGdex requests time out (about 10 s) and errors are typed (offline, not found, server, bad response); each message matches its cause.
  - AC-P4.3 In airplane mode every network screen shows a friendly error with Retry, and Retry works after reconnecting. (E7)
  - AC-P4.4 All card images use `expo-image` with caching; list thumbnails use the `low` quality image.
  - AC-P4.5 Every pressable has an accessibility label and role; touch targets are ≥ 44 pt; text at the largest size does not clip. (Q2)
  - AC-P4.6 No unhandled promise rejections remain in storage writes or screen effects.
  - AC-P4.7 `npm test` runs U1–U5 and C1–C4 offline and passes; `src/services` and `src/utils` coverage ≥ 80 %.
  - AC-P4.8 Maestro flows E1–E7 and E9 pass on the Android emulator; E2, E4, E6 and E7 also work in Chrome.
  - AC-P4.9 `docs/photo-test-matrix.md` lists each condition with its expected outcome.
- **definition_of_done:** the shared Definition of Done, plus:
  - Photo test matrix run on the Android emulator with imported photos and the webcam, and results recorded (needs human).
- **needs_human:** Run the photo test matrix on the Android emulator (imported photos and webcam) and record results.

## P5 · Collection

- **id:** P5
- **depends_on:** P3 (tabs), P4
- **goal:** Save owned cards with quantities and see the total estimated value.
- **inputs:** `src/services/storage.service.ts`, `src/types/card.ts`, `src/app/result.tsx`, `src/app/(tabs)/collection.tsx`
- **tasks:**
  - P5.1 Versioned collection storage in `storage.service.ts` (`pokeworth.collection.v1`): add, set quantity, remove, list; store card id, variant, quantity, last known price with provider/currency/date.
  - P5.2 "Add to collection" with quantity stepper on Result.
  - P5.3 Collection tab: list, quantities, total value, and cards without a current price flagged and excluded from the total (say so).
  - P5.4 Refresh prices for collection cards on pull-to-refresh (respect TanStack Query cache).
  - P5.5 (r2 only) Stats tab: total value, value by set, most valuable cards.
- **outputs:** collection storage, Collection (and Stats) screens
- **acceptance_criteria:**
  - AC-P5.1 Collection storage is versioned (`pokeworth.collection.v1`); corrupt data gives an empty collection, not a crash. (U5)
  - AC-P5.2 From Result the user adds a card with a chosen variant and quantity; adding the same card and variant again increases the quantity.
  - AC-P5.3 Collection lists each entry with quantity and value; quantities can be changed and entries removed.
  - AC-P5.4 Total value sums priced cards only and states how many cards were left out and why. (C5)
  - AC-P5.5 Pull-to-refresh updates prices and their dates; cached prices are reused within `staleTime`.
  - AC-P5.6 The collection survives an app restart. (E8)
  - AC-P5.7 (r2) Stats shows total, value by set and top cards, and its total equals the Collection total.
- **definition_of_done:** the shared Definition of Done.
- **needs_human:** none

## P6 · Release preparation

- **id:** P6
- **depends_on:** P1–P5
- **goal:** The app is ready for store submission through EAS.
- **inputs:** `app.json`, `eas.json`, `assets/`, HLD
- **tasks:**
  - P6.1 `app.json` branding: name, icons, splash (navy background), `userInterfaceStyle`, bundle identifiers, camera permission text.
  - P6.2 EAS Update channels mapped to `preview` and `production` profiles; runtime version policy.
  - P6.3 About screen: TCGdex attribution, "prices are estimates" disclaimer, "not affiliated with Nintendo / The Pokémon Company".
  - P6.4 Remove or gate all demo data and debug panels from production builds.
  - P6.5 `docs/release-checklist.md`: store listing, screenshots, privacy answers (no account, photos stay on device), version bump steps.
  - P6.6 Run layers 1–3 of `docs/acceptance-tests.md` and record results in its sign-off table; prepare `docs/benchmark/results.csv` with the 50-card template for layer 4.
- **outputs:** release-ready config and checklist
- **acceptance_criteria:**
  - AC-P6.1 `app.json` has the PokeWorth name, final icons, navy splash, dark style, bundle identifier, Android package and camera permission text.
  - AC-P6.2 `eas.json` profiles map to update channels, a runtime version policy is set, and `npx expo-doctor` is clean. (G3)
  - AC-P6.3 An About screen, reachable from Settings, shows TCGdex attribution, "prices are estimates" and "not affiliated with Nintendo / The Pokémon Company".
  - AC-P6.4 A production build has no reachable demo data, OCR debug panel or dev menu. (Q4)
  - AC-P6.5 `docs/release-checklist.md` covers store listing, screenshots, privacy answers and version bumps.
  - AC-P6.6 Acceptance layers 1–3 are signed off and the 50-card benchmark sheet is ready.
- **definition_of_done:** the shared Definition of Done, plus:
  - Acceptance layers 4–5 signed off (needs human).
  - Store submission done, or the release APK shared directly (needs human).
- **needs_human:** Run acceptance layers 4–5 (real-card benchmark, emulator, price and quality checks) and sign off. Store publishing costs money (Google Play one-time registration fee, Apple yearly fee) and is optional: until then, share the Android release APK directly for free. iOS builds wait for a Mac or an Apple Developer account.
