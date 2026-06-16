# Modding

All content is JSON. Vanilla is the built-in mod in `data/vanilla/`; add folders under `mods/`. Zod validates on load — bad data errors out before a campaign starts.

Economy rules: [ECONOMY.md](ECONOMY.md). Save behavior: [PERSISTENCE.md](PERSISTENCE.md). Working example: [example-expanded-industry](../mods/example-expanded-industry/).

## Where files live

From source: edit `data/` and `mods/` in the repo root.

Portable exe: editable folders appear next to the exe on first run:

```
GalacticEconomy.exe
data/      <- edit data/vanilla here (and add data mods)
mods/      <- add external mod folders here
saves/     <- campaign .sqlite files
```

The exe seeds folders once if missing; relaunch never overwrites your edits. Delete `data/` or `mods/` to reset. Runtime always reads disk beside the exe, not the bundled seed.

New campaigns freeze loaded definitions (including scenario and NPC corp seeds) into the save SQLite file. Later JSON edits affect only future new campaigns.

## Vanilla data structure

`data/vanilla/` contains:

| File             | Contents                                             |
| ---------------- | ---------------------------------------------------- |
| `mod.json`       | Manifest (id, version, dependencies, …)              |
| `items.json`     | Item definitions                                     |
| `recipes.json`   | Recipe definitions (incl. extraction recipes)        |
| `buildings.json` | Building type definitions                            |
| `systems.json`   | Star systems (id, name, map x/y)                     |
| `planets.json`   | Planets (stats + `systemId`)                         |
| `factions.json`  | Factions (flavor)                                    |
| `events.json`    | Event definitions (trigger + effect)                 |
| `economic_profiles.json` | Regional demand/supply rules                 |
| `economy_config.json` | Optional simulation tunables (liquidity, trade, population) |
| `campaign_start.json` | Optional new-campaign bootstrap (credits, stock, buildings, home system) |
| `ships.json`     | Purchasable ship types                               |
| `objectives.json`| Campaign objective definitions                       |
| `contract_templates.json` | Rotating contract board templates         |
| `npc_corporations.json` | NPC corporation seeds (new campaigns only) |
| `scenarios.json` | Named campaign start presets |
| `content_version.json` | Integer bumped when vanilla content changes (portable seed updates) |

## Example mods

- `mods/example-expanded-industry/` — items, building, recipes on vanilla
- `mods/example-star-map/` — consuming `getStarMap` from outside the app

## Creating a mod

1. Make a folder under `mods/`, e.g. `mods/my-mod/`.
2. Add a `mod.json` manifest:

```json
{
  "id": "my_mod",
  "name": "My Mod",
  "version": "0.1.0",
  "author": "You",
  "gameVersion": "0.1.x",
  "dependencies": ["vanilla"],
  "loadAfter": ["vanilla"],
  "description": "Adds some new industry."
}
```

3. Add any of the optional content files (`items.json`, `recipes.json`,
   `buildings.json`, `systems.json`, `planets.json`, `factions.json`, `events.json`,
   `economic_profiles.json`, `economy_config.json`, `ships.json`, `objectives.json`,
   `contract_templates.json`, `npc_corporations.json`, `scenarios.json`).
   Each file is a JSON **array** of entries. Omit files you don't need.
4. Start a **new campaign** — its loaded mod definitions are frozen into the save, so
   existing saves are unaffected by your new mod.

See `mods/example-expanded-industry/` for a complete working example that adds two
items, a building, and two recipes on top of `vanilla`.

## Supported JSON files & examples

### Example item

```json
{ "id": "superalloy", "name": "Superalloy", "category": "refined", "baseValue": 220, "volume": 1 }
```

`category` ∈ `raw | refined | component | good | energy | special`.

### Example economy config (optional object, not an array)

`economy_config.json` overrides simulation tunables. Later mods in load order win per field.
See `data/vanilla/economy_config.json` and `docs/ECONOMY.md`.

```json
{
  "regionalTradeMinSpreadPercent": 8,
  "regionalTradeMaxUnitsPerDay": 40,
  "populationGrowthRatePerDay": 0.0001
}
```

### Example recipe

