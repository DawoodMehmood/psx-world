import { describe, expect, it } from 'vitest';
import { LOT_SIZE } from '../src/config/layout';
import { bankFootprints, oilFootprints, techFootprints, type Rect } from '../src/world/buildings/siteFootprints';

const sites: [string, () => Rect[]][] = [
  ['banks', bankFootprints],
  ['oil', oilFootprints],
  ['tech', techFootprints],
];

describe.each(sites)('%s site footprints', (_, footprints) => {
  it('no two parts overlap', () => {
    const rs = footprints();
    const overlaps: string[] = [];
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i];
        const b = rs[j];
        if (a.name.startsWith('bay') && b.name.startsWith('bay')) continue;
        const eps = 1e-6;
        if (a.minX < b.maxX - eps && b.minX < a.maxX - eps && a.minZ < b.maxZ - eps && b.minZ < a.maxZ - eps) overlaps.push(`${a.name} overlaps ${b.name}`);
      }
    }
    expect(overlaps).toEqual([]);
  });

  it('keeps every part inside the pad, and off the back and left edges by a few tenths', () => {
    for (const r of footprints()) {
      expect(r.minX, r.name).toBeGreaterThanOrEqual(0.15);
      expect(r.minZ, r.name).toBeGreaterThanOrEqual(0.05);
      expect(r.maxX, r.name).toBeLessThanOrEqual(LOT_SIZE);
      expect(r.maxZ, r.name).toBeLessThanOrEqual(LOT_SIZE + 1e-6);
    }
  });
});
