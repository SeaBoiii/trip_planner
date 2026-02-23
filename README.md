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
  - provider-backed route compute (OSRM demo / Valhalla demo / openrouteservice key)
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

This app uses public/community endpoints by default. Rate limiting and caching are implemented, but availability can vary.

- Geocoding: OpenStreetMap Nominatim (debounced + cached + 1 req/sec queue)
- Opening hours lookup: Overpass API (cached + rate limited)
- Routing (selectable):
  - Valhalla demo (default)
  - OSRM demo
  - openrouteservice (user-supplied API key, stored locally only)
- Exchange rates: Frankfurter API (no API key)

Important:

- GitHub Pages cannot store secrets. Any API key (e.g., openrouteservice) must be entered by the user in Settings and is stored locally only.
- Public demo routing services should be used sparingly. The UI uses explicit "Compute" actions and caches results.

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
- Current JSON schema version: `4`

Migration coverage includes:

- legacy `item.location` string -> `item.locationText`
- legacy numeric `item.cost` -> `Money`
- legacy `trip.currency` -> `trip.baseCurrency`
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

- Transit routing is provider-dependent. If unavailable, transit rows fall back to straight-line estimates plus deep links to Maps apps.
- Opening hours and map/routing data come from OSM-related sources and may be incomplete/outdated.
- Large image libraries increase IndexedDB usage and ZIP export size.

## License

MIT
