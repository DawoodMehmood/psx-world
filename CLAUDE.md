# PSX World

Read `README.md` and `SPEC.md` first.

- Commands: `npm run dev`, `npm test`, `npm run build`.
- No responsive or mobile-specific layout work. Phones use the same view as desktop.
- Deployed to GitHub Pages from `main` and `claude/**` branches via `.github/workflows/deploy.yml`. Site: https://dawoodmehmood.github.io/psx-world/
- `vite.config.ts` sets `base: '/psx-world/'` for Pages; keep it, and use relative or base-aware asset paths.
- The live site shows whichever branch deployed last.
