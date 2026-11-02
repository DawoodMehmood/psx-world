import { logPosition } from '../engine/size';
import { SECTOR_BY_ID, type SectorId } from './sectors';

export type Archetype = 'bank' | 'oil' | 'cement' | 'tech';

export interface CompanyDefinition {
  ticker: string;
  name: string;
  sectorId: SectorId;
  /** Market cap in Rs billions on 30 Oct 2026 (dps.psx.com.pk). Simulation seed; live data replaces it. */
  marketCap: number;
  /** Relative size within its sector, 0–1, from market cap on a log scale. Drives tower height, band count and prop count, never price. */
  scale: number;
  accent: string;
  archetype: Archetype;
  /** Which lot of the district (0 = nearest the Exchange). */
  plot: 0 | 1 | 2;
  /** Shares in issue, for market cap (price × shares). From dps.psx.com.pk, 30 Oct 2026. */
  sharesOutstanding: number;
}

type RawCompany = Omit<CompanyDefinition, 'scale'>;

const RAW_COMPANIES: RawCompany[] = [
  { ticker: 'MEBL', name: 'Meezan Bank', sectorId: 'banks', marketCap: 955, accent: '#2f8f5b', archetype: 'bank', plot: 0, sharesOutstanding: 1807096448 },
  { ticker: 'HBL', name: 'Habib Bank', sectorId: 'banks', marketCap: 428, accent: '#1f8a7a', archetype: 'bank', plot: 1, sharesOutstanding: 1466852508 },
  { ticker: 'UBL', name: 'United Bank', sectorId: 'banks', marketCap: 1026, accent: '#2c5fb8', archetype: 'bank', plot: 2, sharesOutstanding: 2504247750 },

  { ticker: 'OGDC', name: 'Oil and Gas Development Co.', sectorId: 'oil', marketCap: 1319, accent: '#e0682b', archetype: 'oil', plot: 0, sharesOutstanding: 4300928400 },
  { ticker: 'PPL', name: 'Pakistan Petroleum', sectorId: 'oil', marketCap: 582, accent: '#d23f3f', archetype: 'oil', plot: 1, sharesOutstanding: 2720967548 },
  { ticker: 'MARI', name: 'Mari Energies', sectorId: 'oil', marketCap: 758, accent: '#e6a92e', archetype: 'oil', plot: 2, sharesOutstanding: 1200622500 },

  { ticker: 'LUCK', name: 'Lucky Cement', sectorId: 'cement', marketCap: 573, accent: '#d94b3d', archetype: 'cement', plot: 0, sharesOutstanding: 1465000000 },
  { ticker: 'DGKC', name: 'D.G. Khan Cement', sectorId: 'cement', marketCap: 78, accent: '#3d7fd9', archetype: 'cement', plot: 1, sharesOutstanding: 438119097 },
  { ticker: 'FCCL', name: 'Fauji Cement', sectorId: 'cement', marketCap: 128, accent: '#4f9a3f', archetype: 'cement', plot: 2, sharesOutstanding: 2452847220 },

  { ticker: 'SYS', name: 'Systems Limited', sectorId: 'tech', marketCap: 167, accent: '#6a4fd8', archetype: 'tech', plot: 0, sharesOutstanding: 1530982855 },
  { ticker: 'TRG', name: 'TRG Pakistan', sectorId: 'tech', marketCap: 28, accent: '#e0508f', archetype: 'tech', plot: 1, sharesOutstanding: 545390665 },
  { ticker: 'AVN', name: 'Avanceon', sectorId: 'tech', marketCap: 10.4, accent: '#24a7c9', archetype: 'tech', plot: 2, sharesOutstanding: 429667346 },
];

/** Scale is each company's place in its sector's cap range, so UBL (Rs 1,026B) reads bigger than MEBL (Rs 955B), and TRG far smaller than a placeholder would have said. */
export const COMPANIES: CompanyDefinition[] = RAW_COMPANIES.map((c) => {
  const { low, high } = SECTOR_BY_ID[c.sectorId].capRange;
  return { ...c, scale: Math.round(logPosition(c.marketCap, low, high) * 100) / 100 };
});

export const COMPANY_BY_TICKER = Object.fromEntries(COMPANIES.map((c) => [c.ticker, c])) as Record<string, CompanyDefinition>;

export interface SiteTier {
  /**
   * How deep the site reaches into its lot, in tiles, from the lot's back edge
   * toward the camera. The site always spans the lot's full width.
   */
  depth: number;
  /** Expansion slots this tier adds, built in order before the site can grow again. */
  slots: number;
}

/**
 * Site tiers (SPEC §8). Every archetype uses the same plan: the back 6 rows of
 * the lot, then 10, then the whole 14×14 lot, with 1, 2 and 3 expansion slots
 * (see buildings/shared.tsx). Sites grow toward the camera, so new buildings
 * always appear in front of the old ones.
 */
const STANDARD_TIERS: SiteTier[] = [
  { depth: 6, slots: 1 },
  { depth: 10, slots: 2 },
  { depth: 14, slots: 3 },
];

export const SITE_TIERS: Record<Archetype, SiteTier[]> = {
  cement: STANDARD_TIERS,
  bank: STANDARD_TIERS,
  oil: STANDARD_TIERS,
  tech: STANDARD_TIERS,
};

export const siteTier = (c: CompanyDefinition, tier: number) => SITE_TIERS[c.archetype][Math.min(tier, SITE_TIERS[c.archetype].length) - 1];

export const ENGINE_COMPANIES = COMPANIES.map((c) => ({
  ticker: c.ticker,
  sectorId: c.sectorId,
  scale: c.scale,
  sharesOutstanding: c.sharesOutstanding,
  sectorCapRange: SECTOR_BY_ID[c.sectorId].capRange,
}));
