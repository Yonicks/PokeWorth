# PokeWorth — Home Screen Design Spec (Phase A)

Status: **analysis only — no code written yet.**
Sources of truth (both versioned in the repo):

| ID | File | Size |
|---|---|---|
| **R1** | `design/v1/reference/home-reference1.png` | 853 × 1844 px |
| **R2** | `design/v1/reference/home-reference2.png` | 852 × 1846 px |

> ⚠️ **Blocking decision:** the two references are *different layouts*, not two states of one screen (different hero, CTA layout, recent-scan presentation and tab bar). One must be chosen before Phase B. Both are specified below so the choice can be made from this document. Shared tokens are in §2.

---

## 1. Measurement system

- Both images map to an **iPhone 15/16 Pro logical canvas of 393 × 852 pt** → scale **≈ 2.17 px/pt**.
- All values below are given as **pt** (logical, what goes in `StyleSheet`), with source pixels in brackets where useful: `26 pt [56 px]`.
- Measurements are taken by eye plus pixel sampling (edge detection along fixed columns, region color sampling). Expect **±1 pt** on positions, **±1 pt** on font sizes. Font sizes are derived from cap height (cap ≈ 0.70 × font size for SF Pro).
- Vertical positions are given **from the top of the image**. In the implementation, everything below the status bar must be laid out relative to `useSafeAreaInsets().top`, not to absolute y (iPhone 15 Pro top inset = 59 pt; the reference's status bar text sits at ~18 pt).
- Content side gutter: **R1 = 26 pt [56 px]**, **R2 = 18 pt [40 px]**.

---

## 2. Shared design tokens

Colors sampled from the PNGs (averaged 3×3, or the brightest-quartile pixels for anti-aliased text).

### 2.1 Color

| Token | Hex | Where observed |
|---|---|---|
| `bg.top` | `#001643` (R1) / `#021225` (R2) | Top of screen |
| `bg.base` | `#031229` | Mid-screen, main canvas |
| `bg.bottom` | `#0C1C33` – `#101D2E` | Behind tab bar |
| `surface.card` | `#0A1A30` | Recent-scan cards (R1), list rows `#05162B` (R2) |
| `surface.raised` | `#12243B` | Search Manually button (R1), tiles `#091C33` (R2) |
| `border.subtle` | `#1E3150` @ ~1 pt | Card / tile / row outlines (lighter than surface, cool blue) |
| `gold.300` | `#FDDF6F` | CTA gradient top |
| `gold.400` | `#FDCB56` | CTA gradient middle |
| `gold.500` | `#FEBD3D` | CTA gradient bottom, R2 tab underline `#FDBF3D` |
| `gold.text` | `#FEDF4E` | “Pokémon” headline word, “Worth” wordmark (`#FEDB52`), step icons (`#FEE44D`) |
| `price` | `#FEE144` (R1) / `#FEEE61` (R2) | Price figures |
| `text.primary` | `#FEFEFE` | Headlines, card names, button labels |
| `text.secondary` | `#CDD9EC` / `#C0CEE2` | Subtitles, set names |
| `text.tertiary` | `#A9B9D3` | Timestamps, promo subtitle |
| `text.onGold` | `#0B0B0D` (approx.) | “Scan Card” label & camera icon on yellow |
| `tab.inactive` | `#B0C0DA` / `#C2D3EA` | Inactive tab icon + label |
| `tab.active` | `#FEE544` | Active tab |
| `link.blue` | `#2BB1FE` | **R1 only** — “See All” |
| `link.gold` | `#FEF059` → use `gold.text` | **R2 only** — “See All” |
| `glow.gold` | `#FDCB56` @ 35–50 % | Outer glow around CTA / FAB |

The theme is **dark-only**. `app.json` currently has `userInterfaceStyle: "automatic"` and the root layout switches `DarkTheme/DefaultTheme`; Home must render dark regardless of system theme.

### 2.2 Typography

No custom font is bundled. Body text in both references reads as **SF Pro (iOS system)**; use the platform system font (Roboto on Android) unless a brand font is supplied.

| Token | Size / line-height (pt) | Weight | Used for |
|---|---|---|---|
| `display.wordmark` | R1 32 / 36 · R2 42 / 46 | 800 | “PokeWorth” (see §5 uncertainty U3) |
| `display.hero` | R1 28 / 29 (3 lines, tight) | 800 | R1 headline |
| `title.hero` | R2 20 / 24 | 600 | R2 headline (2 lines) |
| `body.hero` | R1 14 / 17 · R2 15 / 18 | 400 | Hero subtitle |
| `button.xl` | 26 / 30 | 700 | “Scan Card” |
| `button.lg` | 17 / 22 | 500 | “Search Manually” (R1) |
| `section.title` | 20 / 24 | 700 | “Recent Scans” |
| `link` | 16 / 20 | 500 | “See All” |
| `card.title` | 16 / 20 (R1) · 17 / 22 (R2) | 600 | Card name |
| `card.meta` | 14 / 18 (R1) · 15 / 19 (R2) | 400 | Set, number, rarity |
| `price` | 18 / 22 (R1) · 20 / 24 (R2) | 700 | Price, tabular figures |
| `caption` | 13 / 16 | 400–500 | Step labels, tab labels, tile subtitles |

### 2.3 Spacing, radius, elevation

- Spacing scale used: **4, 8, 10, 12, 16, 18, 24, 26** pt.
- Radius: CTA **14 pt** (R1) / **18 pt** (R2); secondary buttons, tiles, rows, cards, banners **12 pt**; step-icon tiles **8 pt**; card thumbnails **4 pt**.
- CTA glow: gold shadow, radius ~16 pt, opacity ~0.45, no offset (`boxShadow` on new arch; verify against RN 0.88 docs).
- Borders: 1 pt `border.subtle` on all dark surfaces; CTA has a 1 pt lighter top highlight (`#FFF1B0` @ ~60 %).

---

## 3. R1 — “Pikachu hero / horizontal cards”

Sections from top to bottom (pt from image top; px in brackets).

| # | Section | y range (pt) | Notes |
|---|---|---|---|
| 0 | Status bar | 0 – 42 [0–90] | System. Light content. |
| 1 | Header | 46 – 81 [100–175] | Logo + wordmark left, gear right |
| 2 | Hero text | 115 – 237 [250–515] | Headline + subtitle, left column ~200 pt wide |
| 3 | Step row | 252 – 295 [548–640] | 4 steps with arrows |
| 4 | Hero art | 60 – 315, x 220 – 393 | Pikachu + card backs + gold swirl, bleeds right edge, sits **behind** sections 2–3 |
| 5 | Scan Card CTA | 316 – 384 [686–834] | Primary button |
| 6 | Search Manually | 397 – 452 [860–980] | Secondary button |
| 7 | Recent Scans header | 468 – 486 [1015–1055] | Title + “See All ›” |
| 8 | Recent cards carousel | 494 – 680 [1072–1475] | Horizontal scroll |
| 9 | Build Your Collection banner | 697 – 763 [1512–1655] | Promo card |
| 10 | Tab bar (floating) | 772 – 829 [1675–1798] | 3 tabs |
| 11 | Home indicator | ~840 | System |

**1 Header** — Logo mark 35 × 35 pt [77 px] at x 26; wordmark starts x 73 pt, “Poke” `text.primary` + “Worth” `gold.text`, baseline aligned to mark center. Gear: 22 pt outline icon, `text.primary`, right edge at x 367 pt (26 pt gutter), vertically centered with the mark, no background.

**2 Hero text** — Headline 3 lines: “Find the value / of your **Pokémon** / cards”; “Pokémon” in `gold.text`. Explicit line breaks (do not rely on wrapping). Starts y 115 pt, x 26. Subtitle 2 lines in `text.secondary`, y 207 pt, max width ~195 pt: “Scan a card, identify the exact print, / and view current market prices.”

**3 Step row** — 4 items centered at x ≈ 45, 102, 158, 215 pt (pitch 57 pt). Each: 26 × 26 pt tile, 1.5 pt `gold.text` stroke, radius 8, transparent fill, 16 pt gold icon inside (camera, magnifier, checkmark, dollar). Label 13 pt `text.primary`, 6 pt below tile. Between tiles: 12 pt `→` arrow in `#D0D6E5`, vertically centered on the tile.

**4 Hero art** — Separate image layer, absolutely positioned, `pointerEvents="none"`, z-order below text. Composition: two tilted Pokémon card backs (top right), Pikachu waving (center right, ~170 pt tall), gold light swirl from bottom-left of art to card backs, sparkle particles. Gold light streak also crosses the background at y ~280 pt from x 0 (part of background layer).

**5 Scan Card CTA** — x 26 → 367 (341 × 68 pt), radius 14. Vertical gradient `gold.300 → gold.400 → gold.500`, outer gold glow. Content centered as a group: camera glyph 44 × 36 pt `text.onGold` (filled body, gold lens ring), 20 pt gap, “Scan Card” `button.xl`. Chevron 14 pt, 2.5 pt stroke, at right inset 22 pt.

**6 Search Manually** — x 26 → 367 (341 × 55 pt), radius 12, fill `surface.raised` with subtle top-to-bottom lightening, border 1 pt `border.subtle`. Content centered: magnifier 24 pt outline white, 20 pt gap, “Search Manually” `button.lg` white. Chevron 12 pt at right inset 22 pt.

**7 Recent Scans header** — “Recent Scans” `section.title` at x 26. “See All” `link` in **`link.blue`** + chevron, right-aligned to x 370.

**8 Carousel** — Horizontal `FlatList`, content inset 26 pt left, item gap 8 pt, last card peeks to the screen edge (4th card is at x 302 → 384). Card 86 × 186 pt, radius 8, fill `surface.card`, border 1 pt `border.subtle`. Inside (8 pt padding): thumbnail 72 × 97 pt (≈ 0.74 aspect — real cards are 63:88 = 0.716; use 0.716 and let width drive), radius 4. Then, 8 pt below: name `card.title` white (1 line, truncate), set `card.meta` `text.secondary`, number `card.meta` `text.secondary`, 6 pt gap, price `price` in `price` color, time `caption` `text.tertiary`.

**9 Collection banner** — x 26 → 367 (341 × 66 pt), radius 12, `surface.card` + border. Left: stacked-cards illustration ~55 × 52 pt (three navy cards, front one with a gold card outline). Title “Build Your Collection” 18 pt 700 white at x 113 pt; subtitle 2 lines 14 pt `text.tertiary` “Save your cards and track / your total value.” Right: faded collage of card backs (≈ 40 % opacity, fades to left), chevron 12 pt white at right inset 18 pt.

**10 Tab bar** — Floating pill, x 8 → 385 (377 × 57 pt), radius 16, fill `#0D1D34` @ ~92 % with 1 pt `border.subtle`, sits above home indicator (bottom inset). 3 equal tabs: **Home** (filled house, `tab.active`), **Collection** (outline cube/box, `tab.inactive`), **Search** (magnifier, `tab.inactive`). Icon 26 pt, label 13 pt, 4 pt gap.

**Background (R1)** — Radial navy gradient, brightest `#001643` near top center, falling to `#031229`; faint, heavily blurred card fronts/backs at top-left, mid-left and bottom edges (≈ 20–30 % opacity), gold light streak around y 280. Must be a separate decorative layer, not the screenshot.

---

## 4. R2 — “Card-back hero / list rows / center FAB”

| # | Section | y range (pt) | Notes |
|---|---|---|---|
| 0 | Status bar | 0 – 42 | System |
| 1 | Decorative Pokéball ring | 0 – 70, x 152 – 295 | Watermark, outline only, gold arc highlight on right |
| 2 | Settings button | 53 – 85 [115–185] | Circular |
| 3 | Logo lockup | 71 – 124 [155–270] | Large |
| 4 | Hero text | 138 – 228 [300–495] | Title 2 lines + subtitle 2 lines |
| 5 | Hero art | 100 – 258, x 194 – 393 | Stack of 3 tilted Pokémon card backs with gold rim glow, behind CTA top edge |
| 6 | Scan Card CTA | 263 – 348 [571–755] | Two-line button |
| 7 | Quick action tiles | 367 – 430 [796–933] | 2 tiles side by side |
| 8 | Recent Scans header | 458 – 474 [995–1030] | Title + gold “See All ›” |
| 9 | Recent list | 488 – 733 [1059–1591] | 3 rows |
| 10 | Tab bar (docked) | 756 – 852 [1640–1846] | 4 tabs + center FAB |

**2 Settings** — 32 pt circle at right edge x 343 → 375 pt, fill `#0F2035`, 1 pt `border.subtle`, 18 pt filled gear white.

**3 Logo lockup** — Mark 52 × 52 pt [112 px] at x 18; wordmark 42 pt 800, starts x 77, “Poke” white with slight cool gradient, “Worth” `gold.text`. Lockup spans x 18 → 276 pt.

**4 Hero text** — Title “Find the value of your / Pokémon cards” `title.hero` white, y 138. Subtitle “Scan a card, identify the exact print, / and view current market prices.” `body.hero` `text.secondary`, y 198. Both left at x 20, max width ~200 pt.

**6 Scan Card CTA** — x 18 → 375 (357 × 85 pt), radius 18, gold gradient + glow, faint Pokéball watermark (white @ ~12 %) at right x 268–375. Camera glyph 50 × 40 pt at x 42. Text block at x 114: “Scan Card” `button.xl` `text.onGold`; 6 pt below “Take a photo to identify & value” 16 / 20, 400, `text.onGold`. Chevron 12 pt at right inset 24 pt.

**7 Tiles** — Two equal tiles, gap 10 pt: x 18 → 192 and 201 → 375, height 63 pt, radius 14, fill `surface.raised` + border. Each: outline icon 23 pt white at inset 14 pt; title 17 pt 600 white; subtitle 13 pt `text.secondary`; chevron 12 pt right inset 14 pt. Left: magnifier · “Search Manually” · “Find a card by name or set”. Right: cube · “My Collection” · “View your cards”.

**8 Header** — “Recent Scans” `section.title` x 20; “See All ›” in **gold**, right-aligned to x 372.

**9 Recent list** — 3 rows, each 357 × 75 pt, gap 10 pt, radius 12, fill `#05162B` + border. Thumbnail 50 × 63 pt at inset 9 pt, radius 4. Text column at x 90: name 17 pt 600 white; set 15 pt `#DBE7F9`; meta “223/191 • Special Illustration Rare” 14 pt `text.secondary` (bullet U+2022 with spaces). Right column right-aligned at x 334: price `price` 20 pt 700; time 15 pt `text.secondary`. Chevron 12 pt at right inset 18 pt.

**10 Tab bar** — Docked to bottom, full width, top corners radius 20, fill `#041529`, top border 1 pt `border.subtle`, a **concave cradle** cut around the FAB. FAB: 61 pt circle centered x 196, center y ~776 pt (protrudes ~20 pt above the bar), gold radial/vertical gradient, gold glow ring, 26 pt filled camera `text.onGold`. 4 tabs, 2 each side: **Home** (active, filled house `tab.active`, 37 × 2 pt gold underline 6 pt below label), **Collection** (cube), **Search** (magnifier), **Stats** (bar chart). Icon 24 pt, label 13 pt.

**Background (R2)** — Flat-to-radial navy `#021225 → #0C1C33`, no blurred card collage; only the Pokéball ring watermark at top.

---

## 5. Asset inventory

### 5.1 Existing assets in the repo

| Asset | Path | Usable for Home? |
|---|---|---|
| App icons / splash (Expo template) | `assets/images/icon.png`, `splash-icon.png`, `android-icon-*` | ❌ Expo template art, not PokeWorth branding |
| `logo-glow.png` | `assets/images/logo-glow.png` (604², blue blur) | ❌ Blue; wrong hue. Could be recolored but a gradient/shadow is cleaner |
| Tab icons `home.png`, `explore.png` | `assets/images/tabIcons/` | ❌ Template icons; don't match the designs |
| React / Expo logos, `tutorial-web.png` | `assets/images/` | ❌ Unrelated |
| Card images | **Runtime** via TCGdex (`cardImageUrl()` in `src/services/tcgdex.service.ts`) | ✅ For thumbnails — real data only |
| Reference PNGs and mocks | `design/v1/reference/*`, `docs/v1/mocks/*` | 🚫 Reference only — never shipped or used as background |

### 5.2 Required assets — status

| # | Asset | Used in | Status | Plan |
|---|---|---|---|---|
| A1 | PokeWorth logo mark (gold/white split ball with center button) | R1, R2 header | **Missing** | Can be drawn as a vector (circles + paths). Needs `react-native-svg`. Get approval that a home-made vector is acceptable or obtain the original file. |
| A2 | “PokeWorth” wordmark | R1, R2 | **Missing** | Text with a font (see U3) or an SVG export from the designer. |
| A3 | **Pikachu hero illustration** with transparent background | R1 | **Missing — cannot be created here** | Pikachu is Nintendo / The Pokémon Company IP. Needs a licensed or commissioned asset. Until then: an empty, clearly marked placeholder layer; **no substitute character art**. |
| A4 | Pokémon card-back stack (with “Pokémon” logo) | R1 (behind Pikachu), R2 hero, R1 promo collage | **Missing** | The official card back and logo are trademarked artwork. Needs a supplied asset. Placeholder: neutral navy card shapes, no logo. |
| A5 | Gold light swirl / sparkles / light streak | R1 hero + background | **Missing** | Supplied PNG (transparent) preferred; an approximate vector/gradient version is possible but will not match pixel-for-pixel. |
| A6 | Blurred background card collage | R1 background | **Missing** | Supplied PNG. Low priority; omit if unavailable. |
| A7 | Pokéball watermark ring | R2 top + CTA | **Missing** | Simple geometry — can be drawn as SVG. |
| A8 | Stacked-cards illustration | R1 promo banner | **Missing** | Can be drawn as SVG (3 rounded rects + gold outline). |
| A9 | UI icons: camera, magnifier, check, dollar, chevron, arrow, gear, house (filled), cube, bar chart | Both | **Missing as files** | `expo-symbols` is installed (SF Symbols on iOS; Material Symbols font is present in `node_modules`). Verify Android/web support for SDK 58 in Phase B; otherwise draw with `react-native-svg`. The R1 camera glyph (filled body, gold ring lens) needs a custom SVG either way. |
| A10 | Card thumbnails for **demo** data (Charizard ex, Pikachu, Mewtwo, Umbreon) | Recent scans | **Not needed as files** | Load from TCGdex by real card ID; demo data must reference real IDs (see U5). |
| A11 | Brand fonts | Wordmark, headline | **Missing** | See U3. |

### 5.3 Missing libraries (not installed)

| Need | Candidate | Note |
|---|---|---|
| SVG logo / icons / watermark | `react-native-svg` | Install with `npx expo install` |
| Gradients (CTA, background) | `expo-linear-gradient` **or** RN `experimental_backgroundImage` | Check RN 0.88 / SDK 58 docs before choosing |
| Blur behind floating tab bar | `expo-blur` or `expo-glass-effect` (installed) | Optional; R1 tab bar looks translucent |
| Custom font | `expo-font` (installed) + font files | Only if a brand font is provided |

---

## 6. Current repo vs. target — gaps

1. **Navigation**: `src/app/_layout.tsx` is a single `Stack` (`index`, `scan`, `confirm`, `result`) with a default header titled “PokeWorth”. Both designs need a **tab navigator** (Home / Collection / Search [/ Stats]) with Home's header hidden, and `scan/confirm/result` kept as stack screens above the tabs. Proposed: `src/app/(tabs)/_layout.tsx` + `(tabs)/index.tsx`, `(tabs)/collection.tsx`, `(tabs)/search.tsx`; existing flow screens stay where they are.
2. **Search Manually**: today it's an inline `TextInput` that pushes `/confirm?name=`. The design shows a button — it should navigate to a Search screen (which can reuse the same `/confirm` path for results). Search is P0 in the plan.
3. **Recent Scans / See All**: no history screen exists; `getRecentScans()` returns up to 25. Needs a `recent` (or `history`) route.
4. **Collection**: P1 in the plan; no storage or screen yet. For Home, only a navigable placeholder screen is in scope.
5. **Data model**: `RecentScan` has no `price`, `rarity` or `setTotal`. The designs show price, “2h ago” and rarity. Demo pricing must live in a separate module (e.g. `src/demo/home-demo-data.ts`) behind an explicit flag, never mixed into `storage.service.ts` or real `RecentScan` records. Real recent scans without a stored price must render “—”, not a demo number.
6. **Theme**: dark-only design vs. `userInterfaceStyle: "automatic"`; splash background is `#208AEF` (template blue). Changing `app.json` is out of scope unless approved.
7. **Status bar**: root uses `<StatusBar style="auto" />`; Home needs `light`.

---

## 7. Visual uncertainties — need answers before Phase B

| ID | Question | Default if unanswered |
|---|---|---|
| **U1** | **Which reference is the target: R1 or R2?** (Or a hybrid — e.g. R2 layout with R1 step row?) | Blocking. |
| U2 | Pikachu / card-back art (A3, A4): will licensed transparent PNGs be provided? | Ship clearly labeled placeholder layers; no character art. |
| U3 | Wordmark/headline font: the wordmark looks like a heavy geometric sans (rounded terminals) rather than SF Pro. Is there a brand font? | System font, weight 800. |
| U4 | R1 has a 3-tab floating bar; R2 has 4 tabs + center Scan FAB + a **Stats** tab. Is Stats in scope? (Not in the MVP plan.) | Follow chosen reference; Stats → placeholder screen. |
| U5 | Demo cards: R1 lists Pikachu “151 025/165”, R2 lists “151 173/165 Illustration Rare”; Charizard ex “Surging Sparks 223/191” may not correspond to a real print. Should demo data mirror the mock text exactly, or use real TCGdex cards so thumbnails/taps work? | Mirror the mock text, but resolve each to a real TCGdex image ID; flag mismatches. |
| U6 | When should demo data show? (Always in dev, only when history is empty, or never in production builds.) | Only when `__DEV__` **and** history is empty, with a visible “Demo” marker. |
| U7 | Tab bar translucency in R1: blur, or solid with opacity? | Solid `#0D1D34` @ 92 %. |
| U8 | R1 “See All” is blue while everything else is gold — intentional? | Follow reference exactly. |
| U9 | Exact device: references are 393 pt wide. Behaviour on narrow (375 pt, SE) and wide (430 pt) phones — scale hero art, keep gutters fixed? | Fixed gutters; hero art scales with width; CTA/buttons stretch. |
| U10 | Font sizes are derived from cap-height at ±1 pt. Is a Figma/source file available? | Use values in §2.2. |

---

## 8. Component breakdown (proposed for Phase B)

`src/components/home/` (outside `src/app/`):

- `HomeBackground` — gradient + decorative layers (absolute, `pointerEvents="none"`)
- `BrandHeader` — `LogoMark` (SVG) + wordmark + `SettingsButton`
- `HeroSection` — headline, subtitle, `StepRow` (R1) and `HeroArt` image slot
- `ScanCardButton` — gold gradient CTA (single- or two-line variant)
- `SecondaryActionButton` (R1) / `QuickActionTile` (R2)
- `SectionHeader` — title + “See All”
- `RecentScanCard` (R1 carousel) / `RecentScanRow` (R2 list)
- `CollectionPromoBanner` (R1)
- `PokeTabBar` — custom `tabBar` for Expo Router `Tabs` (floating R1 / docked + FAB R2)

Tokens: `src/theme/tokens.ts` (colors, type, spacing, radius from §2).
Demo data: `src/demo/home-demo-data.ts` (separate from `services/` and `types/card.ts`).
