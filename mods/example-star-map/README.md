# Example star map mod (documentation only)

Vanilla UI includes a **Star Map** page. This folder documents how mods or external tools can also consume the live galactic map data exposed by the engine.

## IPC: `getStarMap`

The renderer calls `window.api.getStarMap()` (see `src/main/preload.ts`). The main process builds a `StarMapView` from the active campaign via `buildStarMapView()` in `src/simulation/starMapView.ts`.

### Response shape (summary)

| Field | Description |
|-------|-------------|
| `homeSystemId` | Player home system |
| `currentTick` | Campaign day |
| `systems[]` | Per-system summary + economy heat, faction color, shortages |
| `lanes[]` | Jump lanes between systems (distance-weighted) |
| `transportArcs[]` | Active player haul routes |
| `npcConvoys[]` | Recent NPC regional trades (last few ticks) |
| `factions[]` | Legend entries (id, name, color) |

See `src/shared/types/views.ts` for full TypeScript types.

## Dev: dump map JSON from a save

From the project root (with a campaign loaded in dev, or adapt the script):

```bash
node scripts/dump-star-map.mjs path/to/saves/your-campaign.sqlite
```

Prints pretty JSON to stdout for tooling / mod prototyping.

## Building a mod UI

Mods cannot inject React pages today. Options:

1. **External tool** — read a save + replicate view assembly (harder; prefer IPC in dev).
2. **Fork the renderer** — add a page that calls `getStarMap` and renders SVG/canvas.
3. **Future mod API** — hook for custom nav entries (not implemented yet).

When adding a map overlay, call `getStarMap` after ticks (or subscribe via dashboard refresh) so convoy arcs and economy heat stay current.
