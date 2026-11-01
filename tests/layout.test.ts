import { describe, expect, it } from 'vitest';
import { COMPANIES, SITE_TIERS } from '../src/config/companies';
import { SECTORS } from '../src/config/sectors';
import { districtRect, districtStreets, LOT_SIZE, lotRect, mainRoads, overlaps, parkRect, signSpot, siteRect, WORLD_HALF, type Rect } from '../src/config/layout';

const inside = (r: Rect, outer: Rect) => r.minX >= outer.minX && r.maxX <= outer.maxX && r.minZ >= outer.minZ && r.maxZ <= outer.maxZ;
const world: Rect = { minX: -WORLD_HALF, maxX: WORLD_HALF, minZ: -WORLD_HALF, maxZ: WORLD_HALF };
const roads = () => [...mainRoads(), ...SECTORS.flatMap((s) => districtStreets(s.id))];

describe('city layout', () => {
  it('gives every sector exactly three companies on distinct lots', () => {
    for (const s of SECTORS) {
      const plots = COMPANIES.filter((c) => c.sectorId === s.id).map((c) => c.plot);
      expect(plots.sort()).toEqual([0, 1, 2]);
    }
  });

  it('keeps lots and parks inside their district and the world, off every road and each other', () => {
    const lots = SECTORS.flatMap((s) => [lotRect(s.id, 0), lotRect(s.id, 1), lotRect(s.id, 2), parkRect(s.id)]);
    SECTORS.forEach((s, si) => lots.slice(si * 4, si * 4 + 4).forEach((l) => expect(inside(l, districtRect(s.id))).toBe(true)));
    lots.forEach((a, i) => {
      expect(inside(a, world)).toBe(true);
      roads().forEach((r) => expect(overlaps(a, r)).toBe(false));
      lots.forEach((b, j) => i !== j && expect(overlaps(a, b)).toBe(false));
    });
  });

  it('fits every site tier inside its lot, each tier deeper than the last, the last filling the lot', () => {
    for (const tiers of Object.values(SITE_TIERS)) {
      tiers.forEach((t, i) => {
        expect(t.depth).toBeLessThanOrEqual(LOT_SIZE);
        if (i > 0) expect(t.depth).toBeGreaterThan(tiers[i - 1].depth);
      });
      expect(tiers[tiers.length - 1].depth).toBe(LOT_SIZE);
    }
    for (const c of COMPANIES) {
      for (const t of SITE_TIERS[c.archetype]) expect(inside(siteRect(c.sectorId, c.plot, t.depth), lotRect(c.sectorId, c.plot))).toBe(true);
    }
  });

  it('grows every site toward the camera: deeper tiers only add land at the front (+z)', () => {
    for (const c of COMPANIES) {
      const tiers = SITE_TIERS[c.archetype];
      for (let i = 1; i < tiers.length; i++) {
        const before = siteRect(c.sectorId, c.plot, tiers[i - 1].depth);
        const after = siteRect(c.sectorId, c.plot, tiers[i].depth);
        expect([after.minX, after.maxX, after.minZ]).toEqual([before.minX, before.maxX, before.minZ]);
        expect(after.maxZ).toBeGreaterThan(before.maxZ);
      }
    }
  });

  it('gives every archetype three tiers and starts each sector’s biggest company on a bigger site', () => {
    for (const tiers of Object.values(SITE_TIERS)) expect(tiers).toHaveLength(3);
    for (const s of SECTORS) {
      const inSector = COMPANIES.filter((c) => c.sectorId === s.id);
      const biggest = inSector.reduce((a, b) => (b.scale > a.scale ? b : a));
      const smallest = inSector.reduce((a, b) => (b.scale < a.scale ? b : a));
      expect(biggest.startTier).toBeGreaterThan(smallest.startTier);
    }
  });

  it('stands each district sign inside its park', () => {
    for (const s of SECTORS) {
      const [x, z] = signSpot(s.id);
      // Board is ~3.8 wide with its frame, turned 45°, so it reaches ~1.4 along each axis.
      const sign: Rect = { minX: x - 1.4, maxX: x + 1.4, minZ: z - 1.4, maxZ: z + 1.4 };
      expect(inside(sign, parkRect(s.id))).toBe(true);
    }
  });

  it('uses unique tickers', () => {
    expect(new Set(COMPANIES.map((c) => c.ticker)).size).toBe(COMPANIES.length);
  });
});
