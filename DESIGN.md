# PSX World — Data-Driven Design (v2 proposal)

**Status: proposal for review. No code has changed.** When accepted, this replaces SPEC §6 (company state), §7 (visual language), §8 (construction) and §12 (stability) and updates §13 (data layer). Everything else in SPEC.md stands.

**Goal:** the city is a deterministic function of market data. Given the data for a company at a moment, we know exactly what its site looks like. The same rules must work for simulated data today and live PSX data later.

---

## 1. Principles

1. **One owner per visual.** Each factor owns one set of visuals; none overlap.
2. **Derive, don't configure.** A company's size and starting state come from its data, not hand-typed numbers in `companies.ts`.
3. **Slow things build, fast things animate.** Size and Health change over days with visible construction or wind-down. Direction and Activity change within the day.
4. **Short animations are free, long ones are derived.** Anything under about a minute (a truck pulling in, fireworks) is free-running; two viewers need not see the same frame. Anything lasting hours or days (construction, wind-down) is computed from the data timeline so every viewer sees the same stage.
5. **Read it zoomed out.** Visuals must be legible on the full-city view: crowds, lit windows, whole buildings open or closed, light and shadow on the ground, smoke, beams of light. Small details (flags, flicker, beacon tints) are removed.
6. **Demolition is allowed.** Structure follows the data in both directions.
7. **Hard stops.** Beyond the top level a company stays at the top visual; below the bottom, at the bottom.
8. **Rule: price never changes height.** Size moves only on a slow, smoothed market-cap signal (§3.1), never on a tick or a day's move.

## 2. Data contract

Everything above the engine consumes these shapes and nothing else.

**Per company, static** (refreshed rarely): `ticker`, `sectorId`, `archetype`, `plot`, `accent`, `sharesOutstanding`, `freeFloat` (optional).

**Per company, series:** daily adjusted close and volume (adjusted for splits and bonus issues), at least 5 years if available; intraday ticks for the current day if available.

**Per sector, reference:** `capRange { low, high }` taken from the **full listed sector universe**, not just the companies we draw (§3.1). For the simulation this is hand-seeded in config; for live data it comes from the full sector list.

**Per market, reference:** `capRange { low, high }` across all listed companies.

Existing boundary stays: `MarketSource` → `Observation`. A `PsxSource` implements it later (§10).

## 3. Factors

Timescale column: **S** slow (daily update, smoothed), **F** fast (per tick).

| Factor | Speed | Question it answers | Owns |
|---|---|---|---|
| Size ceiling | S | How big can this company's site ever be? | maximum level |
| Cycle position | S | How much of that has it developed, versus its own past? | built level |
| Health | S | Is it in good shape over the long term? | upkeep, which buildings are open |
| Direction | F | Up or down today? | light pool on the plot |
| Activity | F | How busy is it today? | crowd, vehicles, lit windows |
| Frantic | F | Calm or hectic? | movement style |
| Events | F | Something special happened | beams, fireworks, halt tape |

### 3.1 Size: levels 1–10

A company has a **ceiling level** C and a **built level** B, both from 1 to 10. Level 1 is the core site; levels 2–10 are nine growth steps (§4).

**Smoothed cap.** `cap = adjusted close × sharesOutstanding`, averaged over 60 trading days (`smoothCap`).

**Position within the sector and market (log scale):**
```
Psector = clamp01( (ln smoothCap − ln sector.low) / (ln sector.high − ln sector.low) )
Pmarket = same, against market.low / market.high
```
`sector.high` is set slightly above the current largest company, so even the leader is not automatically at level 10.

**Ceiling level.**
```
C = clamp( round(1 + 9 × (0.7·Psector + 0.3·Pmarket)), 1, 10 )
```
Size relative to the sector counts most; market weight stops the median company of a tiny sector claiming a leader's site. Weights are tunable.

**Cycle position** (how developed versus its own past):
```
Y = clamp01( (ln smoothCap − ln low5y) / (ln high5y − ln low5y) )
```
`low5y` and `high5y` are the min and max of `smoothCap` over a 5-year window (or what exists). A company near its own all-time high has Y near 1; in a bear market Y is low, which leaves room to grow when the market recovers.

