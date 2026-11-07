# PokeWorth — Status (P0 baseline audit)

- **Date:** 2026-11-03
- **Commit audited:** `33b35cf` (`main`, plus untracked design/docs/prototype files)
- **Expo SDK:** 58 (`expo ~58.0.16`, `react-native 0.88.0`)
- **Scope:** `src/**`, `scripts/smoke-test.ts`, `app.json`, `package.json`, checked against
  `pokeworth-high-level-plan-20-10-2026.md` (HLD) and `design/home-spec.md`.

---

## P0

- **Gate run date:** 2026-11-04 (from `date`: Wed Nov 4 2026 JST)
- **Phase result:** all tasks done, all gates pass. No source files were changed in this phase, and nothing was committed.

### Task results

| Task | Result | Summary |
|---|---|---|
| P0.1 Run gates | done | tsc and lint passed on the first try. The smoke test passed on a retry after an `npx` cache failure (environment, not code). See section 1. |
| P0.2 Feature status | done | Read-only audit. Camera, OCR, matching, confirmation, price and manual search are **Partial**. Recent scans is **Built (basic)**. Collection and collection total are **Missing**. See section 2. |
| P0.3 Risk audit | done | Read-only audit of unhandled errors, missing states, hard-coded values, places that could show invented prices or stand-in artwork, TODOs (none found) and tooling gaps. Filed by phase in section 3. |
| P0.4 Status doc | done | Created this file with the date, the commit audited, gate results, feature table and findings grouped by phase. |

### Gate results (2026-11-04 run)

| Gate | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0) | No output. |
| `npx expo lint` | **PASS** (exit 0) | No output. |
| `npx tsx scripts/smoke-test.ts` | **PASS** (exit 0, on retry) | The first run failed again with `The package "@esbuild/win32-x64" could not be found`, because the cached `npx` copy of tsx is broken. A rerun with a fresh cache (`npx --yes --cache <scratchpad> tsx …`) passed: 126 catalog hits, `base4-4`/`base1-4`/`ex14-4` tied at 1.00, three price rows, `Smoke test passed.` |
| `npx tsx scripts/ocr-fixtures.ts` | n/a | The file does not exist yet (planned for P1.6). |

The esbuild cache failure happened on both P0 runs, so adding `tsx` as a dev dependency (P4) is worth doing.

### Human-only items

- None for P0. Human-only items for later phases are marked **needs_human** in section 3.

---

## P1

- **Gate run date:** 2026-11-04 (from `date`; P1.7 gate run)
- **Phase result:** all seven tasks are done (P1.1–P1.6 in earlier runs, P1.7 in this one) and all four gates pass. P1.7 was checked in the browser preview on web (see Human-only items). Apart from that web check, nothing has run on a device, an emulator or a simulator. Nothing was committed, and no `eas build`/`submit`/`update` was run. `design/hld/index.html` and `docs/dev-phases.md` were already modified in the working tree (HLD record and the free test plan). This run did not touch them.

### Task results

| Task | Result | Summary |
|---|---|---|
| P1.1 Camera permission states | done | `scan.tsx`: the loading state shows a spinner, "Checking camera access…" and Cancel. When the app can still ask, it shows an "Allow camera access" button. When permission is permanently denied (`granted` false and `canAskAgain` false), it shows "Camera access is off" with "Open Settings" (`Linking.openSettings()` from `expo-linking`, wrapped in try/catch). A denied status also offers "Enter card manually", which P1.3 now points at `/manual-entry`. Every state has Cancel through `goBack()` (`router.back()` if possible, otherwise `router.replace('/')`). Views are padded with `useSafeAreaInsets`. The APIs were checked against the installed SDK 58 type definitions. |
| P1.2 Alignment guide and busy shutter | done | The guide uses a 63:88 `CARD_RATIO`. Its width is the smaller of 75% of screen width and 55% of screen height × ratio (`useWindowDimensions`). The controls sit at `insets.bottom + 24`. `busyRef` blocks a double tap. While busy, the shutter is disabled and dimmed with a spinner, and the guide text reads "Reading card…". Cancel still works mid-scan, and any late result is dropped after the screen closes. Accessibility labels added: "Capture card photo" and "Cancel scan". |
| P1.3 Manual-entry fallback | done | New route `src/app/manual-entry.tsx` ("Enter Card Details") shows the kept photo with `expo-image`, a message for each reason (`ocr-unavailable` / `no-text` / `error` / `permission`), and name/number fields with checks shown next to them. It replaces the screen with `/confirm`. Helpers are in `src/utils/manual-entry.ts`. `parseCollectorNumber` is exported from `card-matcher.service.ts`. Alert is no longer used in `scan.tsx`: every failure goes to manual entry. Confirm offers "Enter details manually" when there are no candidates and when there is nothing to search for. `photoUri` is never shown as card artwork. |
| P1.4 OCR debug panel | done | `src/components/ocr-debug-panel.tsx` starts collapsed and shows the parsed name, number and set total ("none" when missing) plus numbered raw lines in a monospace font. Confirm renders it only under `__DEV__`, in the list header and on the "Nothing to search for" screen. Raw-line parsing has its own memo and now checks that the JSON is an array. |
| P1.5 `eas.json` | done | `expo-dev-client ~58.0.18` was installed with `npx expo install`. `eas.json` sets `cli.version >= 16.0.0` and `appVersionSource: remote`. Profiles: `development` (dev client, internal), `preview` (internal) and `production` (`autoIncrement`), plus an empty `submit.production`. Update channels and `runtimeVersion` are left for P6.2. |
| P1.6 Offline OCR fixtures | done | `scripts/ocr-fixtures.ts` has 11 parse fixtures and 2 `rankCandidates` fixtures. They cover Charizard 4/102, SWSH284, SM60, `SVP 085`, TG12/TG30, 004/102, stage/HP lines, Illus. lines, damage numbers, and a slash number winning over a promo token. `PROMO_NUMBER_RE` was added for known promo prefixes, and the wrong comment on `COLLECTOR_NUMBER_RE` was fixed. The smoke test no longer repeats the parse assertions. |
| P1.7 Import photo | done | `expo-image-picker ~58.0.10` was installed with `npx expo install`. `app.json` adds its plugin with `photosPermission` ("PokeWorth uses your photos to identify Pokémon cards.") and `microphonePermission: false`. `cameraPermission` repeats the expo-camera string instead of `false`, because in the SDK 58 plugin `false` deletes `NSCameraUsageDescription` on iOS and blocks `android.permission.CAMERA` on Android, which would break expo-camera. The Android system photo picker (`PickVisualMedia`) needs no runtime permission. New `src/services/photo-import.service.ts` has `pickCardPhoto()`, which returns `assets[0].uri` or null on cancel (a `blob:` URL on web). In `scan.tsx`, `runScan(getPhotoUri)` holds the `busyRef`/`mountedRef` guards and the try/catch/finally, and `processPhoto(photoUri, photoId)` runs the OCR check, `recognizeCardText`, `parseOcrLines` and routing. Both `capture()` and `importPhoto()` go through them, so the paths cannot drift. "Import photo" (accessibilityLabel "Import card photo", disabled while busy) sits in the right-hand slot of the camera controls and in both camera-permission-not-granted states, which also show a spinner and "Reading card…" while busy. Only `photoId` goes into params. |


