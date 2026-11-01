import { createContext, useContext } from 'react';
import { Color } from 'three';
import type { Activity, Direction, Volatility } from '../engine/types';

/**
 * Per-plot animation state, eased every frame toward targets derived from the
 * company's state. Animations read it in useFrame instead of the global clock,
 * so a halt freezes everything and activity speeds everything up.
 */
export interface PlotMotion {
  /** Local animation clock: advances by frame time × speed. */
  t: number;
  /** 0–1: how many agents and how fast (Activity). */
  intensity: number;
  /** Current speed multiplier (0 when halted, stutters when volatile). */
  speed: number;
  /** 0–1: how irregular things are (Volatility). */
  jitter: number;
  /** 0–1: flag height on the mast (Direction). */
  flag: number;
  halted: boolean;
  beacon: Color;
}

export const ACTIVITY_INTENSITY: Record<Activity, number> = { QUIET: 0.1, NORMAL: 0.42, BUSY: 0.72, FRENZY: 1 };
export const FLAG_HEIGHT: Record<Direction, number> = { DOWN_HARD: 0.04, DOWN: 0.27, FLAT: 0.5, UP: 0.73, UP_HARD: 0.96 };
export const JITTER: Record<Volatility, number> = { CALM: 0, CHOPPY: 0.45, WILD: 1 };
/** Warm when up, cool when down: the beacon backs up the flag so direction isn't color-only or position-only. */
export const BEACON: Record<Direction, string> = {
  DOWN_HARD: '#3d7bff',
  DOWN: '#8fbcff',
  FLAT: '#f4f1e8',
  UP: '#ffd36b',
  UP_HARD: '#ffa526',
};

export function createMotion(): PlotMotion {
  return { t: 0, intensity: 0.42, speed: 1, jitter: 0, flag: 0.5, halted: false, beacon: new Color(BEACON.FLAT) };
}

const fallback = createMotion();
export const MotionContext = createContext<PlotMotion>(fallback);
export const useMotion = () => useContext(MotionContext);

/** How many of `max` agents to show at this intensity (at least `min`). */
export const agentCount = (m: PlotMotion, max: number, min = 0) => Math.max(min, Math.round(m.intensity * max));
