import { ENGINE_COMPANIES } from '../config/companies';
import { runMarket } from '../engine/market';
import type { Snapshot } from '../engine/types';
import { generateMarket } from './generator';
import type { Scenario } from './types';

/** Generate a scenario's data and run the engine over it. */
export function simulate(scenario: Scenario): Snapshot[] {
  const data = generateMarket(
    scenario,
    ENGINE_COMPANIES.map((c) => c.ticker),
  );
  return runMarket(data, ENGINE_COMPANIES);
}