### Gate results (2026-11-04 run, after P1.7)

| Gate | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0) | No output. |
| `npx expo lint` | **PASS** (exit 0) | No output. |
| `npx tsx scripts/ocr-fixtures.ts` | **PASS** (exit 0, on retry) | First run: `The package "@esbuild/win32-x64" could not be found`, from the broken `npx` cache seen in P0 (environment, not code). With a fresh cache (`npx --yes --cache <scratchpad> tsx …`) the output was `13/13 OCR fixtures passed.` |
| `npx tsx scripts/smoke-test.ts` | **PASS** (exit 0, on retry) | Same esbuild cache failure first. With a fresh cache: 126 catalog hits, `base4-4`/`base1-4`/`ex14-4` tied at 1.00 (a known P2 issue), three price rows, `Smoke test passed.` |
| `npm test` | n/a | No `test` script exists yet. |

No gate failed because of P1 changes, so the gate run needed no code fixes. Adding `tsx` as a dev dependency (P4) would stop the npx cache failure.

### Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| AC-P1.1 | needs human | `src/app/scan.tsx` shows the explanation and an "Allow camera access" button when the app can still ask. This was checked only by reading the code. It needs the Android emulator. |
| AC-P1.2 | needs human | In `scan.tsx`, when `canAskAgain` is false the screen shows "Camera access is off", "Open Settings" (`Linking.openSettings()`) and "Enter card manually" (→ `/manual-entry`). Open Settings needs the real OS settings app. |
| AC-P1.3 | needs human | Every Scan state in `scan.tsx` renders Cancel → `goBack()` (`router.back()`, or `router.replace('/')` when there is nothing to go back to). Code check only. The web denied-state Cancel was not tried, and iOS is deferred. |
| AC-P1.4 | needs human | `guideWidth = min(0.75·width, 0.55·height·63/88)`, and the controls sit at `insets.bottom + 24`. Code check only. It needs a small emulator with 3-button navigation. |
| AC-P1.5 | needs human | `busyRef` in `runScan` drops a second call, and the shutter and Import photo are both `disabled={busy}`. Code check only. Double-tapping needs a real camera. |
| AC-P1.6 | needs human | The `ocr-unavailable` path was seen on web (Manual entry with the photo, then Confirm). The `no-text` and `error` paths in `processPhoto`/`runScan` route to `/manual-entry` with `photoId`, and `scan.tsx` has no `Alert`. Those two paths need OCR in a dev build. |
| AC-P1.7 | met | `processPhoto` and `runScan` pass only `photoId` (from `setLastPhoto`) in params. In the web preview the URLs were `/manual-entry?photoId=…&reason=ocr-unavailable` and `/confirm?…&photoId=…`, with no `blob:` or `data:` URI. |
| AC-P1.8 | needs human | `src/app/confirm.tsx:78` and `:141` render `OcrDebugPanel` only under `__DEV__`. Code check only. No release build has been made. |
| AC-P1.9 | needs human | Needs the Android emulator dev build (`npx expo run:android`). Not done yet. |
| AC-P1.10 | met | `scripts/ocr-fixtures.ts` passed 13/13 in this run, covering promo (SWSH284, SM60, SVP 085), TG12/TG30, 004/102, stage/HP and Illus. lines. The script makes no network calls. |
| AC-P1.11 | needs human (met on web) | "Import photo" appears in the camera controls and in both permission-not-granted states. `importPhoto = () => runScan(pickCardPhoto)` uses the same `processPhoto` path as `capture()`. On web it led to Manual entry with the photo, then to Confirm, and canceling stayed on Scan. Android needs the emulator. |

### Definition of Done (items 1–6)

| # | Item | Holds? | Evidence |
|---|---|---|---|
| 1 | Every task done or blocked with a reason | yes | P1.1–P1.7 are all done (table above). |
| 2 | Every AC marked in `docs/status.md` | yes | All 11 are marked in the table above (2 met, 9 needs human). |
| 3 | Gates pass | yes | tsc, lint, ocr-fixtures and smoke all pass. The two tsx runs needed a fresh npx cache, an environment problem. `npm test` does not exist yet. |
| 4 | No confirmed high or medium review finding left unfixed | yes | The P1.7 report lists none. Reading the `scan.tsx`, `photo-import.service.ts` and `app.json` diff turned up none either. |
| 5 | No new lint suppressions, untyped `any` or unexplained TODOs | yes | `git diff` of `src/` and `app.json` has no `eslint-disable`, `any` or `TODO`. |
| 6 | Docs match the code | yes | This section covers P1.7. `docs/dev-phases.md` already lists P1.7 and AC-P1.11, so scope did not change. |