**Built level.**
```
B = clamp( round(1 + (C − 1) × Y), 1, C )
```
A company can never be built beyond its ceiling. A small company at its all-time high reaches its own small ceiling and stops; it shows its good fortune through polish (Health, events), not footprint. A leader in a bear market sits low on the ladder with headroom above.

**Young listings.** With under about one year of history there is no meaningful cycle, so `B = C` and the UI marks size as low-confidence.

**Stability.** B changes only at end of day; moves one step at a time; requires the unrounded value to pass the half-step by a 0.15-level margin (hysteresis); minimum dwell 5 trading days.

Two consequences, confirmed in `engine/size.ts` tests: hysteresis leaves a dead band, so a raw level of 5.5 settles at 5 when climbing and at 6 when falling (the replay in §5 fixes the start, so this stays deterministic); and a company at the very bottom of its sector still has ceiling 2, because the market-share term counts for 30%.

**Scale** (0–1) is the continuous position of `Psector` inside its level, and drives tower heights and prop counts *within* a level. It moves only with `smoothCap`.

### 3.2 Health

Five bands from a score in 0–1:
```
H = 0.35 · sectorRank20  +  0.25 · absReturn20  +  0.40 · position52
```
- `sectorRank20`: percentile of the 20-day return among the full sector universe.
- `absReturn20`: `clamp01((return20 + 15%) / 30%)`, so a rank-leader in a crashing market does not read as THRIVING.
- `position52`: `(close − 52w low) / (52w high − 52w low)`.

| Band | H |
|---|---|
| STRUGGLING | < 0.20 |
| WEAK | 0.20–0.40 |
| STEADY | 0.40–0.60 |
| STRONG | 0.60–0.80 |
| THRIVING | ≥ 0.80 |

Updates at end of day; hysteresis 0.02; minimum dwell 2 days. **Health never starts, pauses or undoes construction.** It decides which *existing* buildings are open and how well kept the site is.

### 3.3 Direction

Today's % change vs previous close: FLAT within ±0.75%, UP/DOWN to ±3%, UP_HARD/DOWN_HARD beyond. (PSX circuit breaker is ±7.5%; moves near the limit add the hard-move effect at full strength.) Existing hysteresis and dwell apply.

### 3.4 Activity

```
v  = today's volume ÷ expected volume at this time of day (20-day average)
f  = clamp01( 0.5 + 0.5 · ln(v) / ln(4) )          // v=1 → 0.5, v=4 → 1, v=¼ → 0
Lq = sector percentile of (20-day avg turnover ÷ smoothCap)    // liquidity
A  = 0.7·f + 0.3·Lq
```
| Band | A |
|---|---|
| QUIET | < 0.35 |
| NORMAL | 0.35–0.60 |
| BUSY | 0.60–0.80 |
| FRENZY | ≥ 0.80 |

Liquidity is the structural part: a big liquid bank is always somewhat busy; a day of 3× volume is a different signal.

### 3.5 Frantic

Calm / choppy / wild from intraday range and tick-to-tick swing (existing rule). It is not a separate visual object; it sets the **style of movement** inside Activity (§6).

### 3.6 Events

Same set as SPEC §10 (volume spike, big move up/down, new 20-day high/low, halt, resume, dividend) with the same cooldown. Their effects change (§6).

### 3.7 Sector and market state

Unchanged in logic (SPEC §11): breadth, activity, market mood, stormy flag. Added: **sector cycle position** and **market cycle position** (aggregate cap against its own 5-year range) set how developed the district and the Exchange look (lamps lit, ambient traffic, Exchange plaza size).

## 4. The level ladder

Every archetype defines the same 10-level ladder. Each level is one of:
- **B** — a new building, or
- **U** — an upgrade to something already standing (extra floors, taller stack, another tank). Upgrades are cheaper to model and animate than new buildings.

Level 1 is the core site and always exists. **Footprint** (rows of the 14×14 lot, from the back edge) grows at two levels: 6 rows at levels 1–3, 10 rows at levels 4–6, 14 rows at levels 7–10. Levels 4 and 7 begin with a site-expansion project (land cleared and graded, then the item built).

**Bays** (one vehicle each) and **crowd capacity** also follow the level: `bays = 1 + floor(level / 2)`.

### Banks (tidy downtown, glass, plazas)

