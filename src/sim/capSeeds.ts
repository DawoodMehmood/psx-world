import { COMPANIES } from '../config/companies';
import { MARKET_CAP_RANGE, SECTOR_BY_ID } from '../config/sectors';
import { computeSize, type CompanySize } from '../engine/size';
import { generateCapHistory, type CapSeed } from './history';

/**
 * Simulation inputs for size. `cap` is each company's real market cap on
 * 30 Oct 2026 (dps.psx.com.pk, Rs billions). `cycle` is invented: it says how
 * far through its own 5-year range the company stands, spread from a company
 * near its high to one near its low so every part of the ladder gets used.
 */
export const CAP_SEEDS: Record<string, CapSeed> = {
  MEBL: { cap: 955, cycle: 0.85 },
  HBL: { cap: 428, cycle: 0.55 },
  UBL: { cap: 1026, cycle: 0.9 },
  OGDC: { cap: 1319, cycle: 0.7 },
  PPL: { cap: 582, cycle: 0.4 },
  MARI: { cap: 758, cycle: 0.8 },
  LUCK: { cap: 573, cycle: 0.65 },
  DGKC: { cap: 78, cycle: 0.3 },
  FCCL: { cap: 128, cycle: 0.5 },
  SYS: { cap: 167, cycle: 0.35 },
  TRG: { cap: 28, cycle: 0.2 },
  AVN: { cap: 10.4, cycle: 0.1 },
};

/** Each company's size, from its generated cap history. */
export function simulatedSizes(): Record<string, CompanySize> {
  return Object.fromEntries(
    COMPANIES.map((c, i) => {
      const caps = generateCapHistory(CAP_SEEDS[c.ticker], 1000 + i * 31);
      return [c.ticker, computeSize(caps, SECTOR_BY_ID[c.sectorId].capRange, MARKET_CAP_RANGE)];
    }),
  );
}
