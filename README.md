# ✈️ Trip Planner

A mobile-first Trip Planner web app built with React, TypeScript, Vite, and TailwindCSS. Clean Notion-inspired UI with full dark mode, trip templates, and mobile-safe reordering. Everything runs client-side with localStorage persistence.

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

```
trip_planner/
├── apps/
│   └── notion/          # Main app — Notion-like UI
├── packages/
│   ├── core/            # Shared types, state, storage, utils, templates
│   └── ui/              # Shared UI components (Button, Modal, etc.)
├── .github/workflows/   # GitHub Pages deployment
├── pnpm-workspace.yaml
└── package.json
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |

## Features

- **Trip management** — Create, rename, delete, duplicate trips
- **Trip templates** — 4 built-in templates (City Weekend, Road Trip, Business Trip, Theme Park Day) + save any trip as a custom template
- **Itinerary by days** — Add/edit/delete days with optional dates
- **Itinerary items** — Title, time, location, notes, cost, tags, map links
- **Mobile-safe reordering** — Explicit "Reorder" mode with drag handles; prevents accidental reorder during scroll
- **Move-to fallback** — Move items between days via a picker modal (great for touch devices)
- **Dark mode** — System-aware with manual override (System / Light / Dark), persisted, flash-free
- **Budget totals** — Day and trip cost summaries with currency formatting
- **Export / Import** — JSON file download/upload with schema validation
- **Print view** — Clean, print-friendly itinerary layout
- **18 currencies** — SGD, USD, EUR, GBP, JPY, and more

## Tech Stack

- **Vite 5** + **React 18** + **TypeScript 5**
- **TailwindCSS** with `darkMode: 'class'`
- **@dnd-kit** for drag & drop (touch + pointer)
- **lucide-react** for icons
- **localStorage** with versioned schema + migration framework
- **pnpm workspaces** monorepo

## Data Persistence

All data is stored in `localStorage` under the key `trip_planner_v1` with a versioned schema:

```json
{
  "version": 2,
  "data": {
    "trips": [...],
    "activeTripId": "...",
    "templates": [...],
    "settings": { "theme": "system" }
  }
}
```

Existing v1 data is automatically migrated to v2 on load.

## Deploy to GitHub Pages

1. Push to the `main` branch
2. Go to **Settings → Pages → Source → GitHub Actions**
3. The workflow builds and deploys to `/<repo>/`

## Mobile-First Design

- Primary target: 360–430px phone screens
- Responsive up to 1024px+ desktop
- Touch-friendly drag handles and tap targets (gated behind Reorder mode)
- iOS safe-area padding support
- Bottom navigation on mobile, sidebar on desktop

## Future Roadmap

- [ ] Day reordering via drag & drop
- [ ] PWA / offline support
- [ ] Collaborative editing (via CRDTs or similar)
- [ ] Map integration (display locations)
- [ ] Image attachments per item
- [ ] Multi-currency conversion
- [ ] Checklist items (packing list)

## License

MIT