| Lvl | Type | Adds |
|---|---|---|
| 1 | core | HQ tower, plaza, ATM |
| 2 | B | branch hall |
| 3 | U | HQ gains floors; plaza fountain |
| 4 | B + site | second tower |
| 5 | B | office wing |
| 6 | U | second tower gains floors; plaza trees and planters |
| 7 | B + site | second wing |
| 8 | B | tallest tower |
| 9 | B | rotunda |
| 10 | U | sky bridge between towers; gold crown on the tallest tower |

### Oil & Gas (dusty industrial yard)

| Lvl | Type | Adds |
|---|---|---|
| 1 | core | drilling rig, tank, flare, control hut, pumpjack |
| 2 | B | second pumpjack |
| 3 | U | rig gets a taller derrick |
| 4 | B + site | third pumpjack |
| 5 | B | tank pair |
| 6 | U | flare stack taller, bigger burner |
| 7 | B + site | fourth pumpjack |
| 8 | B | gas processing unit |
| 9 | B | second tank pair |
| 10 | U | control hut becomes control centre; yard floodlights |

### Cement (quarry, kilns, silos)

| Lvl | Type | Adds |
|---|---|---|
| 1 | core | kiln line, quarry, conveyor, silos, hall |
| 2 | B | silo bay |
| 3 | U | silos raised; conveyor extended |
| 4 | B + site | second kiln line |
| 5 | B | loading wing |
| 6 | U | kiln stacks taller; preheater tower |
| 7 | B + site | third kiln line |
| 8 | B | clinker dome |
| 9 | B | second loading wing |
| 10 | U | quarry widened with excavators; hall extended |

### Tech & Communication (campus, data centres)

| Lvl | Type | Adds |
|---|---|---|
| 1 | core | glass HQ, antenna, network line |
| 2 | B | data centre |
| 3 | U | HQ gains floors; antenna taller |
| 4 | B + site | office block |
| 5 | B | second data centre |
| 6 | U | network line gains pulse nodes; cooling units on data centres |
| 7 | B + site | lab dome |
| 8 | B | third data centre |
| 9 | B | dish farm |
| 10 | U | sky bridge from HQ to office block; rooftop crown |

### Adding a fifth sector

A sector is complete when it defines: **the 10-level ladder, its closure order (§6), its activity actors, its hard-up effect, its hard-down effect, and its district landmark.** Everything else is shared.

## 5. How growth and decline happen over time

B is a function of the data. What is *displayed* is a construction timeline derived from the B series, so it is deterministic and a late joiner sees the same stage.

1. Each day, compare B with the displayed level D. When they differ, queue one project per level in between, **in order, one at a time**.
2. Durations (trading days): new building **5** (STAKED 1, FOUNDATION 2, FRAME 2 → COMPLETE); upgrade **3** (STAKED 1, FRAME 2 → COMPLETE); a site expansion adds **2** to levels 4 and 7.
3. Decline reverses the queue: each level is wound down (crew leaves, tarp on, structure removed) — building **3** days, upgrade **2** days.
4. **D is computed by a bounded replay:** fold the last 60 trading days of the B series, assuming D = B at the window start. Same data → same D, with no stored state. If B reverses mid-project, the replay reaches the same answer every time.
5. A large jump (a re-rating) simply queues several projects; the city visibly catches up over weeks.

Stage visuals follow SPEC §8: stakes and rope → slab and rebar → scaffold, crane and frame → finished. Construction is independent of Health.

## 6. Visual vocabulary

### Shared across all sectors

| State | Macro visual |
|---|---|
| **Direction** | A **light pool** on the plot. UP: warm sunlit patch, brighter paving. DOWN: cool cloud-shadow patch, duller paving. FLAT: neutral daylight, no pool. UP_HARD: balloons and confetti. DOWN_HARD: small dark rain cloud. Light vs shade, not green vs red. |
| **Activity** | Number of people on plaza and lanes, vehicles in bays and on the street, fraction of lit windows (inside open buildings only) |
| **Frantic** | CALM: strolling people, normal vehicle speed. CHOPPY: brisk. WILD: running people, fast vehicles |
| **Health** | Lawn and tree condition (lush → dry → dead), which buildings are open, tarps, boards, weeds. THRIVING adds ornaments: fresh paint, flower beds, gold trim |
| **Size and growth** | Level ladder (§4), cranes and scaffolds during projects, teardown crews during decline |
| **Events** | Light beams into the sky: gold for a new high, sweeping white searchlights for a volume spike, red/blue sirens for a crash; fireworks; halt tape |
| **District** | Lamps lit, ambient traffic, sky tint above the district; amount scales with sector breadth, activity and cycle position |
| **Market** | Sky tone, rain when stormy, Exchange plaza crowd, searchlights from the Exchange |

