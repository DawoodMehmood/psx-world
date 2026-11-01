import type { SectorId } from './sectors';

export type Archetype = 'bank' | 'oil' | 'cement' | 'tech';

export interface CompanyDefinition {
  ticker: string;
  name: string;
  sectorId: SectorId;
  /** Relative size within the city, 0–1. Drives building height and prop count, never price. */
  scale: number;
  accent: string;
  archetype: Archetype;
  /** Which lot of the district (0 = nearest the Exchange). */
  plot: 0 | 1 | 2;
  /** Site tier on day 1 (SPEC §8). Bigger companies start on bigger sites. */
  startTier: 1 | 2 | 3;
  /** Shares in issue, for market cap (price × shares). From dps.psx.com.pk, 30 Oct 2026. */
  sharesOutstanding: number;
}

export const COMPANIES: CompanyDefinition[] = [
  { ticker: 'MEBL', name: 'Meezan Bank', sectorId: 'banks', scale: 0.9, accent: '#2f8f5b', archetype: 'bank', plot: 0, startTier: 2, sharesOutstanding: 1807096448 },
  { ticker: 'HBL', name: 'Habib Bank', sectorId: 'banks', scale: 0.8, accent: '#1f8a7a', archetype: 'bank', plot: 1, startTier: 2, sharesOutstanding: 1466852508 },
  { ticker: 'UBL', name: 'United Bank', sectorId: 'banks', scale: 0.65, accent: '#2c5fb8', archetype: 'bank', plot: 2, startTier: 1, sharesOutstanding: 2504247750 },

  { ticker: 'OGDC', name: 'Oil and Gas Development Co.', sectorId: 'oil', scale: 0.95, accent: '#e0682b', archetype: 'oil', plot: 0, startTier: 2, sharesOutstanding: 4300928400 },
  { ticker: 'PPL', name: 'Pakistan Petroleum', sectorId: 'oil', scale: 0.7, accent: '#d23f3f', archetype: 'oil', plot: 1, startTier: 1, sharesOutstanding: 2720967548 },
  { ticker: 'MARI', name: 'Mari Energies', sectorId: 'oil', scale: 0.75, accent: '#e6a92e', archetype: 'oil', plot: 2, startTier: 1, sharesOutstanding: 1200622500 },

  { ticker: 'LUCK', name: 'Lucky Cement', sectorId: 'cement', scale: 0.9, accent: '#d94b3d', archetype: 'cement', plot: 0, startTier: 2, sharesOutstanding: 1465000000 },
  { ticker: 'DGKC', name: 'D.G. Khan Cement', sectorId: 'cement', scale: 0.5, accent: '#3d7fd9', archetype: 'cement', plot: 1, startTier: 1, sharesOutstanding: 438119097 },
  { ticker: 'FCCL', name: 'Fauji Cement', sectorId: 'cement', scale: 0.55, accent: '#4f9a3f', archetype: 'cement', plot: 2, startTier: 1, sharesOutstanding: 2452847220 },

  { ticker: 'SYS', name: 'Systems Limited', sectorId: 'tech', scale: 0.85, accent: '#6a4fd8', archetype: 'tech', plot: 0, startTier: 2, sharesOutstanding: 1530982855 },
  { ticker: 'TRG', name: 'TRG Pakistan', sectorId: 'tech', scale: 0.6, accent: '#e0508f', archetype: 'tech', plot: 1, startTier: 1, sharesOutstanding: 545390665 },
  { ticker: 'AVN', name: 'Avanceon', sectorId: 'tech', scale: 0.4, accent: '#24a7c9', archetype: 'tech', plot: 2, startTier: 1, sharesOutstanding: 429667346 },
];

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
  startTier: Math.min(c.startTier, SITE_TIERS[c.archetype].length),
  slotsPerTier: SITE_TIERS[c.archetype].map((t) => t.slots),
}));
