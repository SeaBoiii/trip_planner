# Trip Planner

A mobile-first Trip Planner web app built with React, TypeScript, Vite, and TailwindCSS. It has a Notion-like UI, dark mode, local-first persistence, trip templates, map pins, and location search with OpenStreetMap data sources.

## Quick Start

```bash
# Install pnpm if you don't have it
npm i -g pnpm

# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build for production
pnpm build
```

## Project Structure

```text
trip_planner/
|- apps/
|  `- notion/          # Main app (Notion-like UI)
|- packages/
|  |- core/            # Shared types, state, storage, services, templates
|  `- ui/              # Shared UI components
|- .github/workflows/  # GitHub Pages deployment
|- pnpm-workspace.yaml
`- package.json
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |

## Features

- Trip management (create, rename, delete, duplicate)
- Trip templates (built-in + save any trip as a custom template)
- Day-by-day itinerary editing
- Itinerary items with time, notes, tags, links, cost, and location support
- Location search (OpenStreetMap Nominatim) with structured lat/lon storage + free-text fallback
- Map view (Leaflet + OpenStreetMap tiles) with day filters and pinned itinerary items
- Best-effort opening hours display from OpenStreetMap `opening_hours` tags (via Overpass API)
- Mobile-safe drag reordering with explicit reorder mode
- Move-to fallback modal for cross-day item moves
- Dark mode (system/light/dark)
- Budget totals by day and trip
- JSON export/import with schema migrations
- Print-friendly trip view

## Map + Location Data

- Geocoding search uses OpenStreetMap Nominatim (`nominatim.openstreetmap.org`) by default.
- Requests are debounced, cached, and rate-limited to 1 request/second to comply with public API usage expectations.
- Map tiles and markers use OpenStreetMap data and show required attribution in the map UI.
- Opening hours are fetched best-effort from OSM tags through the Overpass API and parsed with the `opening_hours` package.
- Opening hours can be missing, unparsable, or outdated; always verify directly with venues for time-sensitive plans.
- A configurable geocoding endpoint is available in Settings (advanced) for self-hosted/alternate Nominatim endpoints.

## Tech Stack

- Vite 5 + React 18 + TypeScript 5
- TailwindCSS
- `@dnd-kit` (drag and drop)
- `leaflet` + `react-leaflet` (map view)
- `opening_hours` (OSM opening hours parsing)
- `lucide-react` (icons)
- localStorage with versioned schema migrations
- pnpm workspaces monorepo

## Data Persistence

All data is stored in `localStorage` under the key `trip_planner_v1` with a versioned schema:

```json
{
  "version": 3,
  "data": {
    "trips": [...],
    "activeTripId": "...",
    "templates": [...],
    "settings": {
      "theme": "system",
      "geocodingProviderEndpoint": "https://nominatim.openstreetmap.org"
    }
  }
}
```

Migration notes:

- Existing legacy item `location` strings are migrated to `locationText`.
- Structured locations are stored in `item.location` with coordinates and OSM references.

## Deploy to GitHub Pages

1. Push to the `main` branch
2. Go to GitHub repository Settings -> Pages -> Source -> GitHub Actions
3. The workflow builds and deploys to `/<repo>/`

## Mobile-First Design

- Primary target: phone screens (roughly 360-430px)
- Responsive desktop layout with sidebar + map/list split on larger screens
- Touch-friendly drag handles and bottom navigation
- iOS safe-area padding support

## Future Roadmap

- [ ] Day reordering via drag and drop
- [ ] Routing / travel time / distance
- [ ] PWA / offline support
- [ ] Image attachments per item
- [ ] Multi-currency conversion
- [ ] Checklist items (packing list)
- [ ] Collaborative editing

## License

MIT
