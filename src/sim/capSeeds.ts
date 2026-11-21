import { COMPANIES } from '../config/companies';
import { MARKET_CAP_RANGE, SECTOR_BY_ID } from '../config/sectors';
import { computeSize, type CompanySize } from '../engine/size';
import { generateCapHistory, type CapSeed } from './history';

/**
 * Simulation inputs for size. `cap` is each company's market cap (see
 * companies.ts). `cycle` is invented: it says how
 * far through its own 5-year range the company stands, spread from a company
 * near its high to one near its low so every part of the ladder gets used.
 */
const CYCLES: Record<string, number> = { MEBL: 0.85, HBL: 0.55, UBL: 0.9, OGDC: 0.7, PPL: 0.4, MARI: 0.8, LUCK: 0.65, DGKC: 0.3, FCCL: 0.5, SYS: 0.35, TRG: 0.2, AVN: 0.1,
  // the rest of the pool, spread so every part of the ladder gets used
  MCB: 0.75, BAFL: 0.6, BOP: 0.25, BAHL: 0.5, ABL: 0.45, AKBL: 0.35, FABL: 0.4,
  POL: 0.55, PSO: 0.8, SNGP: 0.3, ATRL: 0.45, APL: 0.6, SSGC: 0.15,
  BWCL: 0.7, MLCF: 0.5, CHCC: 0.85, KOHC: 0.4, PIOC: 0.55, ACPL: 0.2,
  PTC: 0.65, AIRLINK: 0.9, NETSOL: 0.3, WTL: 0.2, TELE: 0.1,
};

export const CAP_SEEDS: Record<string, CapSeed> = Object.fromEntries(COMPANIES.map((c) => [c.ticker, { cap: c.marketCap, cycle: CYCLES[c.ticker] }]));

/** Each company's size, from its generated cap history. */
export function simulatedSizes(): Record<string, CompanySize> {
  return Object.fromEntries(
    COMPANIES.map((c, i) => {
      const caps = generateCapHistory(CAP_SEEDS[c.ticker], 1000 + i * 31);
      return [c.ticker, computeSize(caps, SECTOR_BY_ID[c.sectorId].capRange, MARKET_CAP_RANGE)];
    }),
  );
}
