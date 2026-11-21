import { COMPANIES, COMPANY_BY_TICKER } from './companies';
import { SECTORS, type SectorId } from './sectors';

/*
 * Which company stands on which lot (DESIGN.md: lots are separate from
 * companies). A district has room for LOTS_PER_DISTRICT lots, nearest the
 * Exchange first; the roster fills the first ROSTER_SIZE of them. The default
 * is hand-picked for variety of size, not the biggest N. A viewer can swap
 * any lot for another company of the same sector (store/useRosterStore.ts).
 */

export const ROSTER_SIZE = 6;
export const LOTS_PER_DISTRICT = 8;

export type Roster = Record<SectorId, string[]>;

export const DEFAULT_ROSTER: Roster = {
  banks: ['MEBL', 'HBL', 'UBL', 'MCB', 'BAFL', 'BOP'],
  oil: ['OGDC', 'PPL', 'MARI', 'POL', 'PSO', 'SNGP'],
  cement: ['LUCK', 'DGKC', 'FCCL', 'BWCL', 'MLCF', 'CHCC'],
  tech: ['SYS', 'TRG', 'AVN', 'PTC', 'AIRLINK', 'NETSOL'],
};

export const cloneRoster = (r: Roster): Roster => Object.fromEntries(SECTORS.map((s) => [s.id, [...r[s.id]]])) as Roster;

/** Whether a roster is the default city, lot for lot. */
export const isDefaultRoster = (r: Roster): boolean => SECTORS.every((s) => r[s.id].length === DEFAULT_ROSTER[s.id].length && r[s.id].every((t, i) => t === DEFAULT_ROSTER[s.id][i]));

/** The companies a sector can show on its lots: every company in the pool that belongs to it. */
export const candidatesOf = (sectorId: SectorId) => COMPANIES.filter((c) => c.sectorId === sectorId);

/** Where a company stands: its district's lot number, or null when it is not on the map. */
export function plotOf(roster: Roster, ticker: string): number | null {
  const c = COMPANY_BY_TICKER[ticker];
  if (!c) return null;
  const i = roster[c.sectorId].indexOf(ticker);
  return i < 0 ? null : i;
}

/**
 * Put `ticker` on lot `plot` of its sector. If it already stands on another
 * lot, the two companies trade places; otherwise the old occupant leaves the map.
 */
export function swapInto(roster: Roster, sectorId: SectorId, plot: number, ticker: string): Roster {
  if (COMPANY_BY_TICKER[ticker]?.sectorId !== sectorId || plot < 0 || plot >= ROSTER_SIZE) return roster;
  const next = cloneRoster(roster);
  const lots = next[sectorId];
  const from = lots.indexOf(ticker);
  if (from === plot) return roster;
  if (from >= 0) lots[from] = lots[plot];
  lots[plot] = ticker;
  return next;
}

/** A roster read back from storage: the saved lots where they are valid, the defaults elsewhere, never a company twice or in the wrong district. */
export function sanitizeRoster(raw: unknown): Roster {
  const out = cloneRoster(DEFAULT_ROSTER);
  if (!raw || typeof raw !== 'object') return out;
  for (const s of SECTORS) {
    const saved = (raw as Record<string, unknown>)[s.id];
    if (!Array.isArray(saved) || saved.length !== ROSTER_SIZE) continue;
    const ok = saved.every((t) => typeof t === 'string' && COMPANY_BY_TICKER[t]?.sectorId === s.id) && new Set(saved).size === ROSTER_SIZE;
    if (ok) out[s.id] = [...saved] as string[];
  }
  return out;
}

/** Every company currently on the map, in district then lot order. */
export const placedTickers = (roster: Roster): string[] => SECTORS.flatMap((s) => roster[s.id]);
