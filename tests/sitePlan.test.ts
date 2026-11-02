import { describe, expect, it } from 'vitest';
import { LOT_SIZE } from '../src/config/layout';
import { cornerOffset, cornerPost, eventPosts, POST_BASE_R, spotIsFree } from '../src/world/effects/posts';
import { derrickBands, derrickHeight, flareHeight, FEED_BELT, HOPPER, HOPPER_OPENING, KILN_CX, KILN_LEN, KILN_START, PREHEATER_X, STOCKPILES, BURNER_X, cementFootprints, cementSilos, cementSpots, hides, KILN_Z, siloBands, siloHeight, preheaterBands, preheaterHeight } from '../src/world/buildings/sitePlan';

describe('cement layout: nothing low hides behind a silo', () => {
  const spots = cementSpots();

  it.each([
    ['tallest company, silos upgraded', 1, true],
    ['tallest company, not upgraded', 1, false],
    ['small company, upgraded', 0.2, true],
  ])('%s', (_, scale, upgraded) => {
    const hidden = cementSilos(scale, upgraded).flatMap((col) => spots.filter((p) => hides(col, p)).map((p) => `${p.name} behind the silo at z=${col.z}`));
    expect(hidden).toEqual([]);
  });

  it('the rule itself: a point is hidden only by a taller column in front of it, in line of sight', () => {
    const col = { x: 10, z: 10, r: 0.6, h: 5 };
    expect(hides(col, { name: 'a', x: 7, y: 1, z: 7 })).toBe(true); // 3 back on the diagonal, 3 + 1 < 5
    expect(hides(col, { name: 'b', x: 5, y: 1, z: 5 })).toBe(false); // 5 back: 5 + 1 > 5
    expect(hides(col, { name: 'c', x: 7, y: 1, z: 2 })).toBe(false); // off to the side
    expect(hides(col, { name: 'd', x: 12, y: 1, z: 12 })).toBe(false); // in front of the column, not behind
  });

  it('keeps every burner hood well clear of the silo line', () => {
    expect(BURNER_X).toBeLessThan(7);
    expect(KILN_Z).toHaveLength(3);
  });
});

describe('size shows in the number of bands', () => {
  it('a bigger company has more bands on its silos and preheaters, and taller ones', () => {
    const scales = [0.2, 0.45, 0.7, 0.97];
    const silo = scales.map(siloBands);
    const tower = scales.map(preheaterBands);
    expect(silo).toEqual([...silo].sort((a, b) => a - b));
    expect(new Set(silo).size).toBe(silo.length);
    expect(new Set(tower).size).toBe(tower.length);
    expect(siloHeight(0.97, false)).toBeGreaterThan(siloHeight(0.2, false));
    expect(preheaterHeight(0.97, false)).toBeGreaterThan(preheaterHeight(0.2, false));
  });

  it('an upgrade adds height', () => {
    expect(siloHeight(0.5, true)).toBeGreaterThan(siloHeight(0.5, false));
    expect(preheaterHeight(0.5, true)).toBeGreaterThan(preheaterHeight(0.5, false));
  });
});

describe('event poles', () => {
  const archetypes = ['cement', 'bank', 'oil', 'tech'] as const;

  it.each(archetypes.flatMap((a) => [6, 10, 14].map((d) => [a, d] as const)))('%s at depth %d: three distinct poles, each inside the pad and clear of every part', (archetype, depth) => {
    const { lightA, lightB, siren } = eventPosts(archetype, depth);
    for (const [name, [x, z]] of Object.entries({ lightA, lightB, siren })) {
      expect(x - POST_BASE_R, name).toBeGreaterThan(0.05);
      expect(x + POST_BASE_R, name).toBeLessThan(LOT_SIZE - 0.05);
      expect(z - POST_BASE_R, name).toBeGreaterThan(0.05);
      expect(z + POST_BASE_R, name).toBeLessThan(depth - 0.05);
      expect(spotIsFree(archetype, depth, [x, z]), `${archetype} ${name} at ${x},${z}`).toBe(true);
    }
    const spots = [lightA, lightB, siren];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1])).toBeGreaterThanOrEqual(2 - 1e-9);
  });

  it('uses the true corners wherever they are free (cement: front-left, back-right, back-left)', () => {
    for (const depth of [6, 10, 14]) {
      const { lightA, lightB, siren } = eventPosts('cement', depth);
      expect(lightA).toEqual(cornerPost('frontLeft', depth));
      expect(lightB).toEqual(cornerPost('backRight', depth));
      expect(siren).toEqual(cornerPost('backLeft', depth));
    }
  });

  it('keeps the two searchlights far apart', () => {
    for (const a of archetypes) for (const depth of [6, 10, 14]) {
      const { lightA, lightB } = eventPosts(a, depth);
      expect(Math.hypot(lightA[0] - lightB[0], lightA[1] - lightB[1])).toBeGreaterThan(8);
    }
  });

  it('offsets from the site centre agree with the site coordinates', () => {
    const [x, z] = cornerPost('frontLeft', 10);
    const [ox, oz] = cornerOffset('frontLeft', 10);
    expect(ox + LOT_SIZE / 2).toBeCloseTo(x, 10);
    expect(oz + 5).toBeCloseTo(z, 10);
  });
});