Items 7–9 (HLD republish, commit on `feat/p1-scan-reliability`, owners for the needs_human items) are for the person running the workflow. In particular, the AC-P1.11 web check means the HLD page should show P1.7 as built.

### Notes from P1.7

- In `app.json`, `cameraPermission` in the expo-image-picker plugin repeats the expo-camera text instead of being set to `false`. In SDK 58, `false` deletes `NSCameraUsageDescription` and blocks `android.permission.CAMERA`, which would break expo-camera.
- `microphonePermission: false` deletes the iOS microphone usage string that expo-camera adds. This could cause an App Store purpose-string warning later. Check it when iOS work starts.

### Human-only items

- **needs_human:** install Android Studio with an emulator (Google Play image), run `npx expo run:android`, test with the webcam and imported photos, and record the results here. iOS is deferred (no Mac, no paid Apple account). Not done yet.
- Before the first build: the account owner must choose `ios.bundleIdentifier` and `android.package`. They are not in `app.json`, and no values were made up. The first build or `eas init` also needs an Expo account login and project linking (`extra.eas.projectId`).
- **AC-P1.11 (Import photo):** met on web, not yet checked on Android. In the browser preview (web, camera permission not granted), Scan → Import photo with a test PNG went to `/manual-entry?photoId=…&reason=ocr-unavailable` with the photo shown from its `blob:` URL. Name and number then reached Confirm (`/confirm?name=Charizard&number=4&total=102&lines=&photoId=…`), with no `blob:`/`data:` image on Confirm and no URI in the URL. A canceled picker cleared "Reading card…" and stayed on Scan. The file dialog was driven by a test script, not by hand. The granted-camera controls row was not checked (no webcam in the preview). Android needs the emulator (human step).
- On-device checks for Import photo: the button in the controls row and in both permission states; the Android system photo picker opens with no permission prompt; an imported card goes to Confirm when OCR reads it and to manual entry (`no-text` / `error`) when it does not; canceling the picker stays on Scan; the shutter and Import photo cannot run at the same time; the imported photo is never shown as card artwork on Confirm or Result.
- On-device checks still to do: permission states (including Open Settings), the guide and controls on short and notched screens, OCR through the dev client, the manual-entry fallback, and the `__DEV__` debug panel.

---

## 1. Gate results (P0.1)

| Gate | Result | Notes |
|---|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0) | No output. |
| `npx expo lint` | **PASS** (exit 0) | No warnings or errors printed. |
| `npx tsx scripts/smoke-test.ts` | **PASS** (exit 0, on 2nd attempt) | The first run failed for environment reasons, not code (see below). |

**Smoke test, first attempt (FAIL, environment):** the cached `npx` copy of `tsx` had a broken
esbuild install:

```text
Error: The package "@esbuild/win32-x64" could not be found, and is needed by esbuild.
```

**Smoke test, second attempt (PASS):** ran again with a fresh npm cache (`npx --cache <tmp> tsx …`):

```text
parsed: {"rawLines":[…,"4/102"],"localId":"4","setTotal":102,"name":"Charizard"}
catalog hits: 126
  base4-4 #4 score=1.00 [name 100%,number exact]
  base1-4 #4 score=1.00 [name 100%,number exact]
  ex14-4 #4 score=1.00 [name 100%,number exact]
prices: [ 'Cardmarket Normal: 411.22 EUR', 'Cardmarket Holo / Reverse Holo: 123.63 EUR',
          'TCGplayer Holofoil: 987.13 USD' ]
Smoke test passed.
```

The test passes, but its output shows two real problems (a three-way tie at 1.00, and a "Normal"
price on a holo-only card). Both are listed under P2.

`tsx` is not in `devDependencies`, so the smoke gate depends on whatever `npx` has cached (see P4).

---

## 2. HLD MVP feature status (P0.2)

| Feature (HLD §2) | Priority | Status | Where | Notes |
|---|---|---|---|---|
| Card camera | P0 | **Partial** | `src/app/scan.tsx`, `app.json` (`expo-camera` plugin + permission text) | Capture, 63:88 guide overlay and busy shutter work. Permanently-denied permission has no "Open Settings" path. Photo is thrown away after OCR. |
| On-device OCR | P0 | **Partial** | `src/services/ocr.service.ts`, `parseOcrLines` in `src/services/card-matcher.service.ts` | `expo-text-extractor` is loaded lazily and needs a dev build (no `eas.json` yet). Not tested on a device. Raw lines go to Confirm in `lines` but are never shown (HLD Phase 1 asks for a debug view). Collector numbers without a slash (promos) are not parsed. |
| Card matching | P0 | **Partial** | `matchCard`, `rankCandidates`, `isConfidentMatch` in `src/services/card-matcher.service.ts`; `src/utils/text.ts`; `useCardMatch` in `src/hooks/use-cards.ts` | Ranks on name + number + set size. A number-only read finds nothing because search is by name only. The set-size bonus is capped at 1.0, so it cannot break ties (see P2). |
| Match confirmation | P0 | **Partial** | `src/app/confirm.tsx` | Lists candidates with image, number, score and reasons. Only auto-advances when the match is confident (HLD rule kept). Shows the card **id** instead of the set name, does not limit the list to 2–5, and has **no variant step**. |
| Market price | P0 | **Partial** | `extractDisplayPrices` in `src/services/tcgdex.service.ts`; `src/app/result.tsx` | Shows provider, currency and `updated` date, and an explicit no-price box. But the price is not tied to a confirmed variant, Cardmarket "holo" merges holo and reverse, and the currency falls back to a hard-coded `EUR`/`USD` when `unit` is missing. |
| Manual search | P0 | **Partial** | Inline `TextInput` in `src/app/index.tsx` → `/confirm?name=` | Searches by name only, and names under 3 characters are dropped with no message. `useCardSearch` (`src/hooks/use-cards.ts`) is never used. There is no Search route and no `number/total` search. |
| Recent scans | P1 | **Built** (basic) | `src/services/storage.service.ts` (`pokeworth.recentScans.v1`, max 25); `useRecentScans`; list in `src/app/index.tsx`; written in `src/app/result.tsx` | Every Result view is recorded, manual searches included. No loading or error state, no "See All" route, and no price, rarity or set total stored. |
| Collection | P1 | **Missing** | none (`storage.service.ts` header comment only) | No storage, no route, no "Add to collection". |
| Collection total | P1 | **Missing** | none | Depends on Collection. |

