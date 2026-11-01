import { createRng } from '../engine/rng';
import { SIZE_RULES } from '../config/thresholds';

/**
 * Fictional multi-year market-cap history, so cycle position has something to
 * read (DESIGN.md §3.1). Deterministic: the same inputs give the same series.
 *
 * It is generated on its own random stream, separate from the scenario's
 * intraday prices, so scenarios and their tests are unchanged. Joining the two
 * (intraday price derived from this cap) comes with the construction step.
 */

/** How far the cap travels over the window by default: highest ÷ lowest. */
export const RANGE_RATIO = 4;
/** Day-to-day pull back toward the middle; below 1 so the path wanders over years, not days. */
const PULL = 0.995;
const STEP_SD = 0.06;

export interface CapSeed {
  /** Today's market cap, in Rs billions. */
  cap: number;
  /** Where today's cap sits between the window's low and high, 0–1. */
  cycle: number;
}

/** Daily caps, oldest first, ending at `seed.cap` with the end sitting at `seed.cycle` of the window's range. */
export function generateCapHistory(seed: CapSeed, rngSeed: number, days: number = SIZE_RULES.cycleWindowDays, rangeRatio: number = RANGE_RATIO): number[] {
  let raw: number[] = [];
  let end = 0.5;
  // The end of the walk must not be its own extreme, or the warp below can't place it. Rare; re-draw.
  for (let attempt = 0; attempt < 20; attempt++) {
    const rng = createRng(rngSeed + attempt * 7919);
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-9))) * Math.cos(2 * Math.PI * rng());
    let x = 0;
    raw = Array.from({ length: days }, () => (x = x * PULL + gauss() * STEP_SD));
    // Settle at today's level for the smoothing window, so the smoothed cap equals today's cap and the seed means what it says.
    for (let i = days - SIZE_RULES.smoothDays; i < days; i++) raw[i] = raw[days - SIZE_RULES.smoothDays];
    const lo = Math.min(...raw);
    const hi = Math.max(...raw);
    end = (raw[days - 1] - lo) / (hi - lo);
    raw = raw.map((v) => (v - lo) / (hi - lo));
    if (end > 0.02 && end < 0.98) break;
  }

  // Piecewise-linear warp of [0,1] that sends the walk's end to the wanted cycle position.
  const warp = (w: number) => (w <= end ? (seed.cycle * w) / end : seed.cycle + ((1 - seed.cycle) * (w - end)) / (1 - end));
  const span = Math.log(rangeRatio);
  const floor = Math.log(seed.cap) - span * seed.cycle;
  return raw.map((w) => Math.exp(floor + span * warp(w)));
}
