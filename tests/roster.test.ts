import { describe, expect, it } from 'vitest';
import { COMPANIES } from '../src/config/companies';
import { candidatesOf, cloneRoster, isDefaultRoster, DEFAULT_ROSTER, placedTickers, plotOf, ROSTER_SIZE, sanitizeRoster, swapInto } from '../src/config/roster';
import { SECTORS } from '../src/config/sectors';

describe('roster', () => {
  it('puts six distinct companies of the right sector in every district, all of them in the pool', () => {
    for (const s of SECTORS) {
      const lots = DEFAULT_ROSTER[s.id];
      expect(lots).toHaveLength(ROSTER_SIZE);
      expect(new Set(lots).size).toBe(ROSTER_SIZE);
      for (const t of lots) expect(candidatesOf(s.id).some((c) => c.ticker === t)).toBe(true);
    }
    expect(new Set(placedTickers(DEFAULT_ROSTER)).size).toBe(ROSTER_SIZE * SECTORS.length);
  });

  it('keeps the original twelve on their original lots', () => {
    expect(plotOf(DEFAULT_ROSTER, 'MEBL')).toBe(0);
    expect(plotOf(DEFAULT_ROSTER, 'UBL')).toBe(2);
    expect(plotOf(DEFAULT_ROSTER, 'LUCK')).toBe(0);
    expect(plotOf(DEFAULT_ROSTER, 'AVN')).toBe(2);
  });

  it('offers every sector more companies than it has lots, so there is something to swap in', () => {
    for (const s of SECTORS) expect(candidatesOf(s.id).length).toBeGreaterThan(ROSTER_SIZE);
  });

  it('swaps in a company that is not on the map: it takes the lot and the old one leaves', () => {
    const next = swapInto(DEFAULT_ROSTER, 'banks', 1, 'ABL');
    expect(next.banks[1]).toBe('ABL');
    expect(next.banks).not.toContain('HBL');
    expect(new Set(next.banks).size).toBe(ROSTER_SIZE);
    expect(DEFAULT_ROSTER.banks[1]).toBe('HBL');
  });

  it('trades places with a company that is already on another lot', () => {
    const next = swapInto(DEFAULT_ROSTER, 'cement', 0, 'CHCC');
    expect(next.cement[0]).toBe('CHCC');
    expect(next.cement[5]).toBe('LUCK');
    expect(new Set(next.cement).size).toBe(ROSTER_SIZE);
  });

  it('refuses a company from another sector, a lot that does not exist, and a no-op', () => {
    expect(swapInto(DEFAULT_ROSTER, 'banks', 0, 'LUCK')).toBe(DEFAULT_ROSTER);
    expect(swapInto(DEFAULT_ROSTER, 'banks', 9, 'ABL')).toBe(DEFAULT_ROSTER);
    expect(swapInto(DEFAULT_ROSTER, 'banks', 0, 'MEBL')).toBe(DEFAULT_ROSTER);
  });

  it('reads saved rosters safely: bad, partial or tampered data falls back to the defaults', () => {
    expect(sanitizeRoster(null)).toEqual(DEFAULT_ROSTER);
    expect(sanitizeRoster('nonsense')).toEqual(DEFAULT_ROSTER);
    const good = swapInto(DEFAULT_ROSTER, 'oil', 2, 'ATRL');
    expect(sanitizeRoster(JSON.parse(JSON.stringify(good)))).toEqual(good);
    const duplicate = cloneRoster(DEFAULT_ROSTER);
    duplicate.banks[1] = 'MEBL';
    expect(sanitizeRoster(duplicate).banks).toEqual(DEFAULT_ROSTER.banks);
    const wrongSector = cloneRoster(DEFAULT_ROSTER);
    wrongSector.tech[0] = 'LUCK';
    expect(sanitizeRoster(wrongSector).tech).toEqual(DEFAULT_ROSTER.tech);
    expect(sanitizeRoster({ banks: ['x'] }).banks).toEqual(DEFAULT_ROSTER.banks);
  });

  it('knows the default city however the sectors are ordered, and any swap makes it custom', () => {
    expect(isDefaultRoster(DEFAULT_ROSTER)).toBe(true);
    expect(isDefaultRoster(cloneRoster(DEFAULT_ROSTER))).toBe(true);
    expect(isDefaultRoster(swapInto(DEFAULT_ROSTER, 'banks', 1, 'ABL'))).toBe(false);
    expect(isDefaultRoster(swapInto(swapInto(DEFAULT_ROSTER, 'banks', 1, 'ABL'), 'banks', 1, 'HBL'))).toBe(true);
  });

  it('gives every company in the pool a name, an accent and a sector', () => {
    expect(new Set(COMPANIES.map((c) => c.ticker)).size).toBe(COMPANIES.length);
    for (const c of COMPANIES) {
      expect(c.accent, c.ticker).toBeTruthy();
      expect(c.sharesOutstanding, c.ticker).toBeGreaterThan(0);
      expect(c.marketCap, c.ticker).toBeGreaterThan(0);
    }
  });
});
