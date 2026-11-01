# PSX World

Read `README.md` and `SPEC.md` first.

- Commands: `npm run dev`, `npm test`, `npm run build`.
- No responsive or mobile-specific layout work. Phones use the same view as desktop.
- Deployed to GitHub Pages from `main` and `claude/**` branches via `.github/workflows/deploy.yml`. Site: https://dawoodmehmood.github.io/psx-world/
- `vite.config.ts` sets `base: '/psx-world/'` for Pages; keep it, and use relative or base-aware asset paths.
- The live site shows whichever branch deployed last.

## Syncing across devices (laptop and phone)

The user switches between laptop and cloud sessions without warning, so GitHub `main` must always hold the latest work and nothing may sit only on one device.

- **Session start:** run `git fetch`, then merge any newer `main` and unmerged `claude/**` branches into the working branch. Tell the user what changed since last time.
- **After each completed change:** run `npm test` and `npm run build`; if both pass, commit and push, and get the work into `main` (push to `main` directly, or fast-forward `main` from the `claude/` branch). Each push redeploys the site.
- **Unfinished or failing work:** still commit and push, but to a `claude/` branch, never to `main`.
- **Never leave uncommitted changes** at the end of a turn.
- If pushing to `main` is blocked, say so and leave the work on the `claude/` branch.

## Third-party skills (in `.claude/skills/`)

- `threejs-*` (except `threejs-debug-profiler`): CloudAI-X/threejs-skills, MIT, pinned at commit 0e18186. Three.js r186, R3F 9, drei 10.
- `threejs-debug-profiler`: majidmanzarpour/threejs-game-skills, MIT, commit 8286774. Use it to baseline draw calls, triangles and memory before optimizing.
- The look is a flat-shaded cartoon low-poly city, not a realism showcase (see SPEC.md). That look and the performance budget are the goals; the current implementation (`src/world/kit.tsx`, procedural shapes) is not sacred. If a popular, well-maintained approach (instancing or merging helpers, a CC0 GLB kit, etc.) measurably beats it on the same scene, propose switching and compare against a measured baseline first.
