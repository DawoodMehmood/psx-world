import { SECTOR_RELATIVE_WEIGHT } from '../config/thresholds';
import { Aggregator } from './aggregate';
import { CompanyTracker, type EngineCompany } from './company';
import { TICKS_PER_DAY, type History, type Observation, type Snapshot } from './types';

export interface MarketData {
  /** Number of scenario days. */
  days: number;
  history: Record<string, History>;
  /** observations[index] holds one observation per company for that tick. */
  observations: Observation[][];
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Health score: 20-day return, plus a share of how far the company leads (or trails) its sector. */
function updateHealth(trackers: CompanyTracker[]) {
  const bySector = new Map<string, CompanyTracker[]>();
  trackers.forEach((t) => bySector.set(t.company.sectorId, [...(bySector.get(t.company.sectorId) ?? []), t]));
  bySector.forEach((group) => {
    const mid = median(group.map((t) => t.return20Pct));
    group.forEach((t) => t.setHealth(t.return20Pct + SECTOR_RELATIVE_WEIGHT * (t.return20Pct - mid)));
  });
}

/**
 * Runs the whole scenario and returns one snapshot per tick. Deterministic:
 * the same data always gives the same snapshots, so stepping backwards is
 * just reading an earlier snapshot.
 */
export function runMarket(data: MarketData, companies: EngineCompany[]): Snapshot[] {
  const trackers = companies.map((c) => new CompanyTracker(c, data.history[c.ticker]));
  updateHealth(trackers);
  const aggregator = new Aggregator(
    Object.fromEntries(companies.map((c) => [c.ticker, c.sectorId])),
    Object.fromEntries(companies.map((c) => [c.ticker, c.scale])),
  );

  return data.observations.map((tickObs, index) => {
    const day = Math.floor(index / TICKS_PER_DAY) + 1;
    const tick = index % TICKS_PER_DAY;
    const byTicker = new Map(tickObs.map((o) => [o.ticker, o]));
    trackers.forEach((t) => {
      const obs = byTicker.get(t.ticker);
      if (obs) t.observe(obs, index);
    });
    if (tick === TICKS_PER_DAY - 1) {
      trackers.forEach((t) => t.closeDay(index));
      updateHealth(trackers);
      trackers.forEach((t) => t.advanceConstruction());
    }
    const companiesNow = Object.fromEntries(trackers.map((t) => [t.ticker, t.snapshot(index, tick)]));
    return { clock: { index, day, tick }, companies: companiesNow, ...aggregator.update(companiesNow) };
  });
}