Other structure versus HLD §7 and the Home spec: there is no `src/components/`, `src/theme/`, `src/demo/`, tab
navigator, `collection` route, or `eas.json`. `src/app/_layout.tsx` is a single `Stack`.

---

## 3. Findings grouped by phase (P0.3)

Each item below is a gap or risky spot, filed under the phase that should fix it.
Tags: **[error]** unhandled error · **[state]** missing loading/empty/error state ·
**[hard-coded]** hard-coded value · **[gap]** missing feature.

No `TODO` / `FIXME` / `HACK` comments exist in `src/` or `scripts/` (grep found none).

### P1 · Scan reliability

*Goal: capture → OCR works on real devices, with clear states when it cannot.*

- **[state]** `src/app/scan.tsx:15-17`: while permission is loading the screen is an empty `View`.
  `:19-30`: a denied permission only offers "Grant camera access". `canAskAgain` is not checked, so
  a permanently denied user hits a button that does nothing. Settings is not offered (`expo-linking` is
  installed). (P1.1)
- **[state]** `src/app/_layout.tsx:23` hides the header on `scan` (`headerShown: false`), and the
  permission-loading and permission-denied views (`scan.tsx:15-30`) have no Cancel or back control. On web,
  and anywhere without a hardware back button or swipe-back gesture, the user is stuck there. These states
  need a visible Cancel/back action. (P1.1)
- **[gap]** `scan.tsx` `styles.controls` puts the Cancel/shutter row at a fixed `bottom: 40` with no
  `useSafeAreaInsets`, although `react-native-safe-area-context` is installed. Edge-to-edge is always on
  in SDK 58, so on Android with 3-button navigation the controls can sit under the system bar. Position them
  from the insets, for example `bottom: insets.bottom + 24`. (P1.1, P1.2)
- **[gap]** On web, `Alert.alert` does nothing (react-native-web), so every scan failure path fails
  silently: "OCR unavailable" (`scan.tsx:40-44`), "Could not read the card" (`:52-55`) and "Scan failed"
  (`:69`). The OCR-unavailable path also never goes back, because `router.back()` is inside the alert
  button's `onPress`. P1.3 should use in-screen error UI or a manual-entry route, not Alert-only
  feedback. (P1.3)
- **[gap]** `src/app/scan.tsx:39-46`: OCR unavailable shows an alert and then `router.back()`. The photo
  is lost and the user is not taken to manual entry. (P1.3)
- **[gap]** `src/app/scan.tsx:51-57`: "Could not read the card" alert leaves the user on the camera with
  no manual-entry action. (P1.3)
- **[error]** `src/app/scan.tsx:68-69`: any error shows the raw `e.message` in an alert, so users can see
  technical text.
- **[gap]** No OCR debug view: `confirm.tsx:30-37` parses `lines` and never renders them. (P1.4)
- **[gap]** No `eas.json`, so a dev client for `expo-text-extractor` cannot be built. (P1.5)
- **[gap]** `card-matcher.service.ts:11-12`: the comment says `"SWSH284" (promo, no slash)` is
  handled, but `COLLECTOR_NUMBER_RE` requires a slash. Promo numbers are never parsed. (P1.6)
- **[gap]** OCR parsing has only one fixture, the Charizard case in `scripts/smoke-test.ts:10-17`, and that
  test needs the network. There is no offline fixture script. (P1.6)
- **needs_human:** OCR has not been validated on an iOS or Android device yet.

### P2 · Identification and pricing

*Goal: confirm the right print and variant before any price, and show every price with its source, currency and date.*

- **[error] Tie-breaking bug:** `card-matcher.service.ts:138` adds `+0.2` for a set-size match but
  caps it with `Math.min(…, 1)`. Exact name + number already scores 1.0, so the bonus does nothing.
  The smoke test shows `base4-4`, `base1-4` and `ex14-4` all at 1.00 for a `4/102` read. The order of the
  tied cards is arbitrary and the printed set size never resolves the tie. (P2.1, P2.5)
- **[gap]** `matchCard` (`card-matcher.service.ts:121-124`) only searches by name. A read with a number and no name
  returns no candidates. (P2.4/P2.5)
- **[gap]** `card-matcher.service.ts:129-149`: up to 10 parallel `getCard` calls run on every match that
  has a set total. This is slow on mobile networks, and a failed call is swallowed so its
  candidate quietly loses the bonus.
- **[gap]** `confirm.tsx:96-99`: candidates show `card.id` rather than the set name. The list is not
  capped at 2–5. (P2.1)
- **[gap]** No variant step: `result.tsx:52-54` lists `Printings:` but never asks. (P2.2)
- **[error]** `tcgdex.service.ts:77-80`: the Cardmarket non-suffixed figures are labelled `Normal`
  even for holo-only cards. The smoke test shows `Cardmarket Normal: 411.22 EUR` for `base1-4`. `-holo` is
  labelled "Holo / Reverse Holo", which mixes two printings. (P2.2, P2.3)