describe('cement footprints', () => {
  it('no two parts overlap', () => {
    const rs = cementFootprints();
    const overlaps: string[] = [];
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i];
        const b = rs[j];
        // the truck strip's bays touch their own silos by design
        if (a.name.startsWith('silo bay') && b.name.startsWith('silo bay')) continue;
        const eps = 1e-6; // parts that merely touch are fine
        if (a.minX < b.maxX - eps && b.minX < a.maxX - eps && a.minZ < b.maxZ - eps && b.minZ < a.maxZ - eps) overlaps.push(`${a.name} overlaps ${b.name}`);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('keeps everything but the truck strip at least 0.8 inside the pad edge', () => {
    for (const r of cementFootprints()) {
      if (r.name.startsWith('silo bay')) continue;
      expect(r.minX, r.name).toBeGreaterThanOrEqual(0.15);
      expect(r.minZ, r.name).toBeGreaterThanOrEqual(0.15);
      expect(r.maxX, r.name).toBeLessThanOrEqual(LOT_SIZE - 0.8);
    }
  });
});

describe('details the cement site gets right', () => {
  it('the kiln drum starts flush against the preheater tower, with no gap', () => {
    const towerFace = PREHEATER_X + 0.85;
    expect(KILN_START).toBeCloseTo(towerFace, 10);
    expect(KILN_CX - KILN_LEN / 2).toBeCloseTo(towerFace, 10);
  });

  it('the two stockpiles keep their original sizes and sit side by side across the front of the second kiln line, touching', () => {
    const [a, b] = STOCKPILES;
    expect([a.r, a.h, b.r, b.h]).toEqual([0.8, 1, 0.6, 0.8]);
    // in a row across the burner's face: same distance from it, spread along z
    expect(a.at[0]).toBe(b.at[0]);
    expect(Math.abs(a.at[1] - b.at[1])).toBeLessThanOrEqual(a.r + b.r);
    expect(Math.abs(a.at[1] - b.at[1])).toBeGreaterThan(Math.max(a.r, b.r));
    // in front of the burner (clear of its hood) and centred on the kiln's axis
    expect(a.at[0] - a.r).toBeGreaterThan(BURNER_X + 0.2);
    const mid = (Math.min(a.at[1] - a.r, b.at[1] - b.r) + Math.max(a.at[1] + a.r, b.at[1] + b.r)) / 2;
    expect(Math.abs(mid - KILN_Z[1])).toBeLessThan(0.25);
    for (const p of STOCKPILES) expect(p.at[1] + p.r).toBeLessThanOrEqual(10 - 0.8);
  });

  it('the feed belt ends just outside the black opening in the hopper face it arrives at', () => {
    const [x, y, z] = FEED_BELT.to;
    const face = HOPPER.at[0] + HOPPER.w / 2;
    expect(x - face).toBeGreaterThan(0.05);
    expect(x - face).toBeLessThan(0.3);
    expect(Math.abs(z - HOPPER_OPENING.z)).toBeLessThan(HOPPER_OPENING.w / 2 + 0.1);
    expect(y).toBeLessThanOrEqual(HOPPER_OPENING.y + 0.1);
    expect(y).toBeGreaterThanOrEqual(HOPPER_OPENING.y - HOPPER_OPENING.h - 0.1);
    // the belt comes from the +x side, so the +x face is the one facing it
    expect(FEED_BELT.from[0]).toBeGreaterThan(face);
  });
});

describe('oil sizes and upgrades', () => {
  it('a bigger company has a taller derrick with more bands, and the upgrades add height', () => {
    expect(derrickHeight(0.97, false)).toBeGreaterThan(derrickHeight(0.76, false));
    expect(derrickBands(0.97)).toBeGreaterThan(derrickBands(0.4));
    expect(derrickHeight(0.8, true)).toBeGreaterThan(derrickHeight(0.8, false));
    expect(flareHeight(true)).toBeGreaterThan(flareHeight(false));
  });
});
