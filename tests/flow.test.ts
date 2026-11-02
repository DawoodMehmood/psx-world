import { describe, expect, it } from 'vitest';
import { LOT_SIZE } from '../src/config/layout';
import { dumpDrop, flowPhase } from '../src/world/flow';
import { fencePosts } from '../src/world/fence';

describe('material flow', () => {
  it.each([1, 2, 3, 5, 8])('%d items stay evenly spaced along the belt, at any time', (count) => {
    for (const t of [0, 0.13, 0.5, 3.77, 12.31]) {
      const phases = Array.from({ length: count }, (_, i) => flowPhase(i, count, t)).sort((a, b) => a - b);
      const gaps = phases.map((p, i) => (i < phases.length - 1 ? phases[i + 1] - p : 1 - p + phases[0]));
      for (const g of gaps) expect(g).toBeCloseTo(1 / count, 9);
    }
  });

  it('moves along the belt as time passes and stays within 0…1', () => {
    expect(flowPhase(0, 4, 0.2)).toBeCloseTo(0.2, 10);
    expect(flowPhase(0, 4, 1.2)).toBeCloseTo(0.2, 10);
    expect(flowPhase(2, 4, -0.3)).toBeGreaterThanOrEqual(0);
    expect(flowPhase(2, 4, -0.3)).toBeLessThan(1);
  });

  it('drops material into the opening only in the last tenth of the belt', () => {
    expect(dumpDrop(0)).toBe(0);
    expect(dumpDrop(0.9)).toBe(0);
    expect(dumpDrop(0.95)).toBeCloseTo(0.5, 10);
    expect(dumpDrop(1)).toBeCloseTo(1, 10);
  });
});

describe('fence posts round new land', () => {
  it.each([
    [6, 10],
    [10, 14],
    [6, 14],
  ])('from z=%d to z=%d every corner has a post and the posts are no more than 1.6 apart along each side', (from, to) => {
    const posts = fencePosts(from, to);
    const has = (x: number, z: number) => posts.some(([px, pz]) => Math.abs(px - x) < 1e-9 && Math.abs(pz - z) < 1e-9);
    expect(has(0, to)).toBe(true);
    expect(has(LOT_SIZE, to)).toBe(true);
    // the two side ropes start at the old edge: their ends need posts too (these were missing before)
    expect(has(0, from)).toBe(true);
    expect(has(LOT_SIZE, from)).toBe(true);
    const front = posts.filter(([, z]) => z === to).map(([x]) => x).sort((a, b) => a - b);
    for (let i = 1; i < front.length; i++) expect(front[i] - front[i - 1]).toBeLessThanOrEqual(1.6 + 1e-9);
    const left = [...posts.filter(([x]) => x === 0).map(([, z]) => z), to].sort((a, b) => a - b);
    for (let i = 1; i < left.length; i++) expect(left[i] - left[i - 1]).toBeLessThanOrEqual(1.6 + 1e-9);
    // no post is listed twice
    expect(new Set(posts.map(([x, z]) => `${x.toFixed(6)},${z.toFixed(6)}`)).size).toBe(posts.length);
  });
});
