import { describe, expect, it } from 'vitest';
import { COMPANIES, SITE_TIERS } from '../src/config/companies';
import { DEFAULT_ROSTER, LOTS_PER_DISTRICT, ROSTER_SIZE } from '../src/config/roster';
import { SECTORS } from '../src/config/sectors';
import { LOT_COUNT, lotCenter, districtRect, districtStreets, LOT_SIZE, lotRect, mainRoads, overlaps, parkRect, signSpot, siteRect, WORLD_HALF, type Rect } from '../src/config/layout';
import { footprintTier, MAX_LEVEL } from '../src/engine/ladder';
import { shadowRadius } from '../src/world/scene/shadowFit';

const inside = (r: Rect, outer: Rect) => r.minX >= outer.minX && r.maxX <= outer.maxX && r.minZ >= outer.minZ && r.maxZ <= outer.maxZ;
const world: Rect = { minX: -WORLD_HALF, maxX: WORLD_HALF, minZ: -WORLD_HALF, maxZ: WORLD_HALF };
const roads = () => [...mainRoads(), ...SECTORS.flatMap((s) => districtStreets(s.id))];

describe('city layout', () => {
  it('gives every district room for eight lots and a roster of six distinct companies of its own sector', () => {
    expect(LOT_COUNT).toBe(LOTS_PER_DISTRICT);
    for (const s of SECTORS) {
      const lots = DEFAULT_ROSTER[s.id];
      expect(lots).toHaveLength(ROSTER_SIZE);
      expect(new Set(lots).size).toBe(ROSTER_SIZE);
      for (const t of lots) expect(COMPANIES.find((c) => c.ticker === t)?.sectorId).toBe(s.id);
    }
  });

  it('keeps lots and parks inside their district and the world, off every road and each other', () => {
    const per = LOT_COUNT + 1;
    const lots = SECTORS.flatMap((s) => [...Array.from({ length: LOT_COUNT }, (_, i) => lotRect(s.id, i)), parkRect(s.id)]);
    SECTORS.forEach((s, si) => lots.slice(si * per, si * per + per).forEach((l) => expect(inside(l, districtRect(s.id))).toBe(true)));
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
    for (const s of SECTORS) {
      for (let plot = 0; plot < LOT_COUNT; plot++) {
        const archetype = COMPANIES.find((c) => c.sectorId === s.id)!.archetype;
        for (const t of SITE_TIERS[archetype]) expect(inside(siteRect(s.id, plot, t.depth), lotRect(s.id, plot))).toBe(true);
      }
    }
  });

  it('grows every site toward the camera: deeper tiers only add land at the front (+z)', () => {
    for (const s of SECTORS) {
      const tiers = SITE_TIERS[COMPANIES.find((c) => c.sectorId === s.id)!.archetype];
      for (let plot = 0; plot < LOT_COUNT; plot++) for (let i = 1; i < tiers.length; i++) {
        const before = siteRect(s.id, plot, tiers[i - 1].depth);
        const after = siteRect(s.id, plot, tiers[i].depth);
        expect([after.minX, after.maxX, after.minZ]).toEqual([before.minX, before.maxX, before.minZ]);
        expect(after.maxZ).toBeGreaterThan(before.maxZ);
      }
    }
  });

  it('gives every archetype three tiers, one for each footprint step of the level ladder', () => {
    for (const tiers of Object.values(SITE_TIERS)) expect(tiers).toHaveLength(footprintTier(MAX_LEVEL));
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

  it('puts the camera target for every lot at the middle of that lot', () => {
    for (const s of SECTORS) for (let plot = 0; plot < LOT_COUNT; plot++) {
      const [x, z] = lotCenter(s.id, plot);
      expect(inside({ minX: x, maxX: x, minZ: z, maxZ: z }, lotRect(s.id, plot))).toBe(true);
    }
  });
});

describe('shadow fit', () => {
  it('shrinks with zoom, grows with the screen, and never exceeds its cap', () => {
    expect(shadowRadius(1280, 800, 40, 92)).toBeLessThan(shadowRadius(1280, 800, 20, 92));
    expect(shadowRadius(1280, 800, 20, 92)).toBeLessThan(shadowRadius(2560, 1600, 20, 92));
    expect(shadowRadius(1280, 800, 0.5, 92)).toBe(92);
  });

  it('covers the visible ground with room to spare', () => {
    // at the opening zoom the visible half-width is width / zoom / 2 in world units
    const zoom = 20;
    const half = 1280 / zoom / 2;
    expect(shadowRadius(1280, 800, zoom, 92)).toBeGreaterThan(half);
  });
});
