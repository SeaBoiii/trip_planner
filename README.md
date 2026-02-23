# Trip Planner

Mobile-first Trip Planner web app (Notion-like UI) built with React, TypeScript, Vite, and TailwindCSS. Everything runs in-browser and is GitHub Pages friendly (no backend).

## Quick Start

```bash
npm i -g pnpm
pnpm install
pnpm dev
```

Build:

```bash
pnpm build
```

Core tests:

```bash
pnpm --filter @trip-planner/core test
```

## Project Structure

```text
trip_planner/
|- apps/
|  `- notion/          # Main app UI (React/Vite)
|- packages/
|  |- core/            # Types, storage/migrations, services, calculations
|  `- ui/              # Shared UI components
`- .github/workflows/  # GitHub Pages deploy
```

## Major Features

- Trip/day/item itinerary planning (mobile-first, drag reorder mode)
- Structured location search (OpenStreetMap Nominatim) + free-text fallback
- Map view with pins, day filters, opening hours (best effort via Overpass/OSM)
- Routing/travel segments between consecutive located items:
  - inline travel rows (distance + duration)
  - Google Maps Platform Routes API (user-supplied browser key, stored locally only)
  - one `computeRoutes` call per day when using "Compute travel for this day"
  - per-segment mode overrides (Auto / Walk / Drive / Transit), persisted per day edge
  - straight-line fallback always available
  - optional route polylines on map
- Image attachments per item:
  - thumbnails in itinerary list
  - full image lightbox in item editor
  - stored in IndexedDB (not localStorage)
- Multi-currency item costs with trip base currency totals
- Frankfurter exchange-rate fetch + local cache + manual overrides
- Splitwise-style expense splitting:
  - participants
  - paid-by + split method (equal / shares / exact)
  - net balances + settlement suggestions
- Import/export:
  - JSON (trip data only)
  - ZIP (trip JSON + attachment blobs)

## Public APIs / Fair-Use Notes

This app uses public/community endpoints plus Google Maps Platform (for routing). Rate limiting and caching are implemented, but availability can vary.

- Geocoding: OpenStreetMap Nominatim (debounced + cached + 1 req/sec queue)
- Opening hours lookup: Overpass API (cached + rate limited)
- Routing: Google Maps Platform Routes API (`computeRoutes`) using a user-supplied browser API key
- Exchange rates: Frankfurter API (no API key)

Important:

- GitHub Pages cannot store secrets. The Google Maps browser key must be entered by the user in Settings and is stored locally only.
- Restrict the key in Google Cloud with:
  - HTTP referrer restriction: `https://seaboiii.github.io/trip_planner/*`
  - API restrictions: allow only `Routes API`
- Enable billing and the Google Maps Platform `Routes API` in your Google Cloud project.
- Routing is computed on-demand only (explicit "Compute travel for this day") and cached to reduce quota/cost usage.
- Mixed-mode days (segment overrides) may trigger additional per-segment `computeRoutes` calls beyond the default day-level call.

## Attachments Storage

- Item attachment refs are stored in the main JSON state (`item.attachments`).
- Image blobs are stored in IndexedDB (`trip_planner` DB, `attachments` store):
  - thumbnail blob (compressed)
  - full blob (compressed)
- JSON exports do not include attachments.
- ZIP exports include `trip.json` plus `attachments/` blobs and metadata.

## Currency + Split Details

- Trip has a `baseCurrency`.
- Each item cost is `Money` (`{ amount, currency }`).
- Budget totals and split calculations convert into the trip base currency using stored exchange rates.
- Missing exchange rates cause affected items to be excluded from converted totals/split math and surfaced as warnings.

## Data Persistence / Schema

- Main state is stored in `localStorage` under `trip_planner_v1`
- Route cache and attachments are stored in IndexedDB
- Route cache entries are keyed per segment (coords + mode + traffic flag); transit uses a shorter cache TTL than walk/drive.
- Current JSON schema version: `6`

Migration coverage includes:

- legacy `item.location` string -> `item.locationText`
- legacy numeric `item.cost` -> `Money`
- legacy `trip.currency` -> `trip.baseCurrency`
- legacy `trip.defaultTravelMode` -> `trip.travelDefaults`
- legacy `day.travelPreferences.modeOverridesBySegmentKey` -> `day.travelOverrides`
- default participants/settings/routing/rates fields

## Tech Stack

- React 18 + Vite 5 + TypeScript
- TailwindCSS
- `leaflet` + `react-leaflet`
- `opening_hours`
- `@dnd-kit`
- `jszip`
- IndexedDB + localStorage

## Deploy to GitHub Pages

1. Push to `main`
2. Enable GitHub Actions deployment in repository Pages settings
3. Workflow builds and publishes the app

## Notes / Limitations

- Transit routing in Google Routes API is region/route-dependent; unavailable routes fall back to straight-line estimates plus deep links to Maps apps.
- Segment mode overrides are keyed by adjacent item edges (`fromItemId->toItemId`) and stale overrides are pruned automatically after reordering.
- If Google Routes requests fail with `401/403`, check API key billing, referrer restrictions, and API restrictions (Routes API).
- Opening hours and map/place data come from OpenStreetMap-related sources and may be incomplete/outdated.
- Large image libraries increase IndexedDB usage and ZIP export size.

## License

MIT
