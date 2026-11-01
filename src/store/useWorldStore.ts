import { create } from 'zustand';
import type { SectorId } from '../config/sectors';

interface WorldUiState {
  selectedTicker: string | null;
  hoveredTicker: string | null;
  /** A district picked by clicking its park; only one of company or district is selected at a time. */
  selectedSector: SectorId | null;
  showLegend: boolean;
  select: (ticker: string | null) => void;
  hover: (ticker: string | null) => void;
  selectSector: (id: SectorId | null) => void;
  setShowLegend: (on: boolean) => void;
}

export const useWorldStore = create<WorldUiState>((set) => ({
  selectedTicker: null,
  hoveredTicker: null,
  selectedSector: null,
  showLegend: false,
  select: (ticker) => set(ticker ? { selectedTicker: ticker, selectedSector: null } : { selectedTicker: null }),
  hover: (ticker) => set({ hoveredTicker: ticker }),
  selectSector: (id) => set(id ? { selectedSector: id, selectedTicker: null } : { selectedSector: null }),
  setShowLegend: (on) => set({ showLegend: on }),
}));
