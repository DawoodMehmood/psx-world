import { createContext, useContext } from 'react';
import { Color } from 'three';
import { ACTIVITY_INTENSITY, BEACON, FLAG_HEIGHT, JITTER } from '../engine/visual';

export { ACTIVITY_INTENSITY, BEACON, FLAG_HEIGHT, JITTER };

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

export function createMotion(): PlotMotion {
  return { t: 0, intensity: 0.42, speed: 1, jitter: 0, flag: 0.5, halted: false, beacon: new Color(BEACON.FLAT) };
}

const fallback = createMotion();
export const MotionContext = createContext<PlotMotion>(fallback);
export const useMotion = () => useContext(MotionContext);

/** How many of `max` agents to show at this intensity (at least `min`). */
export const agentCount = (m: PlotMotion, max: number, min = 0) => Math.max(min, Math.round(m.intensity * max));
