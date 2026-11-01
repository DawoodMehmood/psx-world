---
name: psx-world-assets
description: "Goals, performance budgets and measured baseline for PSX World's 3D scene. Use when adding or changing buildings, props, agents, effects, lighting or shadows, or when optimizing performance."
---

# PSX World: visual goals and budgets

These are goals, not implementation rules. The current approach (`src/world/kit.tsx`: shared unit geometries plus cached flat-color materials, assembled per building) is replaceable. If a popular, maintained alternative (drei `Instances`/`Merged`, three `BatchedMesh`, geometry merging, a CC0 GLB kit) beats it on the same scene, measure both and propose the switch.

## Visual goals
- Flat-shaded, saturated, cartoon low-poly isometric city. No realism, no PBR detail, no photo textures.
- Every building reads at a glance: sector and archetype from silhouette and color, activity from motion and light.
- New assets must sit next to existing ones without looking out of place: same palette family, same proportions, same level of detail.
- Price never changes building height (SPEC §7).

## Performance goals (proposed, not yet validated on a phone)
| Metric | Baseline 2026-11-01 | Target |
|---|---|---|
| Draw calls / frame (incl. shadow pass) | ~4,000 | under 1,000 |
| Triangles / frame | ~370,000 | under 150,000 |
| Frame rate in the dev browser pane | ~34 fps | 60 fps; 30+ on a mid-range phone |
| Shadow map | 4096×4096, 1,656 casters | 2048 or smaller, only large objects cast |

Baseline scene: default scenario at tick 0, 1024×768 viewport, devicePixelRatio 2, dev server (not a production build), run in the in-app browser pane. 3,378 meshes, 254 geometries, 215 materials, 1 instanced mesh (0 instances at tick 0), 1 directional and 1 hemisphere light. Turning the directional light's shadows off dropped calls to ~2,700 and triangles to ~215,000 but did not change fps, so the limit looks like per-draw-call CPU cost, not the GPU.

## Progress log
- 2026-11-01: scattered scenery trees (150) now render as 3 instanced meshes (`Trees` in `kit.tsx`) instead of 450 meshes. Draw calls ~4,000 → ~3,200, meshes 3,378 → 2,931, triangles unchanged. Visually identical in the default view. Frame rate in the pane read 60 vs 34 before, but the pane's frame cap may have differed between runs; don't trust fps comparisons until measured twice in one session. The company-lot and Exchange trees still use the per-mesh `Tree`.
- 2026-11-01: added `<Static>` (`src/world/Static.tsx`): merges its children into one mesh per material and shadow mode, re-merging after each commit of the owner. Use it only around parts that never move on their own (no refs, no `useFrame`); keep animated parts (windows, vehicles, workers, flags) outside it. Applied to the bank archetype's towers, wings, hall, rotunda, fountain, ATM and plaza (windows stay separate). Tick 0: draw calls ~3,200 → ~2,550, triangles ~380,000 → ~308,000 (not understood; looked identical). Day 40 (after growth): ~3,100 calls, no baseline for that day before this change. Import merge helpers from `three-stdlib`, not `three/addons`, which duplicated three.js in dev. `resolve.dedupe: ['three']` added to the Vite config. 
- 2026-11-01: applied `<Static>` to cement, oil and tech archetypes (static parts only; windows, smoke, steam, flare flame, kiln glow, pumpjack beams, server lights, drones, pulses, beacon, workers and vehicles stay separate; textured `ToLet` boards are never merged). Same-session measurements (dev server, 1024×768): tick 0 ~4,000 → ~2,000 calls, triangles ~370,000 → ~290,000; day 40 ~2,900 calls, ~367,000 triangles. Day 40 is higher because construction sites, cranes, tarps and partial buildings are not merged yet. Not yet applied: Exchange, districts, ConstructionSlot, windows, lot-site decor (`site.tsx`), company-lot and Exchange trees.

## Biggest known opportunity
Almost everything is one mesh per part (3,378 meshes). Merge or instance parts that never change independently, per building and per tier, and keep separate meshes only for parts that animate. Reuse materials (215 now, many differ only in color).

## How to measure
Dev server exposes `window.__psx` (the R3F state). In the browser console or via the browser tool:
- `__psx.gl.info.render.calls` / `.triangles` (set `gl.info.autoReset = false` and call `gl.info.reset()` to average over many frames).
- `__psx.gl.info.memory` for geometries and textures.
- Traverse `__psx.scene` to count meshes, instanced meshes and shadow casters.
Re-measure the same scenario after every optimization, and record the new baseline in the table above. Use the `threejs-debug-profiler` and `threejs-performance` skills for method.

## Rules of thumb
- New repeated things (people, cars, trees, lamps, particles) use instancing from the start.
- Share geometries and materials; never create them inside render or `useFrame`.
- No new shadow casters for small props.
- A change that raises draw calls or triangles noticeably needs a stated reason.
- Phones use the same view as desktop, but they must stay playable: performance matters, responsive layout work does not.
