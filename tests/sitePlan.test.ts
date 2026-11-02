import { describe, expect, it } from 'vitest';
import { LOT_SIZE } from '../src/config/layout';
import { cornerOffset, cornerPost, POST_BASE_R } from '../src/world/effects/posts';
import { BURNER_X, cementSilos, cementSpots, hides, KILN_Z, siloBands, siloHeight, preheaterBands, preheaterHeight } from '../src/world/buildings/sitePlan';

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

describe('event poles stand outside the site pad', () => {
  const corners = ['frontLeft', 'frontRight', 'backLeft', 'backRight'] as const;

  it.each([6, 10, 14])('at depth %d every corner pole, base included, is clear of the pad and still on the curb side of the street', (depth) => {
    for (const corner of corners) {
      const [x, z] = cornerPost(corner, depth);
      const gapX = x < LOT_SIZE / 2 ? 0 - (x + POST_BASE_R) : x - POST_BASE_R - LOT_SIZE;
      expect(gapX, `${corner} clears the pad`).toBeGreaterThan(0.1);
      expect(gapX, `${corner} stays beside it`).toBeLessThan(0.8);
      expect(z).toBeGreaterThan(0);
      expect(z).toBeLessThan(depth);
    }
  });

  it('uses opposite corners for the two searchlights and a third for the siren', () => {
    const [a, b, c] = [cornerPost('frontLeft', 10), cornerPost('backRight', 10), cornerPost('frontRight', 10)];
    expect(Math.abs(a[0] - b[0])).toBeGreaterThan(LOT_SIZE);
    expect(c[0]).not.toBe(a[0]);
    expect([a, b].every(([x, z]) => x !== c[0] || z !== c[1])).toBe(true);
  });

  it('offsets from the site centre agree with the site coordinates', () => {
    const [x, z] = cornerPost('frontLeft', 10);
    const [ox, oz] = cornerOffset('frontLeft', 10);
    expect(ox + LOT_SIZE / 2).toBeCloseTo(x, 10);
    expect(oz + 5).toBeCloseTo(z, 10);
  });
});
