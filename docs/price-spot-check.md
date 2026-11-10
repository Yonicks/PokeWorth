# Price spot-check sheet (P2, needs a person)

Generated 2026-11-10 from the app's own pricing code (`printingsFor` in
`src/services/printings.service.ts`) and live TCGdex data. Each row is the card's first
priced printing, with the price the app shows.

**How to check:** open the card on TCGplayer (search the name and set), find the same
printing (Holofoil, Normal, ...), and compare its **Market Price** with the App price. Mark
the last column. Prices move daily, so a few percent apart is normal; a different printing
or a very different number is a finding. For Cardmarket, compare the "Trend" price in EUR.

| Card | Set and number | Printing | Source | App price | Source date | Card id | Matches? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Charizard | Base Set 4/102 | Holofoil | TCGplayer | $987.13 | 2026-11-09 | base1-4 | |
| Blastoise | Base Set 2/102 | Holofoil | TCGplayer | $229.29 | 2026-11-09 | base1-2 | |
| Venusaur | Base Set 15/102 | Holofoil | TCGplayer | $137.47 | 2026-11-09 | base1-15 | |
| Pikachu | Base Set 58/102 | Normal | TCGplayer | $10.95 | 2026-11-09 | base1-58 | |
| Clefable | Jungle 1/64 | Holofoil | TCGplayer | $37.55 | 2026-11-09 | base2-1 | |
| Lugia | Neo Genesis 9/111 | Holofoil | TCGplayer | $526.98 | 2026-11-09 | neo1-9 | |
| Aerodactyl | Fossil 1/62 | Holofoil | TCGplayer | $37.91 | 2026-11-09 | base3-1 | |
| Charizard ex | 151 199/165 | Holofoil | TCGplayer | $292.69 | 2026-11-09 | sv03.5-199 | |
| Lugia V | Silver Tempest 186/195 | Holofoil | TCGplayer | $449.21 | 2026-11-09 | swsh12-186 | |
| Pikachu ex | Surging Sparks 238/191 | Holofoil | TCGplayer | $241.30 | 2026-11-09 | sv08-238 | |

Result: not yet recorded. When done, copy the outcome into `docs/status.md` (P2 section)
and mark the plan page.
