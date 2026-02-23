# ✈️ Trip Planner

A mobile-first Trip Planner web app with **two UI variants** sharing the same core engine. Built with React, TypeScript, Vite, and TailwindCSS. Everything runs client-side with localStorage persistence.

| Variant A — Notion-like | Variant B — Travel Cards |
|---|---|
| Clean, minimal, productivity-focused | Big cards, playful, photo-friendly |
| Left sidebar + list layout | Card gallery + floating actions |

## Quick Start

```bash
# Install pnpm if you don't have it
npm i -g pnpm

# Install dependencies
pnpm install

# Run Variant A (Notion-like)
pnpm dev:notion

# Run Variant B (Travel Cards)
pnpm dev:cards
```

## Project Structure

```
trip_planner/
├── apps/
│   ├── notion/          # Variant A — Notion-like UI
│   └── cards/           # Variant B — Travel Card UI
├── packages/
│   ├── core/            # Shared types, state, storage, utils
│   └── ui/              # Shared UI components (Button, Modal, etc.)
├── .github/workflows/   # GitHub Pages deployment
├── pnpm-workspace.yaml
└── package.json
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev:notion` | Start Notion variant dev server |
| `pnpm dev:cards` | Start Cards variant dev server |
| `pnpm build:notion` | Build Notion variant for production |
| `pnpm build:cards` | Build Cards variant for production |
| `pnpm build` | Build both variants |

## Features (MVP)

- **Trip management** — Create, rename, delete, duplicate trips
- **Itinerary by days** — Add/edit/delete days with optional dates
- **Itinerary items** — Title, time, location, notes, cost, tags, map links
- **Drag & drop** — Reorder items within and between days (touch-friendly)
- **Budget totals** — Day and trip cost summaries with currency formatting
- **Export / Import** — JSON file download/upload with schema validation
- **Print view** — Clean, print-friendly itinerary layout
- **18 currencies** — SGD, USD, EUR, GBP, JPY, and more

## Tech Stack

- **Vite** + **React 18** + **TypeScript**
- **TailwindCSS** for styling
- **@dnd-kit** for drag & drop (touch + pointer)
- **lucide-react** for icons
- **localStorage** with versioned schema + migration framework
- **pnpm workspaces** monorepo

## Data Persistence

All data is stored in `localStorage` under the key `trip_planner_v1` with a versioned schema:

```json
{
  "version": 1,
  "data": {
    "trips": [...],
    "activeTripId": "..."
  }
}
```

Both UI variants share the same storage, so switching between them preserves your data.

## Deploy to GitHub Pages

1. Push to the `main` branch
2. Go to **Settings → Pages → Source → GitHub Actions**
3. The workflow builds both variants and deploys them:
   - `/<repo>/notion/` — Variant A
   - `/<repo>/cards/` — Variant B
   - `/<repo>/` — Landing page with variant picker

## Mobile-First Design

- Primary target: 360–430px phone screens
- Responsive up to 1024px+ desktop
- Touch-friendly drag handles and tap targets
- iOS safe-area padding support
- Bottom navigation on mobile, sidebar/topbar on desktop

## Future Roadmap

- [ ] Day reordering via drag & drop
- [ ] Dark mode
- [ ] PWA / offline support
- [ ] Trip templates
- [ ] Collaborative editing (via CRDTs or similar)
- [ ] Map integration (display locations)
- [ ] Image attachments per item
- [ ] Multi-currency conversion
- [ ] Checklist items (packing list)

## License

MIT
