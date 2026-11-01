import { HEALTH, type Activity, type CompanyState, type Direction, type Volatility } from './types';

/*
 * The boundary between the engine and the renderer (DESIGN.md §9): one pure
 * function turns a company's state into plain visual targets, and the lookup
 * tables behind it live here so they can be tested without Three or React.
 */

/** 0–1: how many agents and how fast (Activity). */
export const ACTIVITY_INTENSITY: Record<Activity, number> = { QUIET: 0.1, NORMAL: 0.42, BUSY: 0.72, FRENZY: 1 };
/**
 * −1…+1: the light pool on a plot (Direction, DESIGN.md §6). Positive is a sunlit
 * patch, negative a cloud shadow; flat is plain daylight. Light against shade
 * reads at any zoom and does not rely on telling red from green.
 */
export const POOL: Record<Direction, number> = { DOWN_HARD: -1, DOWN: -0.5, FLAT: 0, UP: 0.5, UP_HARD: 1 };
/** 0–1: how irregular things are (Volatility). */
export const JITTER: Record<Volatility, number> = { CALM: 0, CHOPPY: 0.45, WILD: 1 };

/** Speed multiplier of everything that moves on a plot: strolling when calm, running when wild (Frantic, DESIGN.md §3.5). */
export const pace = (jitter: number) => 1 + jitter * 0.9;

/** Brightness 0–1 of a district's lamps and the Exchange's dome light from breadth −1…+1: lit when the sector is up, dim when down. */
export const glowFor = (breadth: number) => 0.15 + 0.85 * Math.max(0, Math.min(1, (breadth + 1) / 2));

/** Share of the full crew on site at each health level (STRUGGLING … THRIVING). */
export const CREW = [0.35, 0.6, 1, 1, 1];

/** How many of `built` units (oldest first) still run: WEAK idles the newest, STRUGGLING keeps only the first. */
export function runningCount(h: number, built: number): number {
  return h >= 2 ? built : h === 1 ? Math.max(1, built - 1) : 1;
}

/** Vehicles on the move: Health sets how many bays are open, Activity fills them (DESIGN.md §6). One waits parked when quiet. */
export const movingVehicles = (intensity: number, openBays: number) => (intensity < 0.3 ? 0 : Math.max(1, Math.round(intensity * openBays)));

/** People on a plot at most: the site's full crew scaled by health, then by activity. */
export const crewMax = (base: number, healthIndex: number) => Math.round(base * CREW[healthIndex]);

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
  /** −1…+1 target light pool: sunlit or shaded. */
  pool: number;
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
    pool: POOL[c.direction],
    healthIndex,
    crew: CREW[healthIndex],
  };
}
