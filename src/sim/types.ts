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

/** Overrides of the size rules for a demo that has to show slow growth in weeks. */
export type SizeOverrides = Partial<{
  smoothDays: number;
  dwellDays: number;
  /** Highest ÷ lowest cap over the 5-year history; narrower than real so a 30% move is a big step on the ladder. */
  rangeRatio: number;
}>;

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
  /** Compresses the slow size clock for a short demo. Leave unset to use the real rules. */
  size?: SizeOverrides;
}