- **[hard-coded]** `tcgdex.service.ts:69` (`'EUR'`) and `:99` (`'USD'`): when the provider omits `unit`, a currency is
  assumed. Under the "never invent" rule the currency should be shown as unknown instead. (P2.3)
- **[state]** `result.tsx:90`: when `updated` is missing the date is just left out, with no
  "date unknown" text. (P2.3)
- **[gap]** No Search route. Home pushes straight to `/confirm`. `useCardSearch` is unused. (P2.4)
- **[gap]** No fixtures for same name across sets or for `ex`/`V`/`VMAX` suffixes. `looksLikeName`
  and `similarity` (`card-matcher.service.ts:22-35`, `src/utils/text.ts:35-41`) have never been tested on
  suffixed names such as "Charizard VMAX" against "Charizard". (P2.5)
- **needs_human:** spot-check 10 real prices against TCGplayer/Cardmarket.

### P3 · Home redesign

*Goal: build the Home screen from `design/home-spec.md` with reusable components, tokens and tab navigation.*

- **[gap]** Single `Stack` in `src/app/_layout.tsx:21-26`. There is no `(tabs)` group, no Collection/Search/Stats tabs, and
  no custom tab bar. (P3.3)
- **[gap]** No `src/theme/tokens.ts` and no `src/components/home/*`. `src/app/index.tsx` is one flat screen
  with an emoji button label (`index.tsx:56`). (P3.1, P3.4)
- **[hard-coded]** Colours are inlined everywhere (`#208AEF`, `#34C759`, `#8e8e93`, `#c7c7cc`) in
  `index.tsx:89-124`, `scan.tsx:98-153`, `confirm.tsx:128-153` and `result.tsx:108-135`. The search input has
  `backgroundColor: '#fff'` (`index.tsx:107`) and text colours are unset, so dark mode is broken. (P3.1, P3.7)
- **[gap]** `react-native-svg` and a gradient library are not installed (spec §5.3). (P3.2)
- **[gap]** No `src/demo/`, no "See All" recent-scans route, no Settings stub. (P3.5, P3.6)
- **[hard-coded]** `<StatusBar style="auto" />` in `_layout.tsx:27`. The spec needs `light` on a dark-only Home. (P3.7)
- **[gap]** `RecentScan` (`src/types/card.ts:110-117`) has no price, rarity or set total. The designs show
  them, and real rows without a stored price must show "—". (P3.4, spec §6.5)
- **needs_human:** choose `layout` (r1/r2). Supply licensed hero art (A3) and the card-back asset (A4). Missing art
  must stay as marked placeholders. (P3.8)

### P4 · MVP hardening

*Goal: every screen handles slow, failed and empty states, and the app is accessible and fast.*

- **[error]** `result.tsx:21-32`: the `addRecentScan` promise is not awaited or caught, so an AsyncStorage
  failure is an unhandled rejection. The effect also runs again whenever `card.data` changes identity
  (refetch), which rewrites `scannedAt`.
- **[error]** `storage.service.ts:23-28`: `addRecentScan` has no try/catch, unlike `getRecentScans`.
- **[state]** `result.tsx:42-48`: the error state has no Retry button. A missing `id` param shows "Check
  your connection", which is the wrong message.
- **[state]** `result.tsx:34-40`: the loading state is a bare spinner with no text.
- **[state]** `index.tsx:75-84`: Recent scans has no loading or error state. A storage error looks
  like "No scans yet".
- **[state]** `index.tsx:29-33`: a search under 3 characters is ignored with no feedback.
- **[state]** `confirm.tsx:73-82`: the error copy is always "Check your connection" whatever the cause.
- **[error]** `tcgdex.service.ts:19-27`: `fetch` has no timeout or `AbortController`. Errors are plain
  `Error` with no type (offline / 404 / 5xx). A non-JSON body makes `res.json()` throw an untyped error. (P4.2)
- **[hard-coded]** `_layout.tsx:6-13`: global `retry: 1`. `staleTime` is a fixed 10 min in every hook
  (`use-cards.ts`), and recent scans use `staleTime: 0` plus a manual `refetch` in `useFocusEffect` with an
  `eslint-disable` (`index.tsx:22-27`). (P4.2, P4.5)
- **[gap]** All images use React Native `Image` (`index.tsx:40`, `confirm.tsx:92`, `result.tsx:59`). `expo-image` is installed
  but unused, so there is no caching. (P4.3)
- **[gap]** No `accessibilityLabel`/`accessibilityRole` on any `Pressable` (`index.tsx`, `scan.tsx`,
  `confirm.tsx`). The shutter has no label. (P4.4)
- **[note]** The React Compiler is on (`app.json` `experiments.reactCompiler: true`). It memoises the inline
  `renderItem` closures (`index.tsx:35`, `confirm.tsx:86`), so manual `useCallback`/`memo` is not needed.
  The real list costs for P4.5 are full-size React Native `Image` thumbnails with no caching (see the
  `expo-image` item above) and the recent-scans `staleTime: 0` refetch on every focus (`index.tsx:22-27`). (P4.5)
- **[gap]** No `docs/photo-test-matrix.md`. (P4.6)
- **[gap]** `tsx` is not a dev dependency, so the smoke gate relies on the `npx` cache. This broke the first
  P0 run (esbuild binary missing). Consider adding it with `npx expo install -- --save-dev tsx`, or
  noting it in the gates.
- **needs_human:** run the photo test matrix on devices.

### P5 · Collection

*Goal: save owned cards with quantities and see the total estimated value.*

