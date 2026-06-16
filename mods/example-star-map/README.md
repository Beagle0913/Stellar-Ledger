# Example star map mod

Vanilla already has a Star Map page. This folder is for mods or external tools that want the same live map data over IPC.

## `getStarMap`

Renderer: `window.api.getStarMap()`. Main builds `StarMapView` in `src/simulation/starMapView.ts`.

Rough shape:

| Field | Contents |
|-------|----------|
| `homeSystemId` | Player home |
| `currentTick` | Campaign day |
| `systems[]` | Per-system stats, heat, faction color |
| `lanes[]` | Jump connections |
| `transportArcs[]` | Player routes in flight |
| `npcConvoys[]` | Recent NPC hauls |
| `factions[]` | Legend |

Full types: `src/shared/types/views.ts`.

## Dump JSON from a save

```bash
node scripts/dump-star-map.mjs path/to/saves/your-campaign.sqlite
```

## Custom UI

Mods can't inject React pages yet. Options: external tool reading saves (hard), fork the renderer and call `getStarMap`, or wait for a nav-hook API. Refresh after ticks so convoy arcs stay current.
