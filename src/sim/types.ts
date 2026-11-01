/** How one company should behave on one scenario day. Everything is optional. */
export interface DayPlan {
  /** Target % change over the day. */
  drift?: number;
  /** % jump at the open (first tick), on top of drift: a gap up or down. */
  gap?: number;
  /** Volume multiplier vs. a normal day. */
  volume?: number;
  /** Tick-to-tick noise in % (default 0.15). Raise it for a wild day. */
  noise?: number;
  /** Swing up and down by this % every tick, netting out flat: a wild day with no direction. */
  zigzag?: number;
  /** Halted from this tick to that tick, inclusive. */
  halt?: [number, number];
  /** Tick on which a dividend is announced. */
  dividendTick?: number;
}

export interface Scenario {
  id: string;
  name: string;
  seed: number;
  days: number;
  /** The company the scenario is about, selected when it loads. */
  focus?: string;
  /** One-line caption per day: what to watch for. */
  notes: Record<number, string>;
  plan: (ticker: string, day: number) => DayPlan | undefined;
}
