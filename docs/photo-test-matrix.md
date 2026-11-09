# Photo test matrix (P4.6)

Run on the Android emulator (webcam or imported photos) and record the result in the last column.
"Expected" is the outcome the app must reach; it never shows a wrong card as sure.

| # | Condition | Expected | Result |
|---|---|---|---|
| 1 | Flat card, even light, centred in the guide | Name and number read; one confident match | |
| 2 | Glare across the name | Candidates list or manual entry; never a silent wrong card | |
| 3 | Blurry (motion) photo | "Could not read" or manual entry with the photo | |
| 4 | Card at an angle (about 20°) | Read, or manual entry; no crash | |
| 5 | Dark or busy background (cloth, wood) | Read, or manual entry | |
| 6 | Card in a sleeve or toploader | Read; reflections may lower confidence (Check, not Sure) | |
| 7 | Holo or full-art card | Name read from the top line; printing chosen on Card Details | |
| 8 | Promo number (SWSH284, SVP 085) | Number parsed; candidates found | |
| 9 | Non-card photo (a table) | No match; manual entry offered | |
| 10 | Binder page 3×3, even light | At least 7 of 9 names right; unsure ones are Check, never ticked | |
| 11 | Binder page with glare or a cut-off column | Empty or Not found pockets are honest; nothing wrong is Sure | |
| 12 | Airplane mode after the photo is taken | Friendly offline message with Retry | |
