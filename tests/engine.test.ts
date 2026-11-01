import { describe, expect, it } from 'vitest';
import type { LevelRule } from '../src/config/thresholds';
import { CompanyTracker } from '../src/engine/company';
import { classify, LevelTracker } from '../src/engine/levels';
import { TICKS_PER_DAY, type Observation, type Snapshot } from '../src/engine/types';
import { simulate } from '../src/sim/run';
import { luckyInFocus } from '../src/sim/scenarios/luckyInFocus';
import { twoMonths } from '../src/sim/scenarios/twoMonths';

const RULE: LevelRule = { cuts: [1, 2], margins: [0.1, 0.1] };

describe('levels', () => {
  it('needs to clear a cut by its margin to move up, and fall below by it to move down', () => {
    expect(classify(1.05, RULE, 0)).toBe(0);
    expect(classify(1.15, RULE, 0)).toBe(1);
    expect(classify(0.95, RULE, 1)).toBe(1);
    expect(classify(0.85, RULE, 1)).toBe(0);
    expect(classify(2.5, RULE, 0)).toBe(2);
  });

  it('holds a level for the minimum dwell before changing', () => {
    const t = new LevelTracker(RULE, 2);
    expect(t.update(0.5)).toBe(0);
    expect(t.update(1.5)).toBe(0);
    expect(t.update(1.5)).toBe(1);
    expect(t.update(0.5)).toBe(1);
    expect(t.update(0.5)).toBe(0);
  });

  it('does not flicker when a value hovers around a cut', () => {
    const t = new LevelTracker(RULE, 2);
    const seen = [0.98, 1.04, 0.97, 1.06, 0.99, 1.05].map((v) => t.update(v));
    expect(new Set(seen).size).toBe(1);
  });
});

/** A tracker with a flat 25-day history at price 100 and volume 800. */
function tracker(slotsPerTier = [1, 2], startTier = 1) {
  return new CompanyTracker(
    { ticker: 'TEST', sectorId: 's', scale: 1, startTier, slotsPerTier },
    { closes: Array(25).fill(100), volumes: Array(25).fill(800) },
  );
}
const obs = (day: number, tick: number, price: number, volume = 100, extra: Partial<Observation> = {}): Observation => ({ ticker: 'TEST', day, tick, price, volume, ...extra });

describe('construction and site tiers', () => {
  /** Feed one health score per day; return a compact picture of the site after each day. */
  const runDays = (t: CompanyTracker, scores: number[]) =>
    scores.map((score) => {
      t.setHealth(score);
      t.advanceConstruction();
      const s = t.snapshot(0, 0);
      const letter: Record<string, string> = { EMPTY: 'E', STAKED: 'S', FOUNDATION: 'F', FRAME: 'R', COMPLETE: 'C' };
      const stage = (x: { stage: string; paused: boolean }) => letter[x.stage] + (x.paused ? '*' : '');
      return `T${s.tier} ${s.slots.map(stage).join('')}${s.expansion ? ' X' + stage(s.expansion) : ''}`;
    });

  it('builds the tier’s slots, then expands the site, then builds the next tier’s slots', () => {
    const t = tracker([1, 2]);
    expect(runDays(t, Array(14).fill(5))).toEqual([
      'T1 EEE',
      'T1 EEE',
      'T1 SEE',
      'T1 FEE',
      'T1 REE',
      'T1 CEE',
      'T1 CEE XS',
      'T1 CEE XF',
      'T1 CEE XR',
      'T2 CEE',
      'T2 CSE',
      'T2 CFE',
      'T2 CRE',
      'T2 CCE',
    ]);
  });

  it('starts the first project only after three strong days, then keeps going day after day', () => {
    const t = tracker([2]);
    const days = runDays(t, [10, 10, 0, 10, 10, 10, 10, 10, 10, 10]);
    expect(days.slice(0, 5).every((d) => d === 'T1 EE')).toBe(true);
    expect(days[5]).toBe('T1 SE');
    expect(days[8]).toBe('T1 CE');
    expect(days[9]).toBe('T1 CS');
  });

  it('pauses when health drops, resumes when it recovers, and never undoes anything', () => {
    const t = tracker([1, 1]);
    const days = runDays(t, [5, 5, 5, 5, 5, 5, 5, -10, -10, -10, 5, 5, 5]);
    expect(days[6]).toBe('T1 CE XS');
    expect(days[7]).toBe('T1 CE XS*');
    expect(days[9]).toBe('T1 CE XS*');
    expect(days[10]).toBe('T1 CE XF');
    expect(days[11]).toBe('T1 CE XR');
    expect(days[12]).toBe('T2 CE');
  });

  it('starts bigger companies on a bigger site with the smaller tiers already built', () => {
    const t = tracker([1, 2, 3], 2);
    expect(runDays(t, [0])).toEqual(['T2 CEEEEE']);
  });

  it('stops at the top tier once every slot is built', () => {
    const t = tracker([1, 1], 1);
    const days = runDays(t, Array(40).fill(10));
    expect(days[days.length - 1]).toBe('T2 CC');
  });
});