- **[gap]** No collection storage. `storage.service.ts` only holds `pokeworth.recentScans.v1`. (P5.1)
- **[gap]** No "Add to collection" on Result, and no quantity stepper. (P5.2)
- **[gap]** No `src/app/(tabs)/collection.tsx`. This depends on the P3 tabs. (P5.3)
- **[gap]** No total value. Unpriced cards must be flagged and left out of the total, and the screen must say so. (P5.3)
- **[gap]** No price refresh for saved cards, and no Stats tab (r2). (P5.4, P5.5)

### P6 · Release preparation

*Goal: the app is ready for store submission through EAS.*

- **[hard-coded]** `app.json:37` splash `backgroundColor: "#208AEF"` (template blue, not navy).
  `app.json:9` `userInterfaceStyle: "automatic"` but the design is dark-only. (P6.1)
- **[gap]** `app.json` has no `ios.bundleIdentifier` / `android.package`. Icons are Expo template art
  (`assets/images/icon.png`, `android-icon-*`, `ios.icon: ./assets/expo.icon`). (P6.1)
- **[gap]** No `eas.json`, update channels or `runtimeVersion` policy. (P6.2)
- **[gap]** No About screen. The "prices are estimates" disclaimer exists only on Result
  (`result.tsx:100-103`). There is no TCGdex attribution and no "not affiliated with Nintendo" line. (P6.3)
- **[gap]** Template leftovers: `scripts/reset-project.js` (plus the `reset-project` npm script), and
  `assets/images/react-logo*.png`, `expo-logo.png`, `expo-badge*.png`, `tutorial-web.png`, `tabIcons/explore*`. (P6.1/P6.4)
- **[gap]** No `docs/release-checklist.md`. (P6.5)
- **needs_human:** Apple/Google developer accounts, signing, store listing, `eas submit`.

---

## P1 test run (2026-11-04, Chrome + Android emulator in Expo Go)

Run by Claude on this PC: Chrome (Expo web on :8081) and the `Pixel_9`
emulator (Android, Google Play image) running the app in **Expo Go**. The
native development build could not be made (see "Blockers").

### Automated gates (final code)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx expo lint` | PASS |
| `scripts/ocr-fixtures.ts` | PASS, 13/13 |
| `scripts/smoke-test.ts` | PASS (still shows the P2 three-way Charizard tie) |
| `npx expo-doctor` | WARN: 16 Expo packages one patch behind SDK 58 (`npx expo install --check`) |

### Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| AC-P1.1 | **met** | Chrome and emulator: "Camera access needed" + "Allow camera access", "Import photo", "Cancel". |
| AC-P1.2 | **partly met** | Emulator: after two denials, "Camera access is off" with "Open Settings" (opens Android Settings) and "Enter card manually" (works). **Gap:** Scan never re-checks permission when the app returns from Settings (no `AppState` refresh in `src/app/scan.tsx`), so the screen likely stays "off" until Scan is reopened. Could not be confirmed in Expo Go, which keeps its own per-project permission state. |
| AC-P1.3 | **met** | Chrome and emulator: Cancel returns to Home from the permission screens and the camera screen. |
| AC-P1.4 | **met at 1080×2424** | Emulator camera screen: 63:88 frame fully visible, controls above the gesture bar. Small screen and 3-button navigation not tried yet. |
| AC-P1.5 | **met** | Emulator: two shutter taps in one adb command gave one capture and one Manual entry screen. |
| AC-P1.6 | **met for "OCR unavailable"** | Chrome and Expo Go: photo → Manual entry with the photo and the "not available" message → Confirm. The "no text" and "error" paths need OCR (dev build). |
| AC-P1.7 | **met** | Chrome URLs: `/manual-entry?reason=permission`, `/confirm?name=…&photoId=`; no `blob:`/`data:` URI anywhere. |
| AC-P1.8 | needs dev/release build | Debug panel shows in development (Chrome, Expo Go); absence in release builds not checked. |
| AC-P1.9 | **blocked** | `npx expo run:android` fails on Windows (see Blockers). |
| AC-P1.10 | **met** | 13/13 offline fixtures. |
| AC-P1.11 | **met (web, Expo Go)** | Emulator: "Import photo" → Android photo picker → Manual entry with the photo; same path as the camera. Real OCR on an imported photo needs the dev build. |

Also checked: Manual entry validation ("Enter the card name."), Confirm → Result
for Base Set Charizard (prices show provider, currency and date), the scan appears
under Recent scans, "No matching cards" offers "Enter details manually".

### Findings

1. **Permission not re-checked after Settings** (AC-P1.2): add an `AppState` "active" listener on Scan that calls the permission getter from `useCameraPermissions`.
2. **Dev overlay in Expo Go:** importing or capturing a photo shows a red "Uncaught Error: Cannot find native module 'ExpoTextExtractor'" before Manual entry. The flow is correct and release builds would not show it, but `ocr.service.ts` should check that the native module exists (for example `requireOptionalNativeModule('ExpoTextExtractor')` from `expo-modules-core`) before requiring the package.
3. **Copy:** Manual entry labels an imported picture "Photo you took of the card"; say "Card photo" instead.
4. **Picker:** the Android photo picker needs an extra "Done" tap after choosing a photo; check `selectionLimit`/`allowsMultipleSelection` in `photo-import.service.ts`.
5. Confirmed P2 issues: candidates tie (`base4-4`, `base1-4`, `ex14-4` at 100 %), rows show card ids instead of set names, more than 5 candidates, "Normal" Cardmarket price on a holo-only card, no variant step.

### Blockers

- **Native Android build fails on Windows:** `ninja: Filename longer than 260 characters` in the React Native Gesture Handler C++ build (`android/app/.cxx/...`, 341 characters). A shorter drive letter only reaches 293. Free fixes, both needing the owner: build in the cloud on the **EAS free plan** (needs a free Expo account and `eas login`), or turn on **Windows long paths** (admin setting) and install a newer CMake in Android Studio's SDK Manager.
- `android.package` set to `com.pokeworth.app` in `app.json` for this test; rename before publishing if wanted.

