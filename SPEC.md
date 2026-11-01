# PSX World — Spec v1

A stylized, isometric city that shows how the Pakistan Stock Exchange is behaving. Companies are buildings, sectors are districts, and market behavior changes what happens in the city. You learn what the market is doing by looking at the city, not by reading charts.

**The one test that matters:** when the simulated market changes, the city changes in a way you can read at a glance and that is fun to watch.

### Not in scope (for now)
Trading, portfolios, advice, accounts, multiplayer, live PSX feed, historical replay, game mechanics (resources, upgrades, quests), every listed company, a dedicated mobile layout (phones get the same view with drag and pinch-zoom).

### Prior art and what we take from it

| Project | What it is | Lesson for us |
|---|---|---|
| [StockCity](https://newatlas.com/stockcity-fidelity-labs-oculus-rift-3d-investing/34868) (Fidelity Labs, ~2014) | Stocks as buildings, sectors as neighborhoods, building height follows price, weather = market mood | Confirms sectors-as-districts and weather-as-mood. But a skyline of moving heights is a bar chart in 3D and didn't stick. **We use behavior, not bar heights** |
| [CodeCity](https://www.inf.usi.ch/en/node/8674) / [CodeCharta](https://www.maibornwolff.de/en/know-how/code-visualisation-with-codecharta/) | Code as a city: classes are buildings, packages are districts | A [controlled study](https://www.inf.unibz.it/~rrobbes/p/ICSE2011-codecity.pdf) found the city layout made people faster and more accurate, but only with consistent mappings and click-to-inspect. **Keep one channel per dimension, and keep the legend and inspect panel** |
| [Git City](https://cdn.jsdelivr.net/gh/srizzon/git-city@main/README.md) | GitHub profiles as buildings in a shared city (React Three Fiber) | Same stack as ours, and the idea spread widely. Charm and a clear "that's my building" moment matter as much as accuracy |
| [TxStreets](https://checker.gitcoin.co/public/project/show/txstreets) | Crypto blocks as buses, transactions as people trying to board them | The closest to our spirit: activity shown as agents doing things. **Activity = agents in motion** |

**Our gap:** none of these separate long-term health from today's move, and none show growth as construction over time. That combination is what makes PSX World a living world rather than a chart.

---

## 1. Look and feel

- **Style:** chunky, cartoonish, low-poly. Think mobile city-builder: saturated colors, simple shapes, slightly exaggerated proportions, rounded silhouettes, soft shadows. No textures and no realism. Colors come from flat materials, and detail comes from shape.
- **Camera:** fixed isometric angle. Pan and zoom only, no rotation. On load the whole city fits on screen.
- **Lighting:** one sun direction, soft shadows, light ambient fill. Window lights and beacons glow.
- **Calm by default:** a normal day is gentle and quiet. Motion and effects build up only when the data calls for them.
- **Original art:** the style belongs to the genre, but the buildings are our own designs. We don't copy any specific game's assets. We also don't use company logos; companies are told apart by architecture, accent color and size.

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| App | Vite + React + TypeScript | No existing repo, so no reason for Next.js |
| 3D | Three.js via `@react-three/fiber` + `drei` | An orthographic camera gives a true isometric look, plus free depth sorting, lighting and shadows |
| Per-frame animation | `useFrame` + refs, `InstancedMesh` for people, cars and particles | Keeps animation out of React re-renders |
| UI state | Zustand | Small store shared by the world and the panels |
| Tests | Vitest | State engine and simulation are pure TS and easy to test |
| Assets (M1–M3) | Built in code from boxes, cylinders, cones and extrusions | Fast to change, always consistent |
| Assets (M4) | Optional GLB kit modeled in Blender (by hand or via Blender MCP), same flat-color style | Only after the concept is proven |

Rules:
- The state engine (`/engine`) is plain TypeScript and never imports Three or React.
- The renderer reads state and never computes market signals itself.
- Same scenario + same seed = same city every time.

## 3. World layout

- A tile grid (1 tile = 1 world unit). Everything is placed on tile coordinates.
- The **PSX Exchange** sits in the center on a plaza.
- A ring road around the plaza, with four **districts** off it, one per quadrant:
  - Commercial Banks: tidy downtown, glass towers, plazas
  - Oil & Gas: dusty industrial yard, rigs, tanks, pipelines
  - Cement: quarry, kilns, silos, conveyors, truck yard
  - Tech & Communication: campus, data centers, antenna towers, network lines
- Each company gets a **lot**: a 14×14 piece of land reserved for its biggest possible site, with streets on all four sides. Districts are a 2×2 grid of lots (three companies and a park).
- Inside its lot, a company occupies a **site** whose depth depends on its **tier** (§8). The site spans the lot's full width, starts at the lot's back edge (farthest from the camera) and grows toward the camera, so new buildings always appear in front of old ones. Land it hasn't grown into yet is grass and trees in front of it.
- **Height rule:** from this camera a tall thing only hides what is behind it, toward the lot's back corner (a point *k* tiles behind at height *y* is hidden by something of height *h* when *k + y < h*). So tall buildings stand along the lot's two back edges, where nothing is behind them, and low buildings fill the middle and front.
- Each tier's site is designed up front, like a building level in a tycoon game:
  - core buildings
  - one **truck bay** (or parking space) per vehicle, so vehicles never share a spot
  - **expansion slots**: visible empty pads reserved for specific future buildings
  - walking lanes that people and vehicles use
- The layout is designed by hand, not a geographic map.

## 4. Companies (initial set)

Configured in `config/companies.ts`, not hardcoded in components.

| Sector | Tickers |
|---|---|
| Commercial Banks | MEBL, HBL, UBL |
| Oil & Gas Exploration | OGDC, PPL, MARI |
| Cement | LUCK, DGKC, FCCL |
| Tech & Communication | SYS, TRG, AVN |

Each entry: `ticker`, `name`, `sectorId`, `scale` (0–1, relative size), `accentColor`, `archetype` (which building recipe to use), `plot` (which lot), `startTier` (site tier on day 1, so sites differ in size from the start).

## 5. Time model

The original spec mixed long-term "health" and construction with a single-day demo. That doesn't work, so the simulation runs over **trading days**:

- A scenario is **~20 trading days**. Each day has **8 intraday ticks**.
- At 1× speed one day takes about 20 seconds. Speeds: 0.5×, 1×, 2×, 4×. You can also step forward or back one tick or one day.
- **Per tick:** operational state updates (direction, activity, volatility) and events fire.
- **End of day:** structural state updates (health, construction progress).
- The clock is always shown as "Day 7 · 11:30", labeled **Simulated**.

## 6. Company state

Each dimension is separate and has a small number of levels.

| Dimension | Levels | Computed from | Updates |
|---|---|---|---|
| **Scale** | number 0–1 | config (later: market cap rank in sector) | rarely |
| **Health** | `STRUGGLING · WEAK · STEADY · STRONG · THRIVING` | 20-day return, blended with how the company ranks within its sector | end of day |
| **Direction** | `DOWN_HARD · DOWN · FLAT · UP · UP_HARD` | today's % change so far | per tick |
| **Activity** | `QUIET · NORMAL · BUSY · FRENZY` | today's volume ÷ 20-day average volume | per tick |
| **Volatility** | `CALM · CHOPPY · WILD` | intraday range and size of tick-to-tick swings | per tick |
| **Events** | list of active events | see §10 | as they happen |

Changes from the original: "momentum" and "direction" are merged into one *Direction* (Health already covers the long term). "Significance" is no longer a state; it's a computed number, `scale × size of the move`, used only to size event effects.

Starting thresholds (to be tuned by eye):
- Activity, volume ratio: `<0.6` QUIET, `0.6–1.5` NORMAL, `1.5–3` BUSY, `>3` FRENZY
- Direction, day %: `±0.75` FLAT, `0.75–3` UP/DOWN, `>3` UP_HARD/DOWN_HARD

## 7. Visual language: one channel per dimension

This is the core rule of the spec. **Each dimension owns one visual channel**, so a viewer can read them separately and the channels never fight each other.

| Dimension | Visual channel | Notes |
|---|---|---|
| **Scale** | Starting site tier, building height, number of props | Never changes from price ticks |
| **Health** | Completeness and upkeep: expansions built, flags and greenery, lit vs dark windows, small cracks or tarps when weak | Long-term. Never demolishes anything |
| **Direction** | **A flag on the company's mast:** raised high (up), halfway (flat), low (down). Plus a warm or cool tint on the beacon light | The one clear up/down cue. Shape *and* color, so it doesn't depend on red/green alone |
| **Activity** | Number and speed of people, vehicles and moving machines | Busy ≠ up. A falling stock can be frantic |
| **Volatility** | Rhythm: machines stutter, beacons flicker, the flag flaps hard | Not shaking buildings, just irregular motion |
| **Events** | Temporary effects on that plot only (see §10) | Always end |

**Hard rule: price never changes building height.** Height comes only from Scale and completed construction. Tying height to price would turn the city into a bar chart (the StockCity trap above).

A **legend** (toggle in the UI) explains this table in plain words with small icons. It is required, not optional: CodeCity's study only showed a benefit with legible mappings and click-to-inspect.

## 8. Construction and growth (site tiers)

Growth works like upgrading a base in a tycoon game: fill the land you have, then enlarge the site.

**Site tiers.** Each archetype defines three tiers, each reaching deeper into the lot from its back edge: 6 rows → 10 rows → the whole 14×14 lot. A company starts at its configured tier with every slot of lower tiers already built.

**Growth order**, one project at a time:
1. Build the current tier's expansion slots, in their designed order.
2. When all of them are built, **expand the site** to the next tier. That unlocks the next tier's slots, bays and lanes.
3. At the top tier with every slot built, growth stops. The site stays as it is.

Every project, building or site expansion, goes through the same lifecycle:
`EMPTY → STAKED → FOUNDATION → FRAME → COMPLETE`

| Stage | Building | Site expansion |
|---|---|---|
| STAKED | survey stakes and rope on the empty pad | survey stakes along the new boundary |
| FOUNDATION | concrete slab and rebar | new land cleared and graded (trees removed) |
| FRAME | scaffold, crane, half-built structure | fence and gravel going in |
| COMPLETE | finished building | the site is now one tier bigger |

Rules:
- The first project **starts** after Health has been STRONG or better for **3 consecutive days**. Each later project starts the next day, as long as Health stays STRONG.
- A project **advances** one stage for each day Health stays STRONG or better.
- It **pauses** (crane stops, workers leave, tarp goes on) when Health drops below STRONG. It resumes when Health recovers.
- **Nothing is ever undone.** Built buildings stay; a site never shrinks. Long decline shows through Health visuals (idle machines, dark windows, tarps, patches), not demolition.
- Capacity follows the site: a bigger site has more bays, so a busy day puts more trucks on the road.

**Decline.** A falling company winds down instead of shrinking. The newest capacity is idled first, so the order of growth plays backwards as upkeep, never as demolition. When Health recovers, everything runs again. Cement:

| Health | What changes |
|---|---|
| STEADY and up | Everything runs |
| WEAK | Newest kiln line mothballed: drum wrapped in a tarp, burner cold, no smoke, chained off. About a third of the truck bays coned off. Crew cut to 60% |
| STRUGGLING | Only the first kiln line runs. Two thirds of the bays closed. Crew cut to 35%. Windows boarded up, silos patched, weeds in the yard |

The other archetypes follow the same rule:

| Health | Banks | Oil & Gas | Tech |
|---|---|---|---|
| WEAK | front-most building closed: TO LET board, roof greyed | newest pumpjack shut in: still, grey, red tag | front-most building closed: servers or windows dark, TO LET board |
| STRUGGLING | only the HQ open; ATM out, fountain dry, weeds | only the first pumpjack runs; flare out, tanks rusting, dry scrub | only the HQ open; café shut, lawn overgrown |

Banks and tech close their front-most building first rather than the newest, so the first closure is always in view; the HQ never closes. All archetypes also close bays and cut the crew as cement does.

A paused project gets a tarp draped over the whole structure from the top and pegged to the ground.

## 9. Sector-specific operations

The same channels apply everywhere, but each district shows *activity* in its own way:

| District | Quiet | Busy / Frenzy |
|---|---|---|
| Banks | few people, few lit windows, a cash van parked | crowds on the plaza, cars and the cash van in every bay, nearly every window lit |
| Oil & Gas | pumpjacks nodding slowly, small flare | pumpjacks fast, big flare, tankers in every bay |
| Cement | conveyor slow, one truck parked | conveyor fast, trucks in every bay, kiln glowing, thick smoke |
| Tech | rare data pulses along the network line | rapid pulses, servers blinking, lit windows, delivery drones over the HQ |

**Site plan.** Every archetype uses one plan within its lot: a vehicle strip along the side street on the right (one vehicle per bay, always at the front of the view), the build area beside it, and a strip of new land at the front per tier. Tall parts stand on the back edges, low parts in front. Tier designs:

| | Tier 1 core | Tier 1 pad | Tier 2 pads | Tier 3 pads |
|---|---|---|---|---|
| Banks | HQ tower, plaza, ATM | branch hall | second tower, office wing | tallest tower, second wing, rotunda |
| Oil & Gas | drilling rig, tank, flare, control hut, pumpjack | pumpjack | pumpjack, tank pair | pumpjack, gas processing unit, tank pair |
| Cement | kiln line, quarry, conveyor, silos, hall | silo bay | kiln line, loading wing | kiln line, clinker dome, loading wing |
| Tech | glass HQ, antenna, network line | data center | office block, data center | lab dome, data center, dish farm |

These are visual metaphors, not claims about real production.

## 10. Events (v1 set)

Each event has: `id`, `target` (company / sector / market), `type`, `startTick`, `durationTicks`, `magnitude` (0–1 from the significance number). Effects scale with magnitude and always end.

| Event | Trigger (starting rule) | Effect |
|---|---|---|
| Volume spike | activity hits FRENZY | burst of extra agents, spotlight sweep |
| Big move up | direction UP_HARD and magnitude above threshold | fireworks or confetti, size scaled by magnitude |
| Big move down | direction DOWN_HARD and magnitude above threshold | sirens or warning lights, smoke puffs |
| New 20-day high | close above 20-day high | gold trim glows on the main building for a day |
| New 20-day low | close below 20-day low | lights dim on the main building for a day |
| Trading halt | scripted | that plot freezes, barrier tape appears; nothing else stops |
| Resume | scripted | short "power back on" effect |
| Dividend | scripted | themed shower: gold sparkles (banks), energy pulse (oil), material puffs (cement), data burst (tech) |

Later: IPO (a new company built through the full construction lifecycle), announcements.

**Cooldown:** the same event type can't fire on the same company more than once every 2 days of simulated time.

## 11. Sector and market

**Sector state**, from its companies:
- `breadth` = share of companies with direction UP or better, minus share DOWN or worse (−1…+1). Uses company states, not the average return.
- `activity` = average activity level.
- The district shows these through **shared props**: street lamps, a district landmark (bank plaza fountain, oil flare tower, cement water tower, tech antenna mast), and ambient traffic on district roads.
- **Sector rally / selloff** only fires when breadth ≥ +0.67 or ≤ −0.67 (with 3 companies: all three, or at least two strongly). One star company can't light up the district.

**Market state**, from all companies:
- `breadth` (same formula across all 12), weighted lightly by scale.
- `QUIET · NORMAL · BROAD_RALLY · BROAD_SELLOFF · STORMY` (stormy = high volatility across many companies).
- Shown through the **Exchange landmark** (its beacon and plaza crowd) and the **sky**: a slightly warmer, brighter sky in broad rallies, overcast in broad selloffs, light rain when stormy. Subtle, never a full-screen effect.

**As built (M3 part 2):**
- Sector and market state are computed every tick in `engine/aggregate.ts`; thresholds live in `AGGREGATE_RULES`. A mood must hold 2 ticks before it shows. Market mood is BROAD_RALLY / BROAD_SELLOFF at breadth ±0.5, QUIET when average activity is low, else NORMAL; `stormy` is a separate flag (a quarter of companies WILD, or 60% CHOPPY or worse), never set during a broad rally.
- District landmarks sit in each park: bank fountain (jets rise with activity), oil flare tower (flame grows), cement water tower (lamp spins faster), tech lattice mast. Around each: lamp posts in the district's beacon color (warm up, cool down), a district flag at breadth height, bunting only in a sector rally, and cars on the district's outer streets (count and speed follow sector activity).
- The Exchange: dome beacon in the market's beacon color, a big market flag at breadth height, and a plaza crowd that follows market activity.
- The sky gradient and sunlight ease toward the market mood; rain falls when stormy.
- Scenario plans can `gap` at the open, so a rally can show from the first tick of the day.

- Clicking a district's park opens its card: mood, breadth meter, activity, each company's move (click through to the company) and why the district looks the way it does. The legend (button or `L`) explains every channel.

**Cross-sector links:** dropped. Tech network arcs between the districts were built and removed after review: they cluttered the view. Districts stay visually separate.

## 12. Stability rules (no flicker)

- **Smoothing:** levels are computed from a rolling value, not a single raw tick.
- **Hysteresis:** to move up a level, the value must clear the threshold by 10%; to drop back, it must fall 10% below.
- **Minimum dwell:** a company stays in a level for at least 2 ticks.
- **Cooldowns** on events (see §10).
- **Smooth transitions:** the renderer eases between levels (agents fade in and out, the flag glides up and down) instead of snapping.

## 13. Data layer

```ts
interface Observation {
  ticker: string;
  day: number;
  tick: number;
  price: number;
  volume: number;
}

interface MarketSource {               // adapter boundary
  next(): Observation[] | null;        // one tick of observations for all tickers
  reset(): void;
}
```

- v1: `ScenarioSource`, a seeded generator driven by a scenario script (see §14).
- Later: a `PsxSource` that implements the same interface. Nothing above the engine changes.
- 20 days of "history" before Day 1 are generated so 20-day averages work from the start.
- Every simulated number is labeled **Simulated** in the UI. Never present it as real PSX data.

## 14. Demo scenario ("Two months on the Exchange")

Forty trading days, so growth and decline have room to play out. It loads first; the older "Lucky Cement in focus" scenario stays in the picker. Each day's caption describes what is on screen that day (construction moves on at each day's close).

| Days | What happens | What you should see |
|---|---|---|
| 1–2 | Normal market; day 2 quiet | Calm city; on day 2 a hazier sky and a nearly empty Exchange plaza |
| 3 | SYS volume spike | Searchlights and racing pulses on SYS; others unchanged |
| 5–8 | All three banks gap up together; SYS keeps climbing | Bank district rallies: bunting, warm lamps, fountain jets high; SYS builds an office block |
| 6 | OGDC frenzy, price flat | Oil yard frantic but OGDC's flag stays at half-mast (busy ≠ up) |
| 9–13 | Cement weakens broadly; MEBL and HBL build | Fewer trucks, slower conveyors; MEBL's second tower goes up |
| 10 | DGKC trading halt and resume | Only DGKC's plot freezes |
| 12 | AVN wild swings, ends flat | Stutter and flicker, flag flapping, no clear direction |
| 14–15 | Broad selloff, day 15 the worst | Overcast sky, cool lamps, flags drop everywhere, rain on day 15; MEBL, HBL and SYS stop building under tarps |
| 17 | Relief rally | Almost everything opens higher; the sky clears with a warm horizon |
| 16–25 | Uneven recovery: banks and tech first, cement lags | MEBL and SYS resume; MEBL grows to tier 3; HBL's project stays shelved |
| 18 | LUCK dividend | Material shower over LUCK only |
| 24–40 | HBL slides | Branch hall closes (weak, day 28), then only the HQ stays open (struggling, day 31) |
| 26–40 | OGDC slides | A pumpjack shut in and the flare out (struggling, day 28) |
| 16–40 | MARI climbs steadily | Builds a pumpjack, then grows its site to tier 2 (day 35) |
| 26–40 | FCCL recovers; UBL, PPL, TRG edge up | FCCL builds a silo bay; the steady risers start projects late |
| 36–39 | The stars finish | MEBL (day 36) and SYS (day 39) have built out their whole lot |

## 15. UI

- **World first.** All UI is small and sits at the edges.
- **Click a company** → compact side panel: name, ticker, sector, a level for each dimension, active events, and a one-line "why it looks like this" (e.g. *"Busy because volume is 2.4× normal; flag low because it's down 1.8% today."*).
- **Click a district** → sector breadth and activity, plus which companies drive it.
- **Legend toggle** (§7).
- **Demo bar** (bottom): scenario picker, play/pause, speed, step tick/day forward and back, reset.
- **Override mode** (dev): force any company's levels to test visuals. While it's on, a clear "Override active" banner is shown.
- Respect `prefers-reduced-motion`: fewer particles, no flicker.

## 16. Project layout

```
src/
  engine/        state engine: signals, levels, hysteresis, events, construction (pure TS)
  sim/           scenario scripts, seeded generator, ScenarioSource
  config/        companies, sectors, thresholds, palette
  world/
    scene/       camera, lights, ground, roads, sky
    buildings/   archetype recipes (bank tower, rig, kiln, data center, exchange…)
    agents/      people, vehicles, drones (instanced)
    effects/     particles, flags, beacons, construction stages
  ui/            panels, legend, demo bar
  store/         Zustand store
tests/
```

## 17. Milestones

Build step by step. Each milestone ends with something you can open in a browser and judge.

**M1 — The city stands**
Isometric camera with pan and zoom, ground, roads, the Exchange, four districts, one company per sector built from code shapes, click to select. No market data yet.
*Done when:* the city looks coherent and charming even standing still.

**M2 — One company comes alive (the proof)** *(done; site tiers added after review)*
State engine + scenario source + demo bar. One company (start with LUCK; the cement chain is the most visual) fully wired: flag, activity agents, volatility rhythm, one or two events, construction slot.
*Done when:* stepping through a short script visibly takes LUCK from quiet → busy → frenzy → big move, while its neighbors stay unchanged. **If this doesn't feel good, we fix the visual language before going on.**

**M3 — Full city** *(done)*
All 12 companies (site tiers and decline visuals for banks, oil and tech, following the cement pattern), sector and market state, sky and Exchange reactions, the full demo scenario, company and district panels, legend.
*Done when:* every row of the §14 table can be seen happening.

**M4 — Polish**
Better building models (procedural, or a GLB kit), animation easing, sound (optional), performance pass.

**M5 — Real data ready**
A `PsxSource` stub plus docs on the adapter boundary. No live feed unless we decide to build one.

**Backlog** (not scheduled; pick up when there's room)
- **Asset gallery** (dev only, e.g. `?assets`): each asset alone on a turntable, with Health and Activity toggles and the file and line it lives in.
- **Visual asset editor** on top of the gallery: click a part to edit its size, position, rotation and color (type, slider, color picker or drag gizmo); duplicate or delete parts; Save writes the change into the source file through a dev-only Vite middleware, so edits are real code. Literal values only: computed values show read-only, and a repeated part edits all its copies. Plan: tag kit shapes with their source location in dev, rewrite just that JSX attribute on save.
- **Mixer truck:** the drum dips into the chassis at its back end (raise it); replace the diagonal stripe with a band around the drum, or the company's ticker.

## 18. Testing

- **Unit tests (engine):** level calculation, hysteresis and dwell, breadth math, event triggers, cooldowns and expiry, the construction lifecycle (start / advance / pause / complete / no duplicates), determinism (same seed → same states).
- **Scenario check:** a test runs the demo scenario and asserts the key states in §14 (e.g. "day 6: OGDC activity FRENZY, direction FLAT").
- **Visual check:** a short manual checklist per milestone, using override mode and the demo bar.

## 19. Open questions

- Day/night cycle tied to market hours? It looks nice but might compete with the "lit windows = activity" channel.
- Sound: ambient city noise that rises with market activity?
- After M3, which sectors come next (fertilizer, power, autos)?
- Do we eventually want a real PSX data source, and which one?