describe('events', () => {
  it('fires a big move only once per cooldown and lets it expire', () => {
    const t = tracker();
    t.setHealth(0);
    let index = 0;
    const days: Snapshot['companies'][string][] = [];
    for (let day = 1; day <= 3; day++) {
      for (let tick = 0; tick < TICKS_PER_DAY; tick++) {
        // +1% a tick on day 1 and day 2: a huge move both days.
        const price = 100 * (1 + 0.01 * (day - 1) * TICKS_PER_DAY) * (1 + (day < 3 ? 0.01 * (tick + 1) : 0));
        t.observe(obs(day, tick, price), index);
        days.push(t.snapshot(index, tick));
        index++;
      }
      t.closeDay(index - 1);
    }
    const bigUps = new Set(days.flatMap((s) => s.events.filter((e) => e.type === 'BIG_UP').map((e) => e.id)));
    expect(bigUps.size).toBe(1);
    expect(days[days.length - 1].events.some((e) => e.type === 'BIG_UP')).toBe(false);
  });

  it('opens a halt and closes it with a resume', () => {
    const t = tracker();
    t.observe(obs(1, 0, 100), 0);
    t.observe(obs(1, 1, 100, 0, { halted: true }), 1);
    expect(t.snapshot(1, 1).events.map((e) => e.type)).toEqual(['HALT']);
    t.observe(obs(1, 2, 100, 0, { halted: true }), 2);
    t.observe(obs(1, 3, 100), 3);
    const s = t.snapshot(3, 3);
    expect(s.halted).toBe(false);
    expect(s.events.map((e) => e.type)).toEqual(['RESUME']);
  });
});

describe('Lucky Cement scenario', () => {
  const snaps = simulate(luckyInFocus);
  const at = (day: number, tick: number) => snaps[(day - 1) * TICKS_PER_DAY + tick].companies;

  it('is deterministic', () => {
    expect(simulate(luckyInFocus)).toEqual(snaps);
  });

  it('takes LUCK through quiet, busy, frenzy, a big jump, a wild day, a crash and a halt', () => {
    expect(at(2, 4).LUCK.activity).toBe('QUIET');
    expect(at(3, 4).LUCK.activity).toBe('BUSY');
    expect(at(4, 4).LUCK.activity).toBe('FRENZY');
    expect(at(4, 6).LUCK.direction).toBe('UP_HARD');
    expect(at(4, 6).LUCK.events.map((e) => e.type)).toContain('BIG_UP');
    expect(at(8, 5).LUCK.volatility).toBe('WILD');
    expect(at(8, 7).LUCK.direction).toBe('FLAT');
    expect(at(9, 6).LUCK.direction).toBe('DOWN_HARD');
    expect(at(11, 3).LUCK.halted).toBe(true);
    expect(at(11, 6).LUCK.events.map((e) => e.type)).toContain('RESUME');
    expect(at(14, 4).LUCK.events.map((e) => e.type)).toContain('DIVIDEND');
    expect(at(1, 0).DGKC.tier).toBe(1);
  });

  it('fills LUCK’s tier 2 pads, pausing through the crash, then expands the site to tier 3', () => {
    expect(at(1, 0).LUCK.tier).toBe(2);
    expect(at(6, 7).LUCK.slots[1].stage).toBe('STAKED');
    expect(at(10, 3).LUCK.slots[1]).toEqual({ stage: 'FRAME', paused: true });
    expect(at(13, 7).LUCK.slots[1].stage).toBe('COMPLETE');
    expect(at(18, 7).LUCK.slots[2].stage).toBe('COMPLETE');
    expect(at(19, 7).LUCK.expansion?.stage).toBe('STAKED');
    expect(at(22, 6).LUCK.tier).toBe(2);
    expect(at(22, 7).LUCK.tier).toBe(3);
    expect(at(23, 7).LUCK.slots[3].stage).toBe('STAKED');
  });

  it('finishes the third kiln, then declines through steady and weak to struggling without undoing anything', () => {
    expect(at(26, 7).LUCK.slots[3].stage).toBe('COMPLETE');
    expect(at(28, 7).LUCK.health).toBe('STEADY');
    expect(at(33, 7).LUCK.health).toBe('WEAK');
    expect(at(35, 7).LUCK.health).toBe('STRUGGLING');
    const healthRank = ['STRUGGLING', 'WEAK', 'STEADY', 'STRONG', 'THRIVING'];
    const closes = snaps.filter((_, i) => i >= 25 * TICKS_PER_DAY && i % TICKS_PER_DAY === TICKS_PER_DAY - 1).map((s) => healthRank.indexOf(s.companies.LUCK.health));
    expect(closes.every((h, i) => i === 0 || h <= closes[i - 1])).toBe(true);
    const last = snaps[snaps.length - 1].companies.LUCK;
    expect(last.tier).toBe(3);
    expect(last.slots.slice(0, 4).every((slot) => slot.stage === 'COMPLETE')).toBe(true);
  });

  it('leaves every other company calm: no events, no frenzy, no construction, no growth', () => {
    for (const s of snaps) {
      for (const c of Object.values(s.companies)) {
        if (c.ticker === 'LUCK') continue;
        expect(c.events).toEqual([]);
        expect(c.activity).not.toBe('FRENZY');
        expect(c.slots.every((slot) => slot.stage !== 'STAKED' && slot.stage !== 'FOUNDATION' && slot.stage !== 'FRAME')).toBe(true);
        expect(c.expansion).toBeNull();
        expect(c.tier).toBe(s.companies[c.ticker] && snaps[0].companies[c.ticker].tier);
      }
    }
  });
});

