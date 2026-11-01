import { describe, expect, it } from 'vitest';
import { SIZE_RULES } from '../src/config/thresholds';
import { BuiltLevelTracker, builtLevel, ceilingLevel, cyclePosition, logPosition, smoothCap, smoothSeries } from '../src/engine/size';
import { generateCapHistory } from '../src/sim/history';
import { CAP_SEEDS, simulatedSizes } from '../src/sim/capSeeds';

const SECTOR = { low: 10, high: 1000 };
const MARKET = { low: 1, high: 2000 };

describe('logPosition', () => {
  it('is 0 at the low end, 1 at the high end, and the geometric middle is 0.5', () => {
    expect(logPosition(10, 10, 1000)).toBe(0);
    expect(logPosition(1000, 10, 1000)).toBe(1);
    expect(logPosition(100, 10, 1000)).toBeCloseTo(0.5, 10);
  });

  it('clamps beyond the range: hard stops at both ends', () => {
    expect(logPosition(5000, 10, 1000)).toBe(1);
    expect(logPosition(1, 10, 1000)).toBe(0);
  });

  it('reads a degenerate range as the middle', () => {
    expect(logPosition(50, 100, 100)).toBe(0.5);
  });
});

describe('smoothing', () => {
  it('averages the last N values', () => {
    expect(smoothCap([1, 2, 3, 4, 5, 6], 3)).toBe(5);
    expect(smoothCap([4], 60)).toBe(4);
  });

  it('rolling series matches the mean of each trailing window', () => {
    expect(smoothSeries([1, 2, 3, 4, 5], 3)).toEqual([1, 1.5, 2, 3, 4]);
  });
});

describe('ceilingLevel', () => {
  it.each([
    // the sector's smallest company still sits above the market's smallest, so it is level 2, not 1
    [10, 2],
    [1000, 10],
    [5000, 10],
    [0.5, 1],
  ])('cap %d gives level %d, with hard stops at both ends', (cap, level) => {
    expect(ceilingLevel(cap, SECTOR, MARKET)).toBe(level);
  });

  it('rises with cap', () => {
    const levels = [10, 30, 100, 300, 1000].map((c) => ceilingLevel(c, SECTOR, MARKET));
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(levels[0]).toBeLessThan(levels[4]);
  });

  it('keeps a mid company of a tiny-cap sector below a leader of a big one', () => {
    const tiny = { low: 1, high: 10 };
    expect(ceilingLevel(5, tiny, MARKET)).toBeLessThan(ceilingLevel(500, SECTOR, MARKET));
  });
});

describe('cyclePosition', () => {
  const ramp = (n: number, from: number, to: number) => Array.from({ length: n }, (_, i) => from * (to / from) ** (i / (n - 1)));

  it('is null with too little history', () => {
    expect(cyclePosition(ramp(SIZE_RULES.minCycleDays - 1, 1, 2))).toBeNull();
  });

  it('is 1 at the window high and 0 at the window low', () => {
    expect(cyclePosition(ramp(400, 10, 40))).toBeCloseTo(1, 10);
    expect(cyclePosition(ramp(400, 40, 10))).toBeCloseTo(0, 10);
  });

  it('is the middle when the cap is flat', () => {
    expect(cyclePosition(new Array(300).fill(50))).toBe(0.5);
  });
});

describe('builtLevel', () => {
  it.each([
    [10, 1, 10],
    [10, 0, 1],
    [10, 0.5, 6],
    [6, 1, 6],
    [1, 0.7, 1],
    [3, 0.5, 2],
  ])('ceiling %d at cycle %d gives level %d', (ceiling, cycle, level) => {
    expect(builtLevel(ceiling, cycle)).toBe(level);
  });

  it('never exceeds the ceiling and uses the full ceiling with no cycle', () => {
    expect(builtLevel(4, 5)).toBe(4);
    expect(builtLevel(7, null)).toBe(7);
  });

  it('a small company at its all-time high stops at its own small ceiling', () => {
    expect(builtLevel(ceilingLevel(12, SECTOR, MARKET), 1)).toBeLessThanOrEqual(3);
  });
});

