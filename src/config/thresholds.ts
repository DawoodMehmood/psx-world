/**
 * Starting thresholds from SPEC §6 and §12, to be tuned by eye.
 * Each dimension: ascending cut points between levels, plus a hysteresis
 * margin per cut (about 10%): a value must clear a cut by its margin to move
 * up, and fall below it by its margin to move back down.
 */
export interface LevelRule {
  cuts: number[];
  margins: number[];
}

/** % change since previous close → DOWN_HARD · DOWN · FLAT · UP · UP_HARD */
export const DIRECTION_RULE: LevelRule = { cuts: [-3, -0.75, 0.75, 3], margins: [0.3, 0.1, 0.1, 0.3] };

/** Volume ratio vs. a normal day → QUIET · NORMAL · BUSY · FRENZY */
export const ACTIVITY_RULE: LevelRule = { cuts: [0.6, 1.5, 3], margins: [0.06, 0.15, 0.3] };

/** Smoothed tick swing in % → CALM · CHOPPY · WILD */
export const VOLATILITY_RULE: LevelRule = { cuts: [0.35, 0.9], margins: [0.04, 0.09] };

/** Health score in % → STRUGGLING · WEAK · STEADY · STRONG · THRIVING */
export const HEALTH_RULE: LevelRule = { cuts: [-8, -3, 3, 8], margins: [0.8, 0.3, 0.3, 0.8] };

/** A level must hold this many ticks before it can change again. */
export const MIN_DWELL_TICKS = 2;

/** Smoothing for the swing measure (EMA weight of the newest tick). */
export const SWING_SMOOTHING = 0.5;

/** How much a company's lead over its sector median adds to its health score. */
export const SECTOR_RELATIVE_WEIGHT = 0.5;

export const EVENT_RULES = {
  /** Same event type on the same company can't repeat within this many ticks (2 days). */
  cooldownTicks: 16,
  /** Minimum magnitude for a big-move event; tiny companies don't shake the city. */
  bigMoveMinMagnitude: 0.2,
  /** % move that counts as magnitude 1 for a full-scale company. */
  bigMoveFullPct: 6,
  /** A new 20-day high/low must beat the old extreme by this %, so noise in a flat market doesn't count. */
  newExtremeMarginPct: 1,
  durations: {
    VOLUME_SPIKE: 3,
    BIG_UP: 3,
    BIG_DOWN: 3,
    NEW_HIGH: 8,
    NEW_LOW: 8,
    RESUME: 1,
    DIVIDEND: 4,
  },
} as const;

export const CONSTRUCTION_RULES = {
  /** Consecutive STRONG-or-better days before the first project starts; later ones follow the next day. */
  startAfterStrongDays: 3,
};

/** Sector and market state (SPEC §11). */
export const AGGREGATE_RULES = {
  /** Sector breadth at or beyond ± this is a rally or selloff (with 3 companies: all three). */
  sectorMoodBreadth: 0.67,
  /** Market breadth at or beyond ± this is a broad rally or selloff. */
  marketMoodBreadth: 0.5,
  /** Below this average activity index (QUIET = 0, NORMAL = 1) the market counts as quiet. */
  quietActivity: 0.6,
  /** Stormy when at least this share of companies is WILD… */
  stormyWildShare: 0.25,
  /** …or at least this share is CHOPPY or WILD. */
  stormyChoppyShare: 0.6,
  /** A new mood must hold this many ticks before it shows, like company levels. */
  moodDwellTicks: 2,
  /** Market breadth weight per company: base + scale, so big names count a little more. */
  breadthWeightBase: 0.5,
};
