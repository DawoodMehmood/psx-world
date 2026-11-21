import { logPosition } from '../engine/size';
import { SECTOR_BY_ID, type SectorId } from './sectors';

export type Archetype = 'bank' | 'oil' | 'cement' | 'tech';

export interface CompanyDefinition {
  ticker: string;
  name: string;
  sectorId: SectorId;
  /** Market cap in Rs billions (dps.psx.com.pk, Oct–Nov 2026). Simulation seed; live data replaces it. */
  marketCap: number;
  /** Relative size within its sector, 0–1, from market cap on a log scale. Drives tower height, band count and prop count, never price. */
  scale: number;
  accent: string;
  archetype: Archetype;
  /** Shares in issue, for market cap (price × shares). From dps.psx.com.pk, Oct–Nov 2026. */
  sharesOutstanding: number;
}

type RawCompany = Omit<CompanyDefinition, 'scale' | 'accent' | 'archetype'> & { accent?: string };

/** A steady, distinct accent for a company with no hand-picked one: a hue from its ticker. */
export function accentFor(ticker: string): string {
  let h = 2166136261;
  for (const ch of ticker) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const hue = ((h >>> 0) % 360) | 0;
  return `hsl(${hue} 62% 46%)`;
}

const ARCHETYPE_OF: Record<SectorId, Archetype> = { banks: 'bank', oil: 'oil', cement: 'cement', tech: 'tech' };

/**
 * Every company the city can show: the candidates for each district's lots.
 * Which six stand in a district is the roster's business (roster.ts).
 */