### Fixes after the test run (2026-11-04)

| Finding | Fix | Verified |
|---|---|---|
| 1. Permission not re-checked after Settings | `src/app/scan.tsx` re-reads the camera permission (`getPermission` from `useCameraPermissions`) whenever `AppState` becomes `active`. | Typecheck + review only. Expo Go keeps its own permission state, so confirm in the native build (AC-P1.2). |
| 2. Expo Go "Cannot find native module 'ExpoTextExtractor'" overlay | `src/services/ocr.service.ts` checks `requireOptionalNativeModule('ExpoTextExtractor')` (from `expo`) before requiring the package. | Emulator, Expo Go: both Import photo and camera capture now go straight to Manual entry with no overlay. |
| 3. Imported picture labelled "Photo you took of the card" | Label is now "Card photo" (`src/app/manual-entry.tsx`). | Emulator: label reads "Card photo". |
| 4. Extra "Done" tap in the photo picker | No change: `expo-image-picker` already uses Android's single-photo picker (`PickVisualMedia`); the "Done" step is the newer Android system picker's own UI. | Checked in `expo-image-picker` source. |

Gates after the fixes: `tsc` PASS, `expo lint` PASS, OCR fixtures 13/13.

### Cloud OCR fallback for Expo Go, iPhone and web (2026-11-07)

Tested on an iPhone in Expo Go (no paid Apple account): Scan went straight to Manual
entry because Expo Go has no `expo-text-extractor`. To read cards there too:

- New `src/services/cloud-ocr.service.ts`: shrinks the photo to a 1200 px JPEG
  (`expo-image-manipulator`, included in Expo Go) and sends it to the OCR.space free API
  (25,000 requests a month, 1 MB limit). Lines go through the same `parseOcrLines`.
- `src/services/ocr.service.ts`: on-device OCR first; the cloud fallback only when the
  native module is missing. Cloud failures (network, timeout 20 s, API error) end on
  Manual entry with the photo, as before.
- Config: `EXPO_PUBLIC_OCR_SPACE_KEY` in `.env.local` (free key from ocr.space; without
  it the shared, rate-limited demo key `helloworld` is used). `EXPO_PUBLIC_CLOUD_OCR=off`
  disables the fallback. The key ships inside the bundle, so it is for testing only.
- Privacy: in Expo Go and on web the photo leaves the device. Development and release
  builds keep on-device OCR and never call OCR.space.

Verified: `tsc` PASS, `expo lint` PASS; OCR.space demo key returns text for a card
photo via curl. On-phone check pending (owner).

## Collector roadmap (2026-11-07)

