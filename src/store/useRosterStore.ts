import { create } from 'zustand';
import { COMPANY_BY_TICKER } from '../config/companies';
import { cloneRoster, DEFAULT_ROSTER, isDefaultRoster, plotOf, sanitizeRoster, swapInto, type Roster } from '../config/roster';

const KEY = 'psx-world-roster';

function load(): Roster {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? sanitizeRoster(JSON.parse(raw)) : cloneRoster(DEFAULT_ROSTER);
  } catch {
    return cloneRoster(DEFAULT_ROSTER);
  }
}

function save(roster: Roster, isDefault: boolean) {
  try {
    if (isDefault) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(roster));
  } catch {
    /* storage can be blocked or full: the swap still works for this visit */
  }
}

interface RosterState {
  roster: Roster;
  /** Put `ticker` on lot `plot` of its sector (trading places if it already has one). Yours only: it lives in this browser. */
  place: (sectorId: string, plot: number, ticker: string) => void;
  reset: () => void;
}

export const useRosterStore = create<RosterState>((set, get) => ({
  roster: load(),
  place: (sectorId, plot, ticker) => {
    const sector = COMPANY_BY_TICKER[ticker]?.sectorId;
    if (!sector || sector !== sectorId) return;
    const next = swapInto(get().roster, sector, plot, ticker);
    if (next === get().roster) return;
    save(next, isDefaultRoster(next));
    set({ roster: next });
  },
  reset: () => {
    save(DEFAULT_ROSTER, true);
    set({ roster: cloneRoster(DEFAULT_ROSTER) });
  },
}));

/** The lot a company stands on right now, or null when it is not on the map. */
export const usePlot = (ticker: string): number | null => useRosterStore((s) => plotOf(s.roster, ticker));
