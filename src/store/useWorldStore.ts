import { create } from 'zustand';
import type { SectorId } from '../config/sectors';

interface WorldUiState {
  selectedTicker: string | null;
  hoveredTicker: string | null;
  /** A district picked by clicking its park; only one of company or district is selected at a time. */
  selectedSector: SectorId | null;
  showLegend: boolean;
  /** The lab panel: forces any level, build stage, state or event on the selected company. */
  showLab: boolean;
  /** A request for the camera to fly to a company; `nonce` changes on every request so asking twice flies twice. */
  focus: { ticker: string; nonce: number } | null;
  select: (ticker: string | null) => void;
  hover: (ticker: string | null) => void;
  selectSector: (id: SectorId | null) => void;
  setShowLegend: (on: boolean) => void;
  setShowLab: (on: boolean) => void;
  flyTo: (ticker: string) => void;
}

export const useWorldStore = create<WorldUiState>((set) => ({
  selectedTicker: null,
  hoveredTicker: null,
  selectedSector: null,
  showLegend: false,
  showLab: false,
  focus: null,
  select: (ticker) => set(ticker ? { selectedTicker: ticker, selectedSector: null } : { selectedTicker: null }),
  hover: (ticker) => set({ hoveredTicker: ticker }),
  selectSector: (id) => set(id ? { selectedSector: id, selectedTicker: null } : { selectedSector: null }),
  setShowLegend: (on) => set({ showLegend: on }),
  setShowLab: (on) => set({ showLab: on }),
  flyTo: (ticker) => set((s) => ({ focus: { ticker, nonce: (s.focus?.nonce ?? 0) + 1 } })),
}));
