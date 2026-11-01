import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { CompanyState, Snapshot } from '../engine/types';
import { TICKS_PER_DAY } from '../engine/types';
import { simulate } from '../sim/run';
import { SCENARIOS } from '../sim/scenarios';
import type { Scenario } from '../sim/types';

/** Demo override: force some of a company's levels to test visuals. */
export type Override = Partial<Pick<CompanyState, 'health' | 'direction' | 'activity' | 'volatility' | 'halted'>>;

export const SPEEDS = [0.5, 1, 2, 4] as const;
/** At 1× one tick takes 2.5 s, so a trading day takes 20 s (SPEC §5). */
export const TICK_MS = 2500;

interface SimState {
  scenario: Scenario;
  snapshots: Snapshot[];
  index: number;
  playing: boolean;
  speed: number;
  overrides: Record<string, Override>;
  loadScenario: (id: string) => void;
  setIndex: (index: number) => void;
  stepTick: (delta: number) => void;
  stepDay: (delta: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
  setOverride: (ticker: string, patch: Override | null) => void;
}

const first = SCENARIOS[0];

export const useSimStore = create<SimState>((set, get) => ({
  scenario: first,
  snapshots: simulate(first),
  index: 0,
  playing: false,
  speed: 1,
  overrides: {},
  loadScenario: (id) => {
    const scenario = SCENARIOS.find((s) => s.id === id) ?? first;
    set({ scenario, snapshots: simulate(scenario), index: 0, playing: false });
  },
  setIndex: (index) => set({ index: Math.max(0, Math.min(get().snapshots.length - 1, index)) }),
  stepTick: (delta) => {
    const last = get().snapshots.length - 1;
    const index = Math.max(0, Math.min(last, get().index + delta));
    set({ index, playing: get().playing && index < last });
  },
  stepDay: (delta) => {
    const { index } = get();
    const dayStart = index - (index % TICKS_PER_DAY);
    // Back from mid-day goes to the start of today; otherwise to the start of the previous day.
    const target = delta < 0 && index !== dayStart ? dayStart : dayStart + delta * TICKS_PER_DAY;
    get().setIndex(target);
  },
  setPlaying: (playing) => {
    const { index, snapshots } = get();
    // Pressing play at the end starts over.
    set({ playing, index: playing && index >= snapshots.length - 1 ? 0 : index });
  },
  setSpeed: (speed) => set({ speed }),
  reset: () => set({ index: 0, playing: false, overrides: {} }),
  setOverride: (ticker, patch) => {
    const overrides = { ...get().overrides };
    if (patch && Object.keys(patch).length) overrides[ticker] = patch;
    else delete overrides[ticker];
    set({ overrides });
  },
}));

/** The company's state at the current tick, with any demo override applied. */
export function effectiveCompany(s: Pick<SimState, 'snapshots' | 'index' | 'overrides'>, ticker: string): CompanyState {
  const c = s.snapshots[s.index].companies[ticker];
  const o = s.overrides[ticker];
  return o ? { ...c, ...o } : c;
}

/** Selects the raw state and the override separately: merging inside the selector would make a new object on every read and loop forever. */
export function useCompany(ticker: string): CompanyState {
  const raw = useSimStore((s) => s.snapshots[s.index].companies[ticker]);
  const override = useSimStore((s) => s.overrides[ticker]);
  return useMemo(() => (override ? { ...raw, ...override } : raw), [raw, override]);
}

/**
 * Only the fields the world draws from. Prices change every tick, but a plot
 * only re-renders when one of these does.
 */
export function useCompanyVisual(ticker: string) {
  return useSimStore(
    useShallow((s) => {
      const c = effectiveCompany(s, ticker);
      return {
        health: c.health,
        direction: c.direction,
        activity: c.activity,
        volatility: c.volatility,
        halted: c.halted,
        eventsKey: c.events.map((e) => e.id).join('|'),
        slotsKey: c.slots.map((sl) => `${sl.stage}${sl.paused ? '*' : ''}`).join('|'),
        tier: c.tier,
        expansionStage: c.expansion?.stage ?? null,
        expansionPaused: c.expansion?.paused ?? false,
      };
    }),
  );
}

export const useClock = () => useSimStore((s) => s.snapshots[s.index].clock);

/** Market state the sky and the Exchange draw from. */
export const useMarketVisual = () =>
  useSimStore(
    useShallow((s) => {
      const m = s.snapshots[s.index].market;
      return { mood: m.mood, stormy: m.stormy, activity: m.activity, breadth: Math.round(m.breadth * 6) / 6 };
    }),
  );

/** A district's state, for its landmark and street traffic. */
export const useSectorVisual = (id: string) =>
  useSimStore(
    useShallow((s) => {
      const st = s.snapshots[s.index].sectors[id];
      return { mood: st.mood, activity: st.activity, breadth: st.breadth };
    }),
  );

const OPEN_MINUTES = 9 * 60 + 30;
const MINUTES_PER_TICK = 45;

/** PSX hours, 09:30–15:30, split into 8 ticks of 45 minutes. */
export function clockTime(tick: number): string {
  const m = OPEN_MINUTES + tick * MINUTES_PER_TICK;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

if (import.meta.env.DEV) (window as unknown as { __sim: typeof useSimStore }).__sim = useSimStore;
