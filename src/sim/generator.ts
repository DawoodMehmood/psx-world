import { createRng } from '../engine/rng';
import { TICKS_PER_DAY, type History, type Observation } from '../engine/types';
import type { MarketData } from '../engine/market';
import type { Scenario } from './types';

const HISTORY_DAYS = 25;
/** Day-to-day wobble in the history, in %. Kept small so everyone starts STEADY. */
const HISTORY_SD = 0.4;
/** Default tick-to-tick noise, in %. A normal day ends within about ±0.5%. */
const DEFAULT_NOISE = 0.15;
/**
 * On days without a plan, each tick pulls the price this share of the way back
 * to where it settled after its last planned move, so background companies
 * wobble instead of drifting into strong or weak health by chance.
 */
const REVERSION = 0.08;

/**
 * Turns a scenario script into fictional, deterministic price and volume data.
 * The same scenario always produces exactly the same numbers.
 */
export function generateMarket(
  scenario: Scenario,
  tickers: string[],
  /** Where each company's price starts, and its daily market-cap history in Rs billions (see capSeeds). */
  start: { prices: Record<string, number>; capHistory: Record<string, number[]> },
): MarketData {
  const rng = createRng(scenario.seed);
  const gauss = () => {
    const u = Math.max(rng(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };

  const base = new Map<string, { price: number; volume: number }>();
  const history: Record<string, History> = {};
  for (const t of tickers) {
    // The random draw stays so every other number in a scenario is unchanged.
    const drawn = Math.round((40 + rng() * 800) * 100) / 100;
    const b = { price: start.prices[t] ?? drawn, volume: Math.round(2e5 + rng() * 4e6) };
    base.set(t, b);
    const closes: number[] = [];
    const volumes: number[] = [];
    for (let d = 0; d < HISTORY_DAYS; d++) {
      closes.push(b.price * (1 + (gauss() * HISTORY_SD) / 100));
      volumes.push(b.volume * (0.85 + 0.3 * rng()));
    }
    history[t] = { closes, volumes };
  }

  const price = new Map(tickers.map((t) => [t, history[t].closes[HISTORY_DAYS - 1]]));
  const anchor = new Map(tickers.map((t) => [t, base.get(t)!.price]));
  const observations: Observation[][] = [];
  for (let day = 1; day <= scenario.days; day++) {
    for (let tick = 0; tick < TICKS_PER_DAY; tick++) {
      const row: Observation[] = [];
      for (const t of tickers) {
        const planned = scenario.plan(t, day);
        const plan = planned ?? {};
        const halted = !!plan.halt && tick >= plan.halt[0] && tick <= plan.halt[1];
        const noise = gauss() * (plan.noise ?? DEFAULT_NOISE);
        const jitter = 0.85 + 0.3 * rng();
        let p = price.get(t)!;
        let volume = 0;
        if (!halted) {
          const pull = planned ? 0 : -(p / anchor.get(t)! - 1) * 100 * REVERSION;
          const z = plan.zigzag ?? 0;
          const zig = tick === 0 ? -z / 2 : tick % 2 ? z : -z;
          const gap = tick === 0 ? (plan.gap ?? 0) : 0;
          p *= 1 + ((plan.drift ?? 0) / TICKS_PER_DAY + gap + noise + pull + zig) / 100;
          volume = ((base.get(t)!.volume * (plan.volume ?? 1)) / TICKS_PER_DAY) * jitter;
        }
        price.set(t, p);
        if (planned && tick === TICKS_PER_DAY - 1) anchor.set(t, p);
        row.push({ ticker: t, day, tick, price: p, volume, halted, dividend: plan.dividendTick === tick });
      }
      observations.push(row);
    }
  }
  return { days: scenario.days, history, capHistory: start.capHistory, observations };
}
