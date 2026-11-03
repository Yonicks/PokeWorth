# PokeWorth — Final Acceptance Tests

The MVP is approved when **every test in layers 1–5 passes** and the sign-off
table at the end is filled in. Layers 1–3 are automated and run on every
change; layers 4–5 need real cards and real phones.

**Free test setup.** Everything runs on a Windows PC at no cost: the Android
emulator from Android Studio (Google Play system image) and Chrome for web.
Real cards reach the emulator through the laptop webcam or as imported photo
files (P1.7). iOS checks are listed under *Deferred* at the end.

Thresholds marked *(proposed)* are starting targets. Adjust them once the
first real-card benchmark shows what the OCR can do.

---

## Layer 1 · Static gates (automated, every commit)

| ID | Command | Passes when |
|---|---|---|
| G1 | `npx tsc --noEmit` | exit 0 |
| G2 | `npx expo lint` | exit 0, no warnings |
| G3 | `npx expo-doctor` | no problems reported |
| G4 | `npx tsx scripts/ocr-fixtures.ts` | all fixtures pass (13 today) |
| G5 | `npx tsx scripts/smoke-test.ts` | live TCGdex search + price extraction succeed (needs network) |

Built in: P1 (G4). To add: `tsx` as a dev dependency so G4/G5 do not depend on the npx cache (P4).

## Layer 2 · Unit and component tests (automated, added in P4)

Runner: `jest-expo` with React Native Testing Library. Network is mocked with
recorded TCGdex responses in `tests/fixtures/`, so the suite runs offline.

| ID | Area | What it proves |
|---|---|---|
| U1 | `utils/text.ts` | normalize, Levenshtein and similarity on accents, punctuation, suffixes (`ex`, `V`, `VMAX`) |
| U2 | `parseOcrLines` | name and number from real OCR line dumps; promo, TG, leading zeros; stage/HP/Illus. lines ignored |
| U3 | `rankCandidates` / `isConfidentMatch` | same name across sets; set size breaks ties (fixes the P0 tie bug); low confidence never marked confident |
| U4 | `extractDisplayPrices` | correct variant labels; holo vs reverse not merged; missing `unit` shows unknown currency, never a guess; no price → empty list |
| U5 | `storage.service` | recent scans dedupe and cap at 25; collection add/qty/remove; corrupt JSON returns empty, never crashes |
| C1 | Scan screen | each permission state renders its actions; Cancel always present |
| C2 | Manual entry | validation messages; submit goes to Confirm with the typed values |
| C3 | Confirm | 2–5 candidates; no auto-advance when not confident; manual-entry fallback when empty |
| C4 | Result | price rows show provider, currency and date; "No price available" when null; variant must be chosen first |
| C5 | Collection | total excludes unpriced cards and says how many were left out |

Passes when: `npm test` exits 0 and coverage of `src/services` and `src/utils` is at least 80 % *(proposed)*.

## Layer 3 · End-to-end flows (automated on devices/emulators, added in P4)

Runner: Maestro (free) flows in `.maestro/`, run against a development build on
the Android emulator (`npx expo run:android`). One flow per user journey:

| ID | Flow | Passes when |
|---|---|---|
| E1 | Scan happy path | camera or imported photo → Confirm → pick → Result shows price with provider, currency, date |
| E2 | OCR fails | unreadable or imported photo → Manual entry keeps the photo → typed name → Confirm → Result |
| E3 | Permission denied | deny camera → "Enter card manually" works; "Open Settings" visible after permanent denial |
| E4 | Manual search | Home → Search → `Charizard 4/102` → correct print appears |
| E5 | Variant choice | multi-variant card → variant picker shown before any price |
| E6 | No price | card without market data → "No price available", no number shown |
| E7 | Offline | airplane mode → friendly error with Retry on Search, Confirm and Result; Retry works after reconnecting |
| E8 | Collection | add 2 cards, change quantity, restart app → collection and total are unchanged |
| E9 | Recent scans | after E1, Home shows the card; See All lists it |

Passes when: all flows pass on the Android emulator. E2, E4, E6 and E7 are also
checked in Chrome (by hand, or with Playwright later). Web has no OCR, so every
web scan ends on Manual entry by design.

## Layer 4 · Real-card accuracy benchmark (human + script)

The test that proves "identify the exact print" works.

- **Card set:** 50 real English cards *(proposed)*: 15 vintage (Base–Neo), 20 modern (SWSH/SV), 5 promos, 5 trainer/energy, 5 same-name-different-set pairs.
- **Conditions:** each card photographed under the matrix in `docs/photo-test-matrix.md` (good light, glare, slight blur, 20° angle, busy background, sleeve) with any available camera: the laptop webcam through the emulator, or photos from any phone imported into the emulator. Note which camera took each photo.
- **Record:** expected TCGdex id vs app result in `docs/benchmark/results.csv`.

| ID | Metric | Target *(proposed)* |
|---|---|---|
| B1 | Correct card is the top candidate (good light) | ≥ 85 % |
| B2 | Correct card is within the shown candidates (good light) | ≥ 95 % |
| B3 | **Wrong card auto-confirmed** (any condition) | **0** |
| B4 | Correct card reachable via manual entry when OCR fails | 100 % |
| B5 | Correct card in candidates under glare/blur/angle | ≥ 70 % |

B3 is the hard rule from the HLD: never silently treat a low-confidence match as the exact card.

## Layer 5 · Device, price and quality checks (human)

| ID | Check | Passes when |
|---|---|---|
| D1 | Development build runs on the Android emulator | Scan → Result completes with the webcam and with an imported photo |
| D2 | Release build (`npx expo run:android --variant release`, or the EAS free plan) installs on the emulator | Same as D1, no dev menu |
| P1 | Price spot-check: 10 cards vs TCGplayer and Cardmarket websites | Every shown price matches the provider's figure for that variant within the TCGdex update window; currency and date correct |
| P2 | Missing-price cards | 3 cards with no data show "No price available" |
| Q1 | Speed on the emulator (indicative; repeat on a real phone when one is available) | capture → candidates under 5 s on Wi-Fi *(proposed)*; cold start under 3 s |
| Q2 | Accessibility | TalkBack on the emulator can complete E1 and E4; text at largest size does not clip |
| Q3 | Privacy | photos never leave the device (network log shows only TCGdex JSON/image requests) |
| Q4 | Production build hygiene | no demo data, debug panel or dev menu reachable |

---

## Deferred until a Mac or an Apple Developer account is available

- iOS development and release builds (D1, D2 on iOS).
- Maestro flows on the iOS Simulator.
- VoiceOver check (Q2 on iOS).
- Speed on a real iPhone (Q1 on iOS).

Also optional and not free: store publishing (Google Play one-time fee, Apple
yearly fee). The free path is sharing the Android release APK directly.

## HLD acceptance criteria → tests

| HLD §9 criterion | Proven by |
|---|---|
| Photograph a real English card on iOS or Android | D1, D2, E1 |
| OCR detects useful text on a representative sample | B1, B5, U2 |
| Plausible matches and corrections | B2, C3, E2, E4 |
| Correct set/printing before pricing | B3, U3, C4, E5 |
| Price with source, currency, freshness, or "unavailable" | U4, C4, E6, P1, P2 |
| Manual lookup works when OCR fails | B4, E2, E3, E4 |
| Works without custom backend or login | Q3, E1 (no sign-in step exists) |

## Sign-off

| Layer | Result | Date | By |
|---|---|---|---|
| 1 Static gates | | | |
| 2 Unit/component | | | |
| 3 E2E flows | | | |
| 4 Real-card benchmark | | | |
| 5 Device/price/quality | | | |
