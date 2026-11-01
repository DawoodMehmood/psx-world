import { describe, expect, it } from 'vitest';
import { replayConstruction, settled, siteOf, stepConstruction, type Construction } from '../src/engine/construction';
import { FOOTPRINT_LEVELS, footprintTier, kindOf, LEVEL_KINDS, MAX_LEVEL, SLOT_COUNT, slotIndex, slotsBuilt, UPGRADE_LEVELS, upgradeIndex } from '../src/engine/ladder';
import { createRng } from '../src/engine/rng';

const LETTER: Record<string, string> = { EMPTY: 'E', STAKED: 'S', FOUNDATION: 'F', FRAME: 'R', COMPLETE: 'C' };

/** A compact picture of the site: tier, the pads, and the enlargement underway. */
function sig(c: Construction): string {
  const site = siteOf(c);
  const stage = (x: { stage: string; paused: boolean }) => LETTER[x.stage] + (x.paused ? '*' : '');
  return `T${site.tier} ${site.slots.map(stage).join('')}${site.expansion ? ' X' + stage(site.expansion) : ''}`;
}

/** The site after the project is created, then after each of `steps` further days towards `target`. */
function run(from: number, target: number, steps: number): string[] {
  let c = settled(from);
  const out: string[] = [];
  for (let i = 0; i <= steps; i++) {
    c = stepConstruction(c, target);
    out.push(sig(c));
  }
  return out;
}