const RAW_COMPANIES: RawCompany[] = [
  // banks
  { ticker: 'MEBL', name: 'Meezan Bank', sectorId: 'banks', marketCap: 955, accent: '#2f8f5b', sharesOutstanding: 1807096448 },
  { ticker: 'HBL', name: 'Habib Bank', sectorId: 'banks', marketCap: 428, accent: '#1f8a7a', sharesOutstanding: 1466852508 },
  { ticker: 'UBL', name: 'United Bank', sectorId: 'banks', marketCap: 1026, accent: '#2c5fb8', sharesOutstanding: 2504247750 },
  { ticker: 'MCB', name: 'MCB Bank', sectorId: 'banks', marketCap: 479.1, sharesOutstanding: 1185060006 },
  { ticker: 'BAFL', name: 'Bank Alfalah', sectorId: 'banks', marketCap: 188.3, sharesOutstanding: 3154330238 },
  { ticker: 'BOP', name: 'Bank of Punjab', sectorId: 'banks', marketCap: 102.3, sharesOutstanding: 3271569319 },
  { ticker: 'BAHL', name: 'Bank AL Habib', sectorId: 'banks', marketCap: 188.8, sharesOutstanding: 1111425419 },
  { ticker: 'ABL', name: 'Allied Bank', sectorId: 'banks', marketCap: 196.5, sharesOutstanding: 1145073830 },
  { ticker: 'AKBL', name: 'Askari Bank', sectorId: 'banks', marketCap: 167.8, sharesOutstanding: 1449299207 },
  { ticker: 'FABL', name: 'Faysal Bank', sectorId: 'banks', marketCap: 142.7, sharesOutstanding: 1517696526 },

  // oil and gas: exploration, marketing and refining
  { ticker: 'OGDC', name: 'Oil and Gas Development Co.', sectorId: 'oil', marketCap: 1319, accent: '#e0682b', sharesOutstanding: 4300928400 },
  { ticker: 'PPL', name: 'Pakistan Petroleum', sectorId: 'oil', marketCap: 582, accent: '#d23f3f', sharesOutstanding: 2720967548 },
  { ticker: 'MARI', name: 'Mari Energies', sectorId: 'oil', marketCap: 758, accent: '#e6a92e', sharesOutstanding: 1200622500 },
  { ticker: 'POL', name: 'Pakistan Oilfields', sectorId: 'oil', marketCap: 187.1, sharesOutstanding: 283855104 },
  { ticker: 'PSO', name: 'Pakistan State Oil', sectorId: 'oil', marketCap: 168.5, sharesOutstanding: 469473300 },
  { ticker: 'SNGP', name: 'Sui Northern Gas', sectorId: 'oil', marketCap: 58, sharesOutstanding: 634216665 },
  { ticker: 'ATRL', name: 'Attock Refinery', sectorId: 'oil', marketCap: 99, sharesOutstanding: 106616250 },
  { ticker: 'APL', name: 'Attock Petroleum', sectorId: 'oil', marketCap: 70.9, sharesOutstanding: 124416000 },
  { ticker: 'SSGC', name: 'Sui Southern Gas', sectorId: 'oil', marketCap: 21.1, sharesOutstanding: 880916309 },

  // cement
  { ticker: 'LUCK', name: 'Lucky Cement', sectorId: 'cement', marketCap: 573, accent: '#d94b3d', sharesOutstanding: 1465000000 },
  { ticker: 'DGKC', name: 'D.G. Khan Cement', sectorId: 'cement', marketCap: 78, accent: '#3d7fd9', sharesOutstanding: 438119097 },
  { ticker: 'FCCL', name: 'Fauji Cement', sectorId: 'cement', marketCap: 128, accent: '#4f9a3f', sharesOutstanding: 2452847220 },
  { ticker: 'BWCL', name: 'Bestway Cement', sectorId: 'cement', marketCap: 275, sharesOutstanding: 596252783 },
  { ticker: 'MLCF', name: 'Maple Leaf Cement', sectorId: 'cement', marketCap: 110.8, sharesOutstanding: 1047562608 },
  { ticker: 'CHCC', name: 'Cherat Cement', sectorId: 'cement', marketCap: 57.1, sharesOutstanding: 194295038 },
  { ticker: 'KOHC', name: 'Kohat Cement', sectorId: 'cement', marketCap: 87.4, sharesOutstanding: 919306485 },
  { ticker: 'PIOC', name: 'Pioneer Cement', sectorId: 'cement', marketCap: 63, sharesOutstanding: 227148793 },
  { ticker: 'ACPL', name: 'Attock Cement', sectorId: 'cement', marketCap: 36.8, sharesOutstanding: 137426961 },

  // technology and communication
  { ticker: 'SYS', name: 'Systems Limited', sectorId: 'tech', marketCap: 167, accent: '#6a4fd8', sharesOutstanding: 1530982855 },
  { ticker: 'TRG', name: 'TRG Pakistan', sectorId: 'tech', marketCap: 28, accent: '#e0508f', sharesOutstanding: 545390665 },
  { ticker: 'AVN', name: 'Avanceon', sectorId: 'tech', marketCap: 10.4, accent: '#24a7c9', sharesOutstanding: 429667346 },
  { ticker: 'PTC', name: 'Pakistan Telecom (PTCL)', sectorId: 'tech', marketCap: 168.5, sharesOutstanding: 3774000000 },
  { ticker: 'AIRLINK', name: 'Air Link Communication', sectorId: 'tech', marketCap: 43.5, sharesOutstanding: 395269231 },
  { ticker: 'NETSOL', name: 'NetSol Technologies', sectorId: 'tech', marketCap: 10.4, sharesOutstanding: 89836923 },
  { ticker: 'WTL', name: 'Worldcall Telecom', sectorId: 'tech', marketCap: 6.7, sharesOutstanding: 4982289186 },
  { ticker: 'TELE', name: 'Telecard', sectorId: 'tech', marketCap: 2.5, sharesOutstanding: 338625000 },
];

/** Scale is each company's place in its sector's cap range, so UBL (Rs 1,026B) reads bigger than MEBL (Rs 955B), and TRG far smaller than a placeholder would have said. */
export const COMPANIES: CompanyDefinition[] = RAW_COMPANIES.map((c) => {
  const { low, high } = SECTOR_BY_ID[c.sectorId].capRange;
  return { ...c, accent: c.accent ?? accentFor(c.ticker), archetype: ARCHETYPE_OF[c.sectorId], scale: Math.round(logPosition(c.marketCap, low, high) * 100) / 100 };
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
