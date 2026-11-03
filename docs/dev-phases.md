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
- **Gates** (must pass before a phase is done):
  - `npx tsc --noEmit`
  - `npx expo lint`
  - `npx tsx scripts/smoke-test.ts` (needs network; skip with a note when offline)
- **Expo rule:** before touching any Expo / React Native API, read the SDK 58
  versioned docs (`https://docs.expo.dev/versions/v58.0.0/`). Install packages
  only with `npx expo install`.
- **Routes** live in `src/app/`; components, hooks, services and utils stay outside it.
- **Prices:** never invent one. Missing data shows an explicit "No price available".
- **Demo data** lives only in `src/demo/` and never mixes with real storage.
- **needs_human** items cannot be done by agents; the workflow lists them in its report.

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
- **done_when:** `docs/status.md` exists, each HLD feature has a status and file references, gate results are recorded.
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
- **outputs:** updated scan flow, `eas.json`, `scripts/ocr-fixtures.ts`
- **done_when:** gates pass; `npx tsx scripts/ocr-fixtures.ts` passes; every scan failure path ends on a usable screen.
- **needs_human:** Build a development client (`npx eas-cli@latest build --profile development`) and test on one iOS and one Android device; record results in `docs/status.md`.

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
- **done_when:** gates and fixtures pass; no code path renders a price without provider and currency.
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
- **done_when:** gates pass; reviewer compares a web screenshot (`npx expo start --web`) against the chosen reference and finds no section missing; no screen outside Home changed behaviour.
- **needs_human:** Choose `layout`; supply licensed hero art and the card-back asset; check on a device.

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
- **outputs:** shared state components, hardened services, test matrix doc
- **done_when:** gates pass; airplane-mode run shows a friendly error with retry on each screen (reviewer reasons through each path in code).
- **needs_human:** Run the photo test matrix on devices and record results.

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
- **done_when:** gates pass; totals never include unpriced cards silently; data survives app restart (reasoned in code).
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
- **outputs:** release-ready config and checklist
- **done_when:** gates pass; `npx expo-doctor` reports no problems; no demo/debug code reachable in production.
- **needs_human:** Apple and Google developer accounts, signing credentials, store listing, `eas submit`.