Plan: `design/plans/collector-roadmap.html` (published as the "PokeWorth Collector
Roadmap" artifact). It brings the portfolio, card detail, search and overview features
from five Collectr reference screenshots into PokeWorth's own navy-and-gold design.

### Decisions (owner, 2026-11-07)

1. **Price history:** daily snapshots on the device first (P7). A scheduled server job
   only if charts feel too thin later.
2. **Graded cards:** manual entries (grader, grade, cert number, own value) plus the eBay
   sold-listings link. No graded market prices or population until a data source exists.
3. **Tab bar / P3 layout:** Home, Search, centre Scan button, Portfolio, Profile. This
   replaces the open r1 / r2 choice; Shop and Social are out of scope.
4. **Portfolios:** storage v1 supports several portfolios from the start; the UI shows
   "Main" until the user creates another.

### Step 1 · Tabs and tokens (branch `feat/collector-tabs`)

- `src/theme/tokens.ts`: colours, spacing, radius and type from `design/home-spec.md` §2.
- `src/components/icons.tsx`: line icons drawn with `react-native-svg` (added with
  `npx expo install`; included in Expo Go).
- `src/app/(tabs)/`: Home (scan button, Search Manually, recent scans), Search (name or
  number, camera button, 2-column grid), Portfolio (placeholder until step 4), Profile
  (version, data sources, disclaimer). The centre Scan button opens `/scan` above the tabs.
- Root layout is dark-only with a light status bar; Confirm and Card Details text colours
  fixed for the dark theme.

Verified in Chrome at 375 × 812: tabs switch, centre button opens Scan, Search for
"Charizard" returns a grid, Card Details reads on the dark theme. `tsc` PASS,
`expo lint` PASS. Owner checked it on the phone: "Looks great".

### Step 2 · Card detail (P2.2, P2.3)

- `src/services/printings.service.ts`: one entry per printing from TCGdex
  `variants_detailed` (e.g. Holofoil, Holofoil · Shadowless · 1st Edition, Reverse Holo),
  each with only its own prices. TCGplayer market price first, then the Cardmarket trend;
  Cardmarket `-holo` keys go to the reverse holo only (AC-P2.7). Change of today's
  Cardmarket figure against its 7- and 30-day averages. Cards without
  `variants_detailed` fall back to the old flat price rows.
- `src/app/result.tsx` + `src/components/card-detail.tsx`: blurred-artwork hero under a
  see-through header (tap for full screen), name / set / rarity · number, printing chips
  above the price (AC-P2.4), price card with provider, currency and date (AC-P2.5),
  "No price available" state (AC-P2.6), "View Sold Listings on eBay" (in-app browser),
  card facts (HP, type, stage, rarity, illustrator, set, number).
- `scripts/pricing-fixtures.ts`: 12 offline checks on trimmed real responses, including
  Base Set Charizard holo = TCGplayer $987.13 and the 1st Edition shadowless printing.

Not in this step (later roadmap steps): price chart (P7), graded tab (P8), add to
portfolio and favourites (step 4), tappable set name (step 3).

Verified in Chrome at 375 × 812 on `base1-4`: hero, $987.13 TCGplayer + €353.78
Cardmarket with +13.4 % / −17.8 % changes, switching to 1st Edition shows €3,489.25,
facts list. `tsc` PASS, `expo lint` PASS, pricing fixtures 12/12. On-phone check pending
(owner).

### Step 3 · Search and sets (P2.4)

- `src/app/sets.tsx`: every physical set, newest first (TCGdex lists oldest first; TCG
  Pocket sets are left out), with logo, card count and a name filter. Promo sets without
  a printed total show how many cards exist.
- `src/app/sets/[id].tsx`: set logo, series, release date, card count (+ secret cards)
  and the set's cards in a 2-column grid.
- Search tab: "Show Sets" button; the card grid is now the shared
  `src/components/card-tile.tsx`, also used by set pages.
- Card Details: the gold set name opens that set.
- `tcgdex.service.ts`: `listSets`, `getSet`, `setLogoUrl` (WebP, about 4× smaller than
  PNG). Hooks `useSets` (6 h cache) and `useSet` (1 h).

Verified in Chrome at 375 × 812: Search → Show Sets lists sets newest first with logos;
filter "Base Set" leaves 3; Base Set page shows "Base • January 9, 1999 • 102 cards" and
its cards; Charizard → tapping "Base Set" opens `/sets/base1`. `tsc` PASS,
`expo lint` PASS, OCR 21/21, pricing 12/12. On-phone check pending (owner).

### Step 4 · Portfolio (P5.1–P5.5)

- `src/services/collection.model.ts` (pure, tested): storage v1 `pokeworth.collection.v1`
  with several portfolios ("Main" first), one entry per card + printing + portfolio,
  quantity 1–999, condition (Near Mint by default), a price snapshot and favourites.
  Corrupt or wrong-version data loads as an empty collection (AC-P5.1). Totals are kept
  per currency and never added across currencies; unpriced copies are counted separately
  (AC-P5.4). CSV export.
- `src/services/collection.service.ts`: AsyncStorage load/save; writes run one at a time.
  `src/hooks/use-collection.ts`: shared cache with instant (optimistic) updates.
- Card Details: "Adding to: Main" with a −/qty/+ stepper per printing and a running
  total (AC-P5.2), favourite star.
- Search and set grids: quick + adds one copy of the card's main printing; tiles show
  the owned quantity.
- Portfolio tab: search, favourites filter, portfolio switcher (create a new one),
  total per currency with hide/show, card count and unpriced count, Select → Remove
  (tap twice) / Move to another portfolio, Export (share sheet, CSV), sort by value or
  newest, pull-to-refresh prices through the query cache (AC-P5.5).
- Home: portfolio total and Most Valuable (top 4) with View All.
- `scripts/collection-fixtures.ts`: 21 offline checks.

Verified in Chrome at 375 × 812: steppers on `base1-4` give 2 × Holofoil + 1 × 1st
Edition and "Total $1,974.26 + €3,489.25"; quick + on Blastoise gives "Qty: 1"; Portfolio
lists 3 entries with "$2,203.55 + €3,489.25 · 4 cards"; Select → Remove (twice) removes
Blastoise; Home shows Most Valuable; data survives a page reload (AC-P5.6). `tsc` PASS,
`expo lint` PASS, fixtures OCR 21/21, pricing 12/12, collection 21/21, iOS bundle builds.
Not exercised in the browser: the portfolio switcher UI, Move, Export (share sheet) and
pull-to-refresh (logic covered by fixtures). On-phone check pending (owner).

Known limits: totals in USD and EUR are shown side by side until currency conversion
(step 5); "By value" sorting compares amounts without converting currencies.

### Step 5 · History, movers and currency (new P7)

- `src/services/history.model.ts` (pure, tested): `pokeworth.history.v1`, one point per
  day per printing (`cardId|printingId`) and per portfolio (totals per currency), capped
  at 730 days and 1,500 series. Nothing is back-filled: TCGdex has no history, so charts
  start on the day a card is first seen on this phone. A change of currency restarts a
  series.
- Recording: opening Card Details records today's price of each printing; every saved
  collection change records today's portfolio value; once per calendar day (first open,
  or returning to the app on a new day) all owned cards are refreshed and recorded
  (`runDailySnapshot`, `useDailySnapshot` in the tabs layout); pull-to-refresh records too.
- `src/components/price-chart.tsx`: line + area chart with low/high guides, start/end
  dates, change over the range, 1M · 3M · 6M · 12M · MAX pills, and plain empty /
  one-day states. Shown on Card Details for the selected printing and on Home for the
  portfolio.
- Currency: `src/services/currency.model.ts` (pure, tested) and `fx.service.ts` (ECB rate
  via `api.frankfurter.dev/v1`, checked 2026-11-07: free, no key, CORS `*`, last rate kept
  for offline). Profile → "Currency for totals": USD (default), EUR or Original. Portfolio
  and Home totals convert and show the rate and its date; card prices keep their source
  currency. "By value" sorting now compares in USD.
- Movers (Home): owned printings that moved most against their 30-day Cardmarket average
  (stored with each price snapshot as `vs7d` / `vs30d`).
- `scripts/history-fixtures.ts`: 24 offline checks.

Verified in Chrome at 375 × 812: opening Home ran today's snapshot (3 printing series +
portfolio point, `lastDaily` 2026-11-07); Home total $5,870.01 with "converted at
€1 = $1.1165 (ECB, 2026-11-06)"; Movers +42.1 % / −17.8 %; one-day chart says history
starts today; with six injected sample points (removed afterwards) the Card Details
chart draws with guides $902.50 / $987.13 and +9.4 % 1M; EUR setting gives €5,257.51.
`tsc` PASS, `expo lint` PASS, fixtures OCR 21/21, pricing 12/12, collection 21/21,
history 24/24, iOS bundle builds. On-phone check pending (owner).

Known limits: past days' portfolio values are converted at today's rate; the per-card
"Adding to" total on Card Details is not converted.
