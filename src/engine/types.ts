/** Market-state types. Plain data: no Three.js or React in the engine. */

export const HEALTH = ['STRUGGLING', 'WEAK', 'STEADY', 'STRONG', 'THRIVING'] as const;
export const DIRECTION = ['DOWN_HARD', 'DOWN', 'FLAT', 'UP', 'UP_HARD'] as const;
export const ACTIVITY = ['QUIET', 'NORMAL', 'BUSY', 'FRENZY'] as const;
export const VOLATILITY = ['CALM', 'CHOPPY', 'WILD'] as const;

export type Health = (typeof HEALTH)[number];
export type Direction = (typeof DIRECTION)[number];
export type Activity = (typeof ACTIVITY)[number];
export type Volatility = (typeof VOLATILITY)[number];

export const TICKS_PER_DAY = 8;

/** One intraday observation for one company. */
export interface Observation {
  ticker: string;
  /** 1-based trading day of the scenario. */
  day: number;
  /** 0..TICKS_PER_DAY-1 */
  tick: number;
  price: number;
  /** Shares traded during this tick. */
  volume: number;
  halted?: boolean;
  /** A dividend was announced this tick. */
  dividend?: boolean;
}

/** Daily history before day 1, oldest first, so 20-day baselines work from the start. */
export interface History {
  closes: number[];
  volumes: number[];
}

export type EventType = 'VOLUME_SPIKE' | 'BIG_UP' | 'BIG_DOWN' | 'NEW_HIGH' | 'NEW_LOW' | 'HALT' | 'RESUME' | 'DIVIDEND';

export interface MarketEvent {
  id: string;
  ticker: string;
  type: EventType;
  /** Global tick index when it started. */
  startIndex: number;
  /** How long it lasts in ticks. HALT lasts until trading resumes. */
  durationTicks: number;
  /** 0–1: how big the effect should be (company scale × size of the move). */
  magnitude: number;
}

export type SlotStage = 'EMPTY' | 'STAKED' | 'FOUNDATION' | 'FRAME' | 'COMPLETE';
export const SLOT_STAGES: SlotStage[] = ['EMPTY', 'STAKED', 'FOUNDATION', 'FRAME', 'COMPLETE'];

export interface SlotState {
  stage: SlotStage;
  /** Being wound down: the crew has gone and a tarp covers the structure. */
  paused: boolean;
}

export interface CompanyState {
  ticker: string;
  price: number;
  prevClose: number;
  /** % change since the previous close. */
  dayChangePct: number;
  /** Volume so far today ÷ the volume expected by now on an average day. */
  volumeRatio: number;
  /** Smoothed size of tick-to-tick swings, in %. */
  swingPct: number;
  /** % change over the last 20 trading days. */
  return20Pct: number;
  /** Health input: return20 blended with how the company ranks in its sector. */
  healthScore: number;
  health: Health;
  direction: Direction;
  activity: Activity;
  volatility: Volatility;
  halted: boolean;
  events: MarketEvent[];
  /** Highest level fully built (DESIGN.md §4), 1–10. */
  level: number;
  /** The level the data calls for; `level` works towards it one project at a time (§5). */
  levelTarget: number;
  /** The most the company's size allows (§3.1). */
  ceiling: number;
  /** Where its smoothed cap sits in its own 5-year range, 0–1; null with too little history. */
  cycle: number | null;
  /** Site tier (1–3): how deep the site reaches into its lot. Follows the construction timeline. */
  tier: number;
  /** Expansion pads in build order; finished, under construction or being wound down (paused). */
  slots: SlotState[];
  /** The site enlargement underway, if any. */
  expansion: SlotState | null;
  /**
   * The upgrades to what already stands, in ladder order: EMPTY until done,
   * FRAME while being fitted (scaffolding up) or wound down (paused, tarped), then COMPLETE.
   */
  upgrades: SlotState[];
}

export interface Clock {
  /** Global tick index from 0. */
  index: number;
  day: number;
  tick: number;
}

export type SectorMood = 'SELLOFF' | 'MIXED' | 'RALLY';
export const MARKET_MOOD = ['BROAD_SELLOFF', 'QUIET', 'NORMAL', 'BROAD_RALLY'] as const;
export type MarketMood = (typeof MARKET_MOOD)[number];

/** A district's state, from its companies' states (SPEC §11). */
export interface SectorState {
  id: string;
  /** Share of companies UP or better minus share DOWN or worse: −1…+1. */
  breadth: number;
  /** Average activity level of its companies. */
  activity: Activity;
  /** RALLY or SELLOFF only when breadth is near ±1: one star company can't light up the district. */
  mood: SectorMood;
}

/** The whole market's state (SPEC §11). */
export interface MarketState {
  /** Breadth across every company, lightly weighted by scale: −1…+1. */
  breadth: number;
  activity: Activity;
  mood: MarketMood;
  /** Volatility is high across many companies: rain over the city. */
  stormy: boolean;
}

export interface Snapshot {
  clock: Clock;
  companies: Record<string, CompanyState>;
  sectors: Record<string, SectorState>;
  market: MarketState;
}
