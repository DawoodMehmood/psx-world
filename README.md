# PSX World

A cartoon isometric city that visualizes the Pakistan Stock Exchange. See [SPEC.md](SPEC.md) for the full design.

**Status: M3 done (full city).** All four archetypes (cement, banks, oil, tech) have three-tier sites, their own activity visuals and decline. The default scenario, *Two months on the Exchange* (40 days), gives every company a story: rallies, a halt, a market-wide selloff, an uneven recovery, companies that grow their sites and companies that wind down. *Lucky Cement in focus* (39 days) is still in the scenario picker. Districts and the whole market react too: park landmarks, lamps, bunting and traffic follow each sector; the Exchange beacon, market flag and plaza crowd follow the market; the sky clouds over in a selloff and rains when the market is stormy. A legend explains every channel and clicking a district's park opens a district card. All data is fictional.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # layout tests
npm run build    # typecheck + production build
```

Controls: drag to pan, scroll or pinch to zoom, click a company or a district park to inspect it, Esc to deselect, **L** or the Legend button for the legend.

The demo bar at the bottom plays the scenario (one tick = 45 simulated minutes, 2.5 s at 1×). Step by tick or by day, change speed, scrub, or reset. The caption says what to watch for that day. In a company's card, **Force state (demo)** pins its levels to test the visuals; a banner shows while any override is on.

## What you see on a plot

| State | How it shows |
|---|---|
| Today's direction | Flag height on the mast, plus a warm (up) or cool (down) beacon |
| Activity (volume vs normal) | Cement: trucks, conveyor, smoke, kiln glow. Banks: people, cars, lit windows. Oil: pumpjack pace, flare size, tankers. Tech: data pulses, server lights, lit windows, drones |
| Volatility | Machines stutter, the flag flaps hard, the beacon flickers |
| Health (20-day) | Decline idles the newest capacity first: kiln lines mothballed, pumpjacks shut in, buildings closed with TO LET boards, bays coned off, crews cut; struggling adds weeds and neglect. Nothing is demolished. Drives construction and site growth |
| Size and growth | Site tier: each company has a 14×14 lot; its site starts along the lot's back edge and grows toward the camera (6 → 10 → 14 rows), so new buildings appear in front. Reserved pads show where the next buildings go; when they're all built, the site expands |
| District (park) | Landmark works harder when the sector is busy; lamps warm when it's up, cool when down; district flag height = breadth; bunting when the whole sector rallies; cars on the district streets |
| Whole market | Exchange beacon color and market flag height = breadth, plaza crowd = activity; sky warm in a broad rally, overcast in a broad selloff, rain when stormy |
| Events | Confetti (big jump), siren and smoke (big drop), searchlights (volume spike), gold ring (new high), rain cloud (new low), barrier tape (halt), green pulse (resume), coin shower (dividend) |

Every archetype uses the same site plan (a vehicle strip along the side street, tall buildings on the back edges, low ones in front, a strip of land added at the front per tier); it is described at the top of `src/world/buildings/shared.tsx`.

## Where things live

| Path | What |
|---|---|
| `src/config/` | Sectors, companies and the city layout (tile grid, plots, roads) |
| `src/world/kit.tsx` | Low-poly building kit: shared geometries and flat-color materials |
| `src/world/buildings/` | The Exchange and one recipe per archetype (bank, oil, cement, tech), plus the flag mast |
| `src/world/scene/` | Canvas, isometric camera and controls, ground, roads, trees, traffic |
| `src/world/labels.tsx` | World-anchored DOM labels |
| `src/ui/` | Info panel and label layer |
| `src/engine/` | State engine, pure TypeScript: levels with hysteresis, events, construction, the market runner |
| `src/config/thresholds.ts` | Every threshold, margin, cooldown and duration in one place |
| `src/sim/` | Seeded data generator and scenario scripts (`scenarios/twoMonths.ts`, `scenarios/luckyInFocus.ts`) |
| `src/store/useSimStore.ts` | Playback state: snapshots, current tick, speed, overrides |
| `src/world/motion.ts` | Per-plot animation state eased toward the company's levels |
| `src/world/effects/`, `src/world/construction/`, `src/world/agents.tsx` | Event effects, the building-site lifecycle, workers and trucks |

## Add a company

1. Add an entry to `src/config/companies.ts` with a ticker, sector, `scale` (0–1), accent color, archetype, a free lot index and a `startTier`.
2. Each district has 3 lots. A 4th company in a sector needs another lot in `LOT_UV` in `src/config/layout.ts` (the layout tests will catch overlaps).
3. Site sizes and pads per tier live in `SITE_TIERS` (same file); each archetype's tier designs and decline are in its file in `src/world/buildings/`, with the shared pieces in `shared.tsx`.

Building height comes only from `scale`. Price never changes height (SPEC §7).

## Write a scenario

Add a file in `src/sim/scenarios/` and list it in `scenarios/index.ts` (the first one loads at start; the demo bar's picker switches between them). A scenario gives a seed, a number of days, a caption per day and a `plan(ticker, day)` that returns a `DayPlan` (`drift`, `volume`, `noise`, `zigzag`, `halt`, `dividendTick`). Companies with no plan for a day wobble around their usual level. `twoMonths.ts` shows a compact way to script many companies: segments of days that apply a plan to a list of tickers. The scenario test in `tests/engine.test.ts` shows how to assert what the engine should produce.
