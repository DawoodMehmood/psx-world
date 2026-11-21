import { describe, expect, it } from 'vitest';
import { applyOverride, labSite, labTour, LAB_EVENTS } from '../src/engine/lab';
import { MAX_LEVEL, SLOT_COUNT } from '../src/engine/ladder';
import type { CompanyState } from '../src/engine/types';
import { simulate } from '../src/sim/run';
import { twoMonths } from '../src/sim/scenarios/twoMonths';

const base = simulate(twoMonths)[0].companies.LUCK as CompanyState;

describe('lab tour', () => {
  const tour = labTour();
  const sites = tour.map(labSite);

  it('visits every level finished, and every stage of every project up and down', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) expect(tour.some((s) => s.level === l && s.mode === 'idle')).toBe(true);
    const stages = new Set(sites.flatMap((s) => s.slots.map((p) => p.stage)));
    for (const stage of ['EMPTY', 'STAKED', 'FOUNDATION', 'FRAME', 'COMPLETE']) expect(stages.has(stage as never), stage).toBe(true);
    expect(sites.some((s) => s.expansion?.stage === 'STAKED')).toBe(true);
    expect(sites.some((s) => s.expansion?.stage === 'FOUNDATION')).toBe(true);
    expect(sites.some((s) => s.slots.some((p) => p.paused))).toBe(true);
    expect(sites.some((s) => s.upgrades.some((u) => u.stage === 'FRAME' && !u.paused))).toBe(true);
    expect(sites.some((s) => s.upgrades.some((u) => u.stage === 'FRAME' && u.paused))).toBe(true);
    expect(new Set(sites.map((s) => s.tier))).toEqual(new Set([1, 2, 3]));
  });

  it('finished levels show the right pads and upgrades', () => {
    const at = (level: number) => labSite({ level, mode: 'idle', q: 0 });
    expect(at(1).slots.filter((p) => p.stage === 'COMPLETE')).toHaveLength(0);
    expect(at(MAX_LEVEL).slots.filter((p) => p.stage === 'COMPLETE')).toHaveLength(SLOT_COUNT);
    expect(at(MAX_LEVEL).upgrades.every((u) => u.stage === 'COMPLETE')).toBe(true);
    expect(at(MAX_LEVEL).tier).toBe(3);
  });

  it('has no impossible steps: nothing builds above the top level or winds down below the first', () => {
    for (const s of tour) {
      if (s.mode === 'up') expect(s.level).toBeLessThan(MAX_LEVEL);
      if (s.mode === 'down') expect(s.level).toBeGreaterThan(1);
    }
  });
});

describe('applyOverride', () => {
  it('changes nothing without an override', () => {
    expect(applyOverride(base, undefined)).toBe(base);
  });

  it('forces levels, the site and the events, and leaves everything else alone', () => {
    const out = applyOverride(base, { health: 'THRIVING', build: { level: 8, mode: 'up', q: 0.5 }, events: ['BIG_UP', 'DIVIDEND'] });
    expect(out.health).toBe('THRIVING');
    expect(out.level).toBe(8);
    expect(out.events.map((e) => e.type)).toEqual(['BIG_UP', 'DIVIDEND']);
    expect(out.price).toBe(base.price);
    expect(out.activity).toBe(base.activity);
  });

  it('every lab event becomes a well-formed, never-expiring event', () => {
    const out = applyOverride(base, { events: LAB_EVENTS });
    expect(new Set(out.events.map((e) => e.id)).size).toBe(LAB_EVENTS.length);
    for (const e of out.events) expect(e.durationTicks).toBeGreaterThan(1e6);
  });
});