describe('ladder', () => {
  it('has ten levels: a core, six buildings and three upgrades', () => {
    expect(MAX_LEVEL).toBe(10);
    expect(LEVEL_KINDS.filter((k) => k === 'BUILDING')).toHaveLength(SLOT_COUNT);
    expect(LEVEL_KINDS.filter((k) => k === 'UPGRADE')).toHaveLength(3);
    expect(kindOf(1)).toBe('CORE');
  });

  it('grows the footprint at levels 4 and 7', () => {
    expect(FOOTPRINT_LEVELS).toEqual([4, 7]);
    expect(Array.from({ length: 10 }, (_, i) => footprintTier(i + 1))).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 3]);
  });

  it('has upgrades at levels 3, 6 and 10', () => {
    expect(UPGRADE_LEVELS).toEqual([3, 6, 10]);
    expect(UPGRADE_LEVELS.map(upgradeIndex)).toEqual([0, 1, 2]);
  });

  it('builds pads in order: each building level takes the next one', () => {
    expect(Array.from({ length: 10 }, (_, i) => slotsBuilt(i + 1))).toEqual([0, 1, 1, 2, 3, 3, 4, 5, 6, 6]);
    expect([2, 4, 5, 7, 8, 9].map(slotIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('construction timeline', () => {
  it('builds a plain building in five days: stakes, two of foundation, two of frame, finished', () => {
    expect(run(1, 2, 5)).toEqual(['T1 SEEEEE', 'T1 FEEEEE', 'T1 FEEEEE', 'T1 REEEEE', 'T1 REEEEE', 'T1 CEEEEE']);
  });

  it('enlarges the site first at a footprint level, then builds', () => {
    expect(run(3, 4, 7)).toEqual([
      'T1 CEEEEE XS',
      'T1 CEEEEE XF',
      'T2 CSEEEE',
      'T2 CFEEEE',
      'T2 CFEEEE',
      'T2 CREEEE',
      'T2 CREEEE',
      'T2 CCEEEE',
    ]);
  });

  it('an upgrade takes three days: scaffolding goes up on the first, comes down when it is finished, and the pads do not change', () => {
    const states = (from: number, target: number, steps: number) => {
      let c = settled(from);
      return Array.from({ length: steps + 1 }, () => (c = stepConstruction(c, target))).map((x) => siteOf(x).upgrades[0]);
    };
    expect(states(2, 3, 3)).toEqual([
      { stage: 'FRAME', paused: false },
      { stage: 'FRAME', paused: false },
      { stage: 'FRAME', paused: false },
      { stage: 'COMPLETE', paused: false },
    ]);
    expect(new Set(run(2, 3, 3)).size).toBe(1);
  });

  it('winds an upgrade down under a tarp, then takes it away', () => {
    let c = settled(3);
    const seen = [0, 1, 2].map(() => siteOf((c = stepConstruction(c, 2))).upgrades[0]);
    expect(seen).toEqual([
      { stage: 'FRAME', paused: true },
      { stage: 'FRAME', paused: true },
      { stage: 'EMPTY', paused: false },
    ]);
    expect(c).toEqual(settled(2));
  });

  it('shows every upgrade at or below the built level as finished', () => {
    expect(siteOf(settled(1)).upgrades.map((u) => u.stage)).toEqual(['EMPTY', 'EMPTY', 'EMPTY']);
    expect(siteOf(settled(6)).upgrades.map((u) => u.stage)).toEqual(['COMPLETE', 'COMPLETE', 'EMPTY']);
    expect(siteOf(settled(10)).upgrades.map((u) => u.stage)).toEqual(['COMPLETE', 'COMPLETE', 'COMPLETE']);
  });

  it('winds a building down under a tarp, then shrinks the site back', () => {
    expect(run(4, 3, 4)).toEqual(['T2 CR*EEEE', 'T2 CR*EEEE', 'T2 CF*EEEE', 'T1 CE*EEEE', 'T1 CEEEEE']);
  });

  it('works through a big jump one level at a time', () => {
    let c = settled(1);
    const doneAfter = (steps: number) => {
      for (let i = 0; i < steps; i++) c = stepConstruction(c, 4);
      return c.done;
    };
    expect(doneAfter(1)).toBe(1);
    expect(doneAfter(5)).toBe(2);
    expect(c.project?.level).toBe(3);
    expect(doneAfter(3)).toBe(3);
    expect(doneAfter(7)).toBe(4);
    expect(c.project).toBeNull();
  });

  it('turns round mid-project and carries on from the same point', () => {
    let c = settled(1);
    for (let i = 0; i < 3; i++) c = stepConstruction(c, 2);
    expect(c.project).toMatchObject({ level: 2, dir: 'UP' });
    c = stepConstruction(c, 1);
    expect(c.project).toMatchObject({ level: 2, dir: 'DOWN' });
    expect(sig(c)).toBe('T1 S*EEEEE');
    c = stepConstruction(c, 1);
    expect(c).toEqual(settled(1));
  });

  it('stays settled when the data holds still', () => {
    expect(stepConstruction(settled(5), 5)).toEqual(settled(5));
  });

  it('is deterministic: the same series gives the same site', () => {
    const rng = createRng(5);
    const targets = Array.from({ length: 80 }, () => 1 + Math.floor(rng() * 10));
    expect(replayConstruction(targets)).toEqual(replayConstruction(targets));
    expect(sig(replayConstruction(targets))).toBe(sig(replayConstruction([...targets])));
  });

  it('keeps its invariants whatever the data does', () => {
    const rng = createRng(21);
    let c = settled(5);
    let target = 5;
    for (let day = 0; day < 600; day++) {
      if (rng() < 0.08) target = 1 + Math.floor(rng() * 10);
      const before = c.done;
      c = stepConstruction(c, target);
      expect(Math.abs(c.done - before)).toBeLessThanOrEqual(1);
      // a project is on the next level up, or on the top level done (a teardown that turned round rebuilds it)
      if (c.project) expect([c.done, c.done + 1]).toContain(c.project.level);
      const site = siteOf(c);
      expect(site.tier).toBeGreaterThanOrEqual(1);
      expect(site.tier).toBeLessThanOrEqual(3);
      expect(site.slots.filter((s) => s.stage !== 'EMPTY' && s.stage !== 'COMPLETE').length).toBeLessThanOrEqual(1);
      expect(site.slots.filter((s) => s.stage === 'COMPLETE').length).toBeLessThanOrEqual(slotsBuilt(c.done) + 0);
    }
  });
});
