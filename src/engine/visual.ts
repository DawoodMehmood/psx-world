import { HEALTH, type Activity, type CompanyState, type Direction, type Volatility } from './types';

/*
 * The boundary between the engine and the renderer (DESIGN.md §9): one pure
 * function turns a company's state into plain visual targets, and the lookup
 * tables behind it live here so they can be tested without Three or React.
 */

/** 0–1: how many agents and how fast (Activity). */
export const ACTIVITY_INTENSITY: Record<Activity, number> = { QUIET: 0.1, NORMAL: 0.42, BUSY: 0.72, FRENZY: 1 };
/** 0–1: flag height on the mast (Direction). */
export const FLAG_HEIGHT: Record<Direction, number> = { DOWN_HARD: 0.04, DOWN: 0.27, FLAT: 0.5, UP: 0.73, UP_HARD: 0.96 };
/** 0–1: how irregular things are (Volatility). */
export const JITTER: Record<Volatility, number> = { CALM: 0, CHOPPY: 0.45, WILD: 1 };
/** Warm when up, cool when down: the beacon backs up the flag so direction isn't color-only or position-only. */
export const BEACON: Record<Direction, string> = {
  DOWN_HARD: '#3d7bff',
  DOWN: '#8fbcff',
  FLAT: '#f4f1e8',
  UP: '#ffd36b',
  UP_HARD: '#ffa526',
};

/** Share of the full crew on site at each health level (STRUGGLING … THRIVING). */
export const CREW = [0.35, 0.6, 1, 1, 1];

/** How many of `built` units (oldest first) still run: WEAK idles the newest, STRUGGLING keeps only the first. */
export function runningCount(h: number, built: number): number {
  return h >= 2 ? built : h === 1 ? Math.max(1, built - 1) : 1;
}

/** How many of `total` bays stay open (from the front); the rest are coned off. */
export function openBayCount(h: number, total: number): number {
  return h >= 2 ? total : h === 1 ? Math.max(2, Math.ceil(total * 0.6)) : Math.max(1, Math.ceil(total / 3));
}

/** Everything the world draws from a company, as plain values (all primitives, so it is cheap to compare). */
export interface CompanyVisual {
  halted: boolean;
  /** 0–1 target for people, vehicles and machine speed. */
  intensity: number;
  /** 0–1 target for irregular motion. */
  jitter: number;
  /** 0–1 target flag height. */
  flag: number;
  /** Target beacon color. */
  beacon: string;
  /** Index into HEALTH, 0 = STRUGGLING. */
  healthIndex: number;
  /** Share of the full crew on site. */
  crew: number;
}

export function companyVisual(c: Pick<CompanyState, 'halted' | 'activity' | 'volatility' | 'direction' | 'health'>): CompanyVisual {
  const healthIndex = HEALTH.indexOf(c.health);
  return {
    halted: c.halted,
    intensity: ACTIVITY_INTENSITY[c.activity],
    jitter: JITTER[c.volatility],
    flag: FLAG_HEIGHT[c.direction],
    beacon: BEACON[c.direction],
    healthIndex,
    crew: CREW[healthIndex],
  };
}
