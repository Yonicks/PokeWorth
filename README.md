# PokeWorth

Scan an English Pokémon trading card, identify its exact print, and see an estimated market price.

**Stack:** React Native · Expo (SDK 58) · TypeScript · Expo Router · TanStack Query · [TCGdex API](https://tcgdex.dev)

## How it works

1. **Scan Card** — photograph the card with `expo-camera`.
2. **On-device OCR** — `expo-text-extractor` reads the card name and collector number (e.g. `4/102`). Photos never leave the device.
3. **Matching** — candidates from the TCGdex catalog are ranked by name similarity, collector number, and printed set size (`src/services/card-matcher.service.ts`).
4. **Confirm** — ambiguous matches are shown for manual selection; a confident match skips straight to the result.
5. **Price** — Cardmarket/TCGplayer market estimates with provider, currency, and freshness. Missing prices are shown explicitly, never invented.

Manual name search is always available as a fallback, and recent scans are kept locally (AsyncStorage).

## Running it

```bash
npm install
npx expo start
```

> **OCR requires a development build.** The native text-recognition module does not exist in Expo Go, so scanning falls back to a notice there. Build with:
>
> ```bash
> npx expo run:android   # or: npx expo run:ios (macOS only)
> ```
>
> Everything else (manual search, matching, prices, history) works in Expo Go.

## Verify the API integration

```bash
npx tsc scripts/smoke-test.ts --ignoreConfig --outDir .smoke --module commonjs --target es2021 --moduleResolution node --esModuleInterop --skipLibCheck
node .smoke/scripts/smoke-test.js
```

## Project layout

```
src/
├── app/            # Expo Router screens: index (home), scan, confirm, result
├── services/       # ocr, tcgdex, card-matcher, storage (swappable interfaces)
├── hooks/          # TanStack Query hooks
├── types/          # Card / pricing / scan types
└── utils/          # text normalization + fuzzy matching
```

See `pokeworth-high-level-plan-20-10-2026.md` for the full plan.