```json
{
  "id": "recipe_superalloy",
  "name": "Superalloy Casting",
  "buildingType": "advanced_foundry",
  "inputs": [{ "itemId": "alloys", "quantity": 3 }, { "itemId": "rare_ore", "quantity": 2 }],
  "outputs": [{ "itemId": "superalloy", "quantity": 1 }],
  "duration": 4
}
```

Extraction recipes additionally set `"extraction": true` and a `"yieldStat"` of
`mineralRichness | fertility | energyPotential | habitability` to declare which planet
stat scales their output.

### Example building

```json
{ "id": "advanced_foundry", "name": "Advanced Foundry", "buildCost": 22000,
  "buildMaterials": [{ "itemId": "machinery", "quantity": 5 }] }
```

### Example event

```json
{
  "id": "evt_logistics_fuel_pressure",
  "name": "Logistics Fuel Pressure",
  "description": "Your fuel reserves are running low and NPC fuel prices are climbing.",
  "trigger": { "type": "lowStock", "itemId": "fuel", "threshold": 35 },
  "effect": { "type": "priceShock", "itemId": "fuel", "multiplier": 1.25 },
  "minCampaignTick": 10,
  "requiresCompletedObjectiveId": "obj_arc_convoy",
  "cooldownTicks": 10
}
```

**Triggers:** `tickInterval { everyTicks }`, `lowStock { itemId, threshold }`, or
`stockpileShortage { itemId, threshold }`.

**Effects:** `priceShock { itemId, multiplier }`, `message`, `stockpileShock { itemId, delta }`,
or `creditBonus { amount }`.

**Optional gating fields** (on the event object, not inside trigger/effect):

| Field | Purpose |
|-------|---------|
| `minCampaignTick` | Event is not evaluated until `state.meta.tick >=` this value (default 0). |
| `requiresCompletedObjectiveId` | Event is not evaluated until that objective is completed. |
| `cooldownTicks` | Minimum ticks between fires; uses `progression.eventLastFiredTick[event.id]`. |

At runtime, an event fires only when it is **eligible**, its **trigger** is true, and
cooldown has elapsed. Eligibility is read-only — events never sync or complete objectives.

**Save behavior:** `eventLastFiredTick` is stored in `progression_json`. Old saves without
this field load with `{}`. Existing saves keep their **frozen** event definitions from
campaign creation; only new campaigns pick up updated vanilla `events.json`.

**Out of MVP scope:** duration modifiers, system-scoped effects, NPC convoy delays,
rush-contract spawning, `maxCampaignTick`, `severity`, and new trigger/effect types.

**Player explanations:** When an event fires or is blocked, the UI derives short
explanations from the event definition (trigger type, gating fields, cooldown state).
Mod authors do not author explanation text separately — triggers and gates drive the
copy. Unknown validation errors fall back to the original message.

### Example objective

```json
{
  "id": "obj_scale_metal",
  "title": "Scale up metal production",
  "description": "Produce 16 units of metal in total.",
  "type": "produce_item",
  "itemId": "metal",
  "target": 16,
  "dependsOnObjectiveId": "obj_first_metal",
  "optional": false
}
```

`type` ∈ `produce_item | sell_proceeds | own_ships | inter_system_delivery | net_worth | complete_contracts`.

Objective progress is **cumulative** over the whole campaign (lifetime produced
items, total sell proceeds, completed contracts, etc.).

- **`dependsOnObjectiveId`** (optional): a **single** prerequisite objective id. The
  objective stays **locked** until that prerequisite completes — while locked it does
  not track progress, does not complete, and shows as *Upcoming* on the Dashboard. The
  moment it unlocks it is synced once against the cumulative total, so if the target is
  already met it completes immediately. There is no OR/multi-dependency support; chain
  objectives by pointing each at the previous one.
- **`optional`** (optional, default `false`): a UI/priority flag only. Optional
  objectives appear in the Dashboard *Optional* section and are excluded from the main
  current-goal hint. They do **not** change completion logic and must **not** be used as
  a prerequisite for a main-path objective.

### Example contract template

