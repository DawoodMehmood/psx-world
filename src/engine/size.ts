import { SIZE_RULES } from '../config/thresholds';

/*
 * Size (DESIGN.md §3.1): pure functions from a company's market-cap history to
 * its ceiling level (how big it can ever be), its cycle position (how
 * developed it is against its own past) and its built level.
 */

export interface CapRange {
  low: number;
  high: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const clampLevel = (n: number) => Math.max(1, Math.min(SIZE_RULES.levels, n));

/** Where `value` sits between `low` and `high` on a log scale, 0–1. A degenerate range reads as the middle. */
export function logPosition(value: number, low: number, high: number): number {
  if (!(high > low) || !(value > 0)) return 0.5;
  return clamp01((Math.log(value) - Math.log(low)) / (Math.log(high) - Math.log(low)));
}

/** Mean of the last `days` values (fewer at the start of a history). */
export function smoothCap(caps: number[], days = SIZE_RULES.smoothDays): number {
  const tail = caps.slice(-days);
  return tail.reduce((a, b) => a + b, 0) / Math.max(1, tail.length);
}

/** Rolling `smoothCap` at every day of the history. */
export function smoothSeries(caps: number[], days = SIZE_RULES.smoothDays): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < caps.length; i++) {
    sum += caps[i];
    if (i >= days) sum -= caps[i - days];
    out.push(sum / Math.min(i + 1, days));
  }
  return out;
}

/** The highest level a company of this cap can ever reach: size within its sector and within the market. */
export function ceilingLevel(cap: number, sector: CapRange, market: CapRange): number {
  const w = SIZE_RULES.ceilingWeights;
  const p = w.sector * logPosition(cap, sector.low, sector.high) + w.market * logPosition(cap, market.low, market.high);
  return Math.round(clampLevel(1 + (SIZE_RULES.levels - 1) * p));
}

/**
 * Where the latest smoothed cap sits between the lowest and highest of the
 * cycle window, 0–1; null when there is too little history for a cycle.
 * `smoothed` is a daily series of smoothed caps, oldest first.
 */
export function cyclePosition(smoothed: number[]): number | null {
  if (smoothed.length < SIZE_RULES.minCycleDays) return null;
  const window = smoothed.slice(-SIZE_RULES.cycleWindowDays);
  return logPosition(window[window.length - 1], Math.min(...window), Math.max(...window));
}

/** The unrounded built level: the ceiling scaled by cycle position. Without a cycle, the full ceiling. */
export function builtLevelRaw(ceiling: number, cycle: number | null): number {
  return cycle === null ? ceiling : 1 + (ceiling - 1) * cycle;
}

/** The built level with no memory: used for a first reading and for tests. */
export const builtLevel = (ceiling: number, cycle: number | null) => Math.min(ceiling, clampLevel(Math.round(builtLevelRaw(ceiling, cycle))));

/**
 * Steps the built level one day at a time. It moves a single step, only once
 * the unrounded value has passed the half-step by the hysteresis margin, and
 * only after the dwell; a ceiling that falls below it overrides the dwell.
 */
export class BuiltLevelTracker {
  level: number;
  private since = 0;

  constructor(ceiling: number, cycle: number | null) {
    this.level = builtLevel(ceiling, cycle);
  }

  update(ceiling: number, cycle: number | null): number {
    this.since++;
    if (this.level > ceiling) {
      this.level--;
      this.since = 0;
      return this.level;
    }
    const raw = builtLevelRaw(ceiling, cycle);
    const edge = 0.5 + SIZE_RULES.hysteresisLevels;
    if (this.since >= SIZE_RULES.dwellDays) {
      if (raw >= this.level + edge && this.level < ceiling) this.level++;
      else if (raw <= this.level - edge && this.level > 1) this.level--;
      else return this.level;
      this.since = 0;
    }
    return this.level;
  }
}

export interface CompanySize {
  smoothCap: number;
  ceiling: number;
  cycle: number | null;
  built: number;
}

/** A company's size from its daily cap history (oldest first, in the same unit as the ranges). */
export function computeSize(caps: number[], sector: CapRange, market: CapRange): CompanySize {
  const series = smoothSeries(caps);
  const cap = series[series.length - 1];
  const ceiling = ceilingLevel(cap, sector, market);
  const cycle = cyclePosition(series);
  return { smoothCap: cap, ceiling, cycle, built: builtLevel(ceiling, cycle) };
}
