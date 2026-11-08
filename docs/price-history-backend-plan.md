# Price history backend: plan (step 2)

Status: plan only, nothing built. Step 1 (seeding from Cardmarket averages) is done.
Out of scope: graded prices, population, gem rate (no data source; decided not to pursue).

## Problem
History lives only on the phone and starts the day a card is first opened (step 1 adds
~3 estimated points from Cardmarket's 1/7/30-day averages). A new user, or a card nobody
opened yet, has a short chart. Collectr-style apps have the full series ready because a
server records prices every day for every card.

## Goal
Opening any card shows its real daily price history back to the day the server started
recording, the same for every user. No accounts needed.

## Design
- **Supabase (already linked to this workspace)**
  - Table `price_points(card_id text, printing_id text, day date, amount numeric,
    currency text, provider text, primary key (card_id, printing_id, day))`.
  - RLS: anonymous read-only (select); writes only with the service role (the job).
- **Daily job** (Supabase scheduled Edge Function, or pg_cron + Edge Function)
  1. Fetch current pricing from TCGdex for each card and run the same printing/price rules
     as `printings.service.ts` (share the code or port it; one source of truth).
  2. Upsert one row per printing for today.
  - Open question to check first: TCGdex has no bulk-price endpoint, so a full pass is one
    request per card (~20k). Needs a rate-limit check and probably batching over several
    runs, or recording only cards that users have opened/owned (prioritised list).
- **App** (`use-history.ts`)
  - On card open: `select day, amount, currency from price_points where card_id=… and
    printing_id=… order by day`, cached with TanStack Query.
  - Merge with local points; server wins for days it has. Local seeded estimates are
    dropped for any day the server has a real point.
  - Offline or server error: fall back to local history as today (feature must not break).
  - Opened cards the server doesn't track yet: app calls an Edge Function `track(card_id)`
    that adds the card to the tracked list, so it is recorded from then on.
- **Privacy:** no user ids or collection data sent, only card ids.

## Steps
1. Check TCGdex rate limits and decide full pass vs tracked-only (half a day).
2. Create table, RLS and the Edge Function with the daily schedule; run it manually once.
3. Add the read path and merge rule to the app, with fixtures for the merge (pure function
   in `history.model.ts`, like `seedPoints`).
4. Backfill nothing; accept that history starts when recording starts.
5. Verify on device: a card never opened before shows several days after the job has run
   for a few days; airplane mode still shows local data.

## Costs and risks
- Supabase free tier: ~20k rows/day is ~7M rows/year, too big for the free database
  (500 MB). Mitigations: track only requested cards, or keep daily rows for 1 year and
  weekly after.
- Price source stays TCGdex; if its pricing is empty for a card there is no series.
- Needs the Supabase project to exist and the user's approval before creating tables.