```json
{
  "id": "tpl_fleet",
  "type": "own_asset",
  "title": "Fleet Expansion",
  "description": "Acquire a new ship for the corporation.",
  "factionId": "faction_independents",
  "minCampaignTick": 20,
  "tiers": [
    { "tier": 1, "minReputation": 0, "creditReward": 600, "reputationReward": 1,
      "expiresInDays": 21, "shipDefinitionId": "ship_hauler_2" }
  ]
}
```

`type` ∈ `deliver_item | produce_item | sell_in_faction | own_asset | reach_net_worth`.

- **`minCampaignTick`** (optional, template level): the template is not offered on the
  contract board until `state.meta.tick` reaches this value. Use it to keep the early
  board focused. The board fills toward four active offers by round-robining only over
  **eligible** templates; if no template is eligible yet the board is simply left with
  fewer slots (it never stalls or loops).
- Tier entries also accept a `minCampaignTick` (and `minReputation`) to gate individual
  tiers.

## Validation rules

The loader/merger enforces (each gives a clear error message):

- every **item id** is unique; every **recipe id** is unique; every **building id** is
  unique (also systems, planets, factions, events).
- a recipe's **input/output item ids must exist**.
- a recipe's **`buildingType` must reference an existing building**.
- a building's **build-material item ids must exist**.
- a planet's **`systemId` must reference an existing system**.
- event item references (trigger/effect) must exist.
- an event's **`requiresCompletedObjectiveId`** (when set) must reference an existing objective id.
- an objective's **`itemId`** (when set) must reference an existing item.
- an objective's **`dependsOnObjectiveId`** (when set) must reference an existing objective
  and cannot point at itself.
- a contract template's **`factionId`**, tier **`itemId`**, and tier **`shipDefinitionId`**
  must reference existing definitions.
- **duplicate ids across mods** throw an error.
- **missing dependencies** throw an error.
- **cyclic dependencies** throw an error.
- ids must match `^[a-z0-9_]+$`.

Load order is resolved deterministically from `dependencies` + `loadAfter`
(dependencies always load before dependents).

You can review loaded data, discovered mods, definition counts, and any validation
errors in-app on the **Mods** page.

## Reloading mod data

**Reload mod data from disk** (`reloadModData` IPC, Mods page button) re-reads JSON from
`data/` and `mods/` into the mod catalog. It affects **new campaigns only** — loaded
saves keep their frozen definitions snapshot.

## NPC corporations (`npc_corporations.json`)

Optional. Seeds NPC corps on new campaigns only. Inventory, buildings, ships, credits, jobs, and orders persist in the save — not rebuilt from JSON on load.

```json
{
  "id": "corp_helion_mining",
  "name": "Helion Mining",
  "factionId": "faction_consortium",
  "homeSystemId": "sys_cinder",
  "startingCredits": 55000,
  "startingStock": { "ore": 120, "energy": 80 },
  "buildings": [{ "planetId": "cinder_core", "buildingType": "mine" }],
  "ships": [{ "definitionId": "ship_hauler_1", "name": "Helion Hauler" }],
  "aiProfile": "extractor"
}
```

`aiProfile`: `extractor` | `refiner` | `balanced` | `trader` — controls production and
market AI (trader skips industrial production). See [`ECONOMY.md`](ECONOMY.md).

## Scenarios (`scenarios.json`)

Optional presets that override parts of `campaign_start.json` (and optionally economy or objective filters). Vanilla: `standard`, `prospector_easy`, `barebones_hard`, `trade_focus`.

```json
{
  "id": "prospector_easy",
  "name": "Prospector",
  "description": "Extra credits and stock for a gentler first hour.",
  "difficulty": "easy",
  "campaignStart": {
    "startingCredits": 52000,
    "startingStock": { "ore": 200, "food": 120, "fuel": 120 }
  }
}
```

`difficulty`: `easy` | `normal` | `hard` | `custom`.

Chosen scenario is copied into the save at creation (`scenario_config_json`). Loaded games use that copy, not live JSON on disk.

## Star map

The vanilla **Star Map** page calls **`getStarMap`** IPC and renders a 2D trade-network view
(systems, lanes, economy heat, transport/NPC overlays). Mods and external tools can use the same
IPC and DTO. See `mods/example-star-map/README.md` and `src/simulation/starMapView.ts`.