describe('Two months on the Exchange', () => {
  const snaps = simulate(twoMonths);
  const at = (day: number, tick: number) => snaps[(day - 1) * TICKS_PER_DAY + tick].companies;
  const close = (day: number) => at(day, TICKS_PER_DAY - 1);
  const types = (day: number, ticker: string) => snaps.slice((day - 1) * TICKS_PER_DAY, day * TICKS_PER_DAY).flatMap((s) => s.companies[ticker].events.map((e) => e.type));

  it('has a caption for every day', () => {
    for (let d = 1; d <= twoMonths.days; d++) expect(twoMonths.notes[d]).toBeTruthy();
  });

  it('plays the SPEC §14 beats', () => {
    expect(types(3, 'SYS')).toContain('VOLUME_SPIKE');
    expect(types(6, 'OGDC')).toContain('VOLUME_SPIKE');
    expect(close(6).OGDC.direction).toBe('FLAT');
    expect(at(10, 3).DGKC.halted).toBe(true);
    expect(at(10, 3).LUCK.halted).toBe(false);
    expect(at(12, 5).AVN.volatility).toBe('WILD');
    expect(close(12).AVN.direction).toBe('FLAT');
    expect(Object.values(at(15, 6)).filter((c) => c.direction === 'DOWN_HARD').length).toBeGreaterThanOrEqual(10);
    expect(types(18, 'LUCK')).toContain('DIVIDEND');
  });

  it('pauses MEBL’s construction in the selloff, then finishes its lot', () => {
    expect(close(13).MEBL.slots[2].stage).toBe('FOUNDATION');
    expect(close(16).MEBL.slots[2]).toEqual({ stage: 'FRAME', paused: true });
    expect(close(19).MEBL.slots[2].stage).toBe('COMPLETE');
    expect(close(24).MEBL.tier).toBe(3);
    expect(close(40).MEBL.slots.every((s) => s.stage === 'COMPLETE')).toBe(true);
  });

  it('grows MARI to tier 2 while HBL and OGDC slide to struggling', () => {
    expect(close(1).MARI.tier).toBe(1);
    expect(close(34).MARI.tier).toBe(2);
    expect(close(27).HBL.health).toBe('WEAK');
    expect(close(31).HBL.health).toBe('STRUGGLING');
    expect(close(40).HBL.slots[2].paused).toBe(true);
    expect(close(28).OGDC.health).toBe('STRUGGLING');
  });

  it('shows sector and market moods: a quiet day, a bank rally, a stormy selloff, a relief rally', () => {
    const snap = (day: number, tick: number) => snaps[(day - 1) * TICKS_PER_DAY + tick];
    expect(snap(2, 5).market.mood).toBe('QUIET');
    for (let tick = 2; tick < TICKS_PER_DAY; tick++) expect(snap(6, tick).sectors.banks.mood).toBe('RALLY');
    expect(snap(6, 5).sectors.oil.mood).toBe('MIXED');
    expect(snap(6, 5).market.mood).toBe('NORMAL');
    expect(snap(15, 6).market.mood).toBe('BROAD_SELLOFF');
    expect(snap(15, 6).market.stormy).toBe(true);
    for (const id of ['banks', 'oil', 'cement', 'tech']) expect(snap(15, 6).sectors[id].mood).toBe('SELLOFF');
    expect(snap(17, 5).market.mood).toBe('BROAD_RALLY');
    expect(snap(17, 5).market.stormy).toBe(false);
    expect(snap(25, 4).market.stormy).toBe(false);
  });

  it('weakens cement broadly after day 9 and lets it lag the recovery', () => {
    for (const t of ['LUCK', 'DGKC', 'FCCL']) {
      expect(['WEAK', 'STRUGGLING']).toContain(close(14)[t].health);
      expect(['WEAK', 'STRUGGLING']).toContain(close(20)[t].health);
    }
  });
});