Removed from the old design: the mast flag, beacon colour tint and beacon/flag flicker.

### Composition rules (where channels share a resource)

- **Health sets capacity, Activity fills it.** People and vehicles scale as `open capacity × activity fraction`. A closed building cannot have lit windows.
- **Direction and Events** never remove capacity. A local event overrides the light pool for its duration (a crash siren beats a dim pool).
- **Frantic** changes motion only, never counts.
- Zoom-out budget: effects that must read at distance (beams, crowds, light pools) are larger and simpler than detail effects (steam, sparks), which only show when zoomed in.

### Health closure rules, per sector

Closure applies to the newest ⌈⅓⌉ (WEAK) of built **buildings**; upgrades are never closed but show wear. STRUGGLING leaves only the core open.

| | WEAK | STRUGGLING |
|---|---|---|
| **Banks** | front-most building closed: TO LET board, roof greyed | only the HQ open; ATM out, fountain dry, weeds |
| **Oil & Gas** | newest pumpjack shut in: still, grey, red tag | only the first pumpjack runs; flare out, tanks rusting, dry scrub |
| **Cement** | newest kiln line mothballed under tarp, no smoke; about a third of bays coned off | only the first kiln line; most bays closed; windows boarded, silos patched, weeds |
| **Tech** | front-most building closed: servers dark, TO LET board | only the HQ open; café shut, lawn overgrown |

All archetypes also cone off bays and reduce the crew in proportion.

### Activity actors, per sector

| | QUIET | BUSY / FRENZY |
|---|---|---|
| **Banks** | few people, a cash van parked | crowds on the plaza, cars and the van in every bay, nearly all windows lit |
| **Oil & Gas** | pumpjacks nodding slowly, small flare | pumpjacks fast, big flare, tankers in every bay |
| **Cement** | slow conveyor, one truck parked | fast conveyor, trucks in every bay, kiln glow, thick smoke |
| **Tech** | rare data pulses on the network line | rapid pulses, lit server windows, delivery drones over the HQ |

### Hard-move effects, per sector

| | UP_HARD | DOWN_HARD |
|---|---|---|
| **Banks** | gold confetti | rain cloud over the plaza |
| **Oil & Gas** | a gusher shooting up from the wellhead | black smoke column |
| **Cement** | confetti and bright kiln glow | dust cloud over the yard |
| **Tech** | drone light show | rain cloud; partial window blackout |

## 7. Timescales and late joiners

| Time scale | What | Behaviour |
|---|---|---|
| < ~1 min | truck arrivals, fireworks, a crowd surge, a confetti burst | free-running; a late joiner just sees whatever is happening |
| intraday | Direction, Activity, Frantic | follows the latest data point; eases between levels |
| days | construction, wind-down, upkeep, size | derived from the data timeline (§5); identical for every viewer |

If the live source only provides daily or delayed data, the fast factors update less often and nothing else changes.

## 8. Stability (replaces SPEC §12)

- Smoothing: slow factors use rolling means (60-day cap, 20-day return); fast factors keep the existing tick smoothing.
- Hysteresis on every banded factor; minimum dwell (2 ticks fast, 2–5 days slow).
- B moves one step at a time, only at end of day.
- Renderer eases between states: crowds fade in and out, light pools cross-fade.

## 9. Testing

- **Level tables:** each factor has a pure function `data → band/level` with table-driven tests (about 5–10 cases each), including hard stops and hysteresis edges.
- **Composition:** tests for the few interaction rules in §6 (capacity × fraction, closed building has no lit windows), not for every combination of states.
- **Determinism:** same data series → same `VisualSpec`, run twice; the bounded replay (§5) gives the same D from any start inside the window.
- **Scenario check:** the demo scenario asserts key states on key days.
- **`VisualSpec`:** the engine emits one plain-data object per company (level, built units, project stage, bays open, activity fraction, light pool, health ornaments, event list). The renderer only reads it. One pure function maps state to `VisualSpec`; snapshot-test it.

## 10. Real PSX data