describe('BuiltLevelTracker', () => {
  it('moves one step at a time and only after the dwell', () => {
    const t = new BuiltLevelTracker(10, 0);
    expect(t.level).toBe(1);
    const levels: number[] = [];
    for (let day = 0; day < 20; day++) levels.push(t.update(10, 1));
    expect(levels.slice(0, SIZE_RULES.dwellDays - 1).every((l) => l === 1)).toBe(true);
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    expect(levels[levels.length - 1]).toBeGreaterThan(1);
  });

  it('does not flicker when the unrounded level hovers at a half-step', () => {
    const t = new BuiltLevelTracker(10, 0.5); // raw 5.5 → level 6
    expect(t.level).toBe(6);
    for (let day = 0; day < 60; day++) t.update(10, day % 2 ? 0.5 : 0.52);
    expect(t.level).toBe(6);
  });

  it('a falling ceiling pulls the level down at once, one step a day', () => {
    const t = new BuiltLevelTracker(10, 1);
    expect(t.level).toBe(10);
    expect(t.update(8, 1)).toBe(9);
    expect(t.update(8, 1)).toBe(8);
    expect(t.update(8, 1)).toBe(8);
  });

  it('has a dead band: a raw level of 5.5 settles at 5 when climbing and at 6 when falling', () => {
    const up = new BuiltLevelTracker(10, 0);
    for (let day = 0; day < 200; day++) up.update(10, 0.5);
    expect(up.level).toBe(5);
    const down = new BuiltLevelTracker(10, 1);
    for (let day = 0; day < 200; day++) down.update(10, 0.5);
    expect(down.level).toBe(6);
  });

  it('settles one step clear of the dead band once the raw level is far enough on', () => {
    const t = new BuiltLevelTracker(10, 0);
    for (let day = 0; day < 200; day++) t.update(10, 0.6); // raw 6.4 ≥ 5 + 0.65
    expect(t.level).toBe(6);
  });
});

describe('generateCapHistory', () => {
  it('is deterministic', () => {
    expect(generateCapHistory({ cap: 100, cycle: 0.4 }, 7)).toEqual(generateCapHistory({ cap: 100, cycle: 0.4 }, 7));
  });

  it('ends at the seed cap and covers the cycle window', () => {
    const caps = generateCapHistory({ cap: 573, cycle: 0.65 }, 11);
    expect(caps).toHaveLength(SIZE_RULES.cycleWindowDays);
    expect(caps[caps.length - 1]).toBeCloseTo(573, 6);
  });

  it.each([0.1, 0.35, 0.65, 0.9])('puts the end at cycle %d of its own range', (cycle) => {
    const caps = generateCapHistory({ cap: 200, cycle }, 3);
    expect(cyclePosition(caps)).toBeCloseTo(cycle, 6);
  });
});

describe('simulated sizes', () => {
  const sizes = simulatedSizes();

  it('gives every company a level between 1 and its ceiling', () => {
    for (const [ticker, s] of Object.entries(sizes)) {
      expect(s.ceiling, ticker).toBeGreaterThanOrEqual(1);
      expect(s.ceiling, ticker).toBeLessThanOrEqual(SIZE_RULES.levels);
      expect(s.built, ticker).toBeGreaterThanOrEqual(1);
      expect(s.built, ticker).toBeLessThanOrEqual(s.ceiling);
    }
  });

  it('ranks ceilings by size inside a sector', () => {
    expect(sizes.UBL.ceiling).toBeGreaterThanOrEqual(sizes.MEBL.ceiling);
    expect(sizes.MEBL.ceiling).toBeGreaterThan(sizes.HBL.ceiling - 1);
    expect(sizes.LUCK.ceiling).toBeGreaterThan(sizes.FCCL.ceiling);
    expect(sizes.FCCL.ceiling).toBeGreaterThan(sizes.DGKC.ceiling);
    expect(sizes.SYS.ceiling).toBeGreaterThan(sizes.TRG.ceiling);
    expect(sizes.TRG.ceiling).toBeGreaterThan(sizes.AVN.ceiling);
  });

  it('keeps the bear-market companies below their ceilings and uses the whole ladder', () => {
    expect(sizes.AVN.built).toBeLessThan(sizes.AVN.ceiling);
    expect(sizes.TRG.built).toBeLessThan(sizes.TRG.ceiling);
    const built = Object.values(sizes).map((s) => s.built);
    expect(Math.min(...built)).toBeLessThanOrEqual(2);
    expect(Math.max(...built)).toBeGreaterThanOrEqual(8);
  });

  it('is deterministic', () => {
    expect(simulatedSizes()).toEqual(sizes);
  });

  it('seeds a cycle for every company', () => {
    expect(Object.keys(CAP_SEEDS)).toHaveLength(12);
  });
});
