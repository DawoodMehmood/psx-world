import { COMPANIES, ENGINE_COMPANIES } from '../config/companies';
import { MARKET_CAP_RANGE } from '../config/sectors';
import { SIZE_RULES } from '../config/thresholds';
import { runMarket } from '../engine/market';
import type { Snapshot } from '../engine/types';
import { CAP_SEEDS } from './capSeeds';
import { generateMarket } from './generator';
import { generateCapHistory } from './history';
import type { Scenario } from './types';

/** Generate a scenario's data and run the engine over it. */
export function simulate(scenario: Scenario): Snapshot[] {
  // Each company starts at the price that gives its seeded market cap (price × shares), so price and cap agree.
  const prices: Record<string, number> = {};
  const capHistory: Record<string, number[]> = {};
  COMPANIES.forEach((c, i) => {
    prices[c.ticker] = Math.round(((CAP_SEEDS[c.ticker].cap * 1e9) / c.sharesOutstanding) * 100) / 100;
    capHistory[c.ticker] = generateCapHistory(CAP_SEEDS[c.ticker], 1000 + i * 31, SIZE_RULES.cycleWindowDays, scenario.size?.rangeRatio);
  });
  const data = generateMarket(
    scenario,
    ENGINE_COMPANIES.map((c) => c.ticker),
    { prices, capHistory },
  );
  return runMarket(data, ENGINE_COMPANIES, { market: MARKET_CAP_RANGE, rules: { ...SIZE_RULES, smoothDays: scenario.size?.smoothDays ?? SIZE_RULES.smoothDays, dwellDays: scenario.size?.dwellDays ?? SIZE_RULES.dwellDays } });
}
