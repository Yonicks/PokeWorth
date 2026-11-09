# Maestro flows (P4.8)

Run against a development build on the Android emulator (`npx expo run:android`), from the repo root:

```bash
maestro test .maestro/
```

`appId` is `com.pokeworth.app`. They need the network (TCGdex) except E3 and E7's offline step.

| Flow | Covers | Status |
|---|---|---|
| `e3-permission-denied.yaml` | E3 | written, not run |
| `e4-manual-search.yaml` | E4 | written, not run |
| `e5-variant-choice.yaml` | E5 (printing chips before the price) | written, not run |
| `e7-offline.yaml` | E7 | written, not run |
| `e8-collection.yaml` | E8 | written, not run |
| `e9-recent-scans.yaml` | E9 | written, not run |

Not automated: E1 and E2 need a real camera or a photo in the picker; E6 needs a card with no market price.
Do those by hand with `docs/photo-test-matrix.md`.
