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
function tracker() {
  return new CompanyTracker(
    { ticker: 'TEST', sectorId: 's', scale: 1, sharesOutstanding: 1e9, sectorCapRange: { low: 1, high: 100 } },
    { closes: Array(25).fill(100), volumes: Array(25).fill(800) },
  );
}
const obs = (day: number, tick: number, price: number, volume = 100, extra: Partial<Observation> = {}): Observation => ({ ticker: 'TEST', day, tick, price, volume, ...extra });

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
  });

  it('builds LUCK up the ladder as its cap rises, then winds it down as the slide goes on', () => {
    const levels = snaps.filter((_, i) => i % TICKS_PER_DAY === TICKS_PER_DAY - 1).map((s) => s.companies.LUCK.level);
    const start = snaps[0].companies.LUCK.level;
    expect(Math.max(...levels)).toBeGreaterThan(start);
    expect(levels[levels.length - 1]).toBeLessThan(Math.max(...levels));
    const peak = levels.indexOf(Math.max(...levels));
    // growth comes before the decline, and the ladder moves one level at a time
    expect(peak).toBeGreaterThan(levels.findIndex((l) => l > start));
    for (let i = 1; i < levels.length; i++) expect(Math.abs(levels[i] - levels[i - 1])).toBeLessThanOrEqual(1);
  });

  it('shows the wind-down: a building under tarp (paused) while LUCK’s level falls', () => {
    const tarped = snaps.filter((s) => s.companies.LUCK.slots.some((slot) => slot.paused));
    expect(tarped.length).toBeGreaterThan(0);
    expect(snaps.indexOf(tarped[0])).toBeGreaterThan(24 * TICKS_PER_DAY);
  });

  it('declines through steady and weak to struggling, and health never gets better in the long slide', () => {
    expect(at(28, 7).LUCK.health).toBe('STEADY');
    expect(at(33, 7).LUCK.health).toBe('WEAK');
    expect(at(35, 7).LUCK.health).toBe('STRUGGLING');
    const healthRank = ['STRUGGLING', 'WEAK', 'STEADY', 'STRONG', 'THRIVING'];
    const closes = snaps.filter((_, i) => i >= 25 * TICKS_PER_DAY && i % TICKS_PER_DAY === TICKS_PER_DAY - 1).map((s) => healthRank.indexOf(s.companies.LUCK.health));
    expect(closes.every((h, i) => i === 0 || h <= closes[i - 1])).toBe(true);
  });

  it('leaves every other company calm: no events, no frenzy, no construction, no growth', () => {
    for (const s of snaps) {
      for (const c of Object.values(s.companies)) {
        if (c.ticker === 'LUCK') continue;
        expect(c.events).toEqual([]);
        expect(c.activity).not.toBe('FRENZY');
        expect(c.slots.every((slot) => slot.stage !== 'STAKED' && slot.stage !== 'FOUNDATION' && slot.stage !== 'FRAME')).toBe(true);
        expect(c.expansion).toBeNull();
        expect(c.tier).toBe(snaps[0].companies[c.ticker].tier);
        expect(c.level).toBe(snaps[0].companies[c.ticker].level);
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

  it('grows MEBL and SYS up the ladder while OGDC and HBL wind down', () => {
    expect(close(40).MEBL.level).toBeGreaterThan(close(1).MEBL.level);
    expect(close(40).SYS.level).toBeGreaterThan(close(1).SYS.level);
    expect(close(40).OGDC.level).toBeLessThan(close(1).OGDC.level);
    expect(close(40).HBL.level).toBeLessThan(close(1).HBL.level);
  });

  it('winds sites down under tarps after the selloff, and never changes a level by more than one a day', () => {
    const tarped = new Set(snaps.flatMap((s) => Object.values(s.companies).filter((c) => c.slots.some((slot) => slot.paused)).map((c) => c.ticker)));
    expect(tarped.has('OGDC')).toBe(true);
    for (const ticker of Object.keys(snaps[0].companies)) {
      const levels = snaps.filter((_, i) => i % TICKS_PER_DAY === TICKS_PER_DAY - 1).map((s) => s.companies[ticker].level);
      for (let i = 1; i < levels.length; i++) expect(Math.abs(levels[i] - levels[i - 1]), ticker).toBeLessThanOrEqual(1);
    }
  });

  it('keeps health decline visuals on their own schedule: HBL and OGDC slide to weak and struggling', () => {
    expect(close(27).HBL.health).toBe('WEAK');
    expect(close(31).HBL.health).toBe('STRUGGLING');
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