Findings so far (read-only checks):
- `dps.psx.com.pk/company/<TICKER>` is reachable and shows market cap, shares outstanding, free float, 52-week range, sector and the last price. That supplies `sharesOutstanding`.
- It displays 1D to 5Y charts, so history exists on the site; the underlying feed endpoint has **not** been identified (guessed paths return 404).
- The page credits capitalstake.com as the data provider.

Open work: find the history and market-watch feed; check PSX and provider terms before redistributing data in a public app; a static GitHub Pages site probably cannot call PSX from the browser (cross-origin), so the likely design is a scheduled job that writes a JSON snapshot the site loads (untested). Also needed: the full sector company list (for `capRange` and peer percentiles) and a corporate-action adjustment for splits and bonus issues.

## 11. Migration plan

Each step ends with tests and a build.

1. **VisualSpec boundary.** Add the `VisualSpec` mapping and tests for the existing channels; the renderer reads it. No visual change.
2. **Fundamentals and history.** Add `sharesOutstanding` and sector/market `capRange` to config; extend the generator to produce multi-year history; compute smoothCap, C, Y, B.
3. **Ladder and derived construction.** Replace slot state with the level ladder and bounded-replay construction (§5); `startTier` leaves config.
4. **Visual vocabulary.** Remove flags and beacon tints; add light pools and beams; apply composition rules; move lit windows to Activity.
5. **Per-sector ladders.** Build the level steps for banks, oil, cement, tech, each with its Health closure and hard-move effects.
6. **PsxSource.** Implement the adapter once the data feed is settled.

### Step 3 notes (built)

- The ladder, the construction timeline and the size series are in `engine/ladder.ts`, `engine/construction.ts` and `engine/market.ts`. `startTier` is gone; pads, tier and expansion on `CompanyState` now come from the timeline, so the renderer is unchanged.
- **Upgrade levels (3, 6, 10) have no art yet.** Their projects run on the timeline and change nothing on screen until step 5.
- **Demo clock.** With the real rules (60-day smoothing, 5-year range ratio 4) 40 trading days barely move any company. The two demo scenarios override this (`size` on the scenario: 12-day smoothing, 3-day dwell, 1.3× range) so growth and decline show in weeks. Real data uses neither override.
- A wind-down shows as the building stepping back through its stages under a tarp (paused); a footprint level's land reverts once its building is gone.
- The demo bar adds a "Sites:" line computed from the snapshots, so the captions no longer describe construction by hand.
- `scale` (tower height and props) is still the placeholder in `companies.ts`; deriving it from size comes with the art in step 5.

### Step 4 notes (built)

- **Flags, beacon tints and the volatility flicker are gone**, for companies, districts and the Exchange. Direction is a **light pool** on the plot (`world/effects/LightPool.tsx`): a soft sunlit patch when up, a cloud shadow when down, nothing when flat. A district's park and the Exchange plaza get the same pool from breadth; district lamps and the Exchange dome shine brighter as breadth rises (`glowFor`).
- **Frantic is movement style**: `pace(jitter)` speeds up everything that moves on a plot (up to 1.9× when wild). The flare and kiln flicker that used volatility is removed.
- **Lit windows already followed Activity** (and stay dark in a closed building), so nothing moved; the composition rules (`movingVehicles`, `crewMax`, `openBayCount`) now live in `engine/visual.ts` with tests.
- **New high** now raises a pillar of gold light as well as the golden crown. The other event effects are unchanged; the per-sector hard-move effects (§6) belong to step 5.
- **Phone HUD:** the site-news line from step 3 made the player bar swallow the map at 320px. On phones the caption now takes the full width under the day pill and picker, capped at four lines, and the news shows two items plus a count. Checked at 375px and 320px.

## 12. Items to tune by eye, and open questions

Starting numbers to tune: all band thresholds, weights (0.7/0.3 ceiling; 0.35/0.25/0.40 health; 0.7/0.3 activity), the 60-day and 5-year windows, build durations, hysteresis margins, the level at which footprint steps.

Open:
- Does the light pool read clearly enough for Direction at the zoomed-out view? Prototype on one company before committing.
- Is market cap an acceptable proxy for size, given it measures valuation rather than assets? The ceiling function stays isolated so book value or assets can replace it later.
- Where does the sector's `capRange` come from for the simulation, and how often is it refreshed for live data?
- Does Health need a market-relative component beyond the absolute return term?
