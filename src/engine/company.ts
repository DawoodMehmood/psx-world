import {
  ACTIVITY_RULE,
  DIRECTION_RULE,
  EVENT_RULES,
  HEALTH_RULE,
  MIN_DWELL_TICKS,
  SWING_SMOOTHING,
  VOLATILITY_RULE,
} from '../config/thresholds';
import { settled, siteOf, stepConstruction, type Construction } from './construction';
import { classify, LevelTracker, rawLevel } from './levels';
import {
  ACTIVITY,
  DIRECTION,
  HEALTH,
  TICKS_PER_DAY,
  VOLATILITY,
  type CompanyState,
  type EventType,
  type History,
  type MarketEvent,
  type Observation,
} from './types';

/** What the engine needs to know about a company. */
export interface EngineCompany {
  ticker: string;
  sectorId: string;
  /** 0–1 relative size; scales event magnitude. */
  scale: number;
  /** Shares in issue, for market cap. */
  sharesOutstanding: number;
  /** Smallest and largest cap in the whole listed sector, same unit as the cap history. */
  sectorCapRange: { low: number; high: number };
}

const WINDOW = 20;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => sum(xs) / Math.max(1, xs.length);

/**
 * Turns one company's stream of observations into its state. Per tick it
 * updates direction, activity, volatility and events; at the end of each day
 * the market runner calls `endOfDay` to update health and construction.
 */
export class CompanyTracker {
  private closes: number[];
  private volumes: number[];
  private prevClose: number;
  private price: number;
  private dayVolume = 0;
  private swing = 0;
  private halted = false;
  private haltEvent: MarketEvent | null = null;

  private direction = new LevelTracker(DIRECTION_RULE, MIN_DWELL_TICKS);
  private activity = new LevelTracker(ACTIVITY_RULE, MIN_DWELL_TICKS);
  private volatility = new LevelTracker(VOLATILITY_RULE, MIN_DWELL_TICKS);
  private healthIdx: number | null = null;
  private healthScore = 0;

  private events: MarketEvent[] = [];
  private lastFired = new Map<EventType, number>();
  private construction: Construction;
  private size = { levelTarget: 1, ceiling: 1, cycle: null as number | null };

  constructor(
    readonly company: EngineCompany,
    history: History,
  ) {
    this.closes = [...history.closes];
    this.volumes = [...history.volumes];
    this.prevClose = this.closes[this.closes.length - 1];
    this.price = this.prevClose;
    this.construction = settled(1);
  }

  get ticker() {
    return this.company.ticker;
  }

  /** The latest price: after `closeDay`, the day's close. */
  get lastPrice() {
    return this.price;
  }

  /** % change over the last 20 closes (including today's once the day is done). */
  get return20Pct(): number {
    const n = this.closes.length;
    const base = this.closes[Math.max(0, n - 1 - WINDOW)];
    return (this.closes[n - 1] / base - 1) * 100;
  }

  observe(obs: Observation, index: number): void {
    const wasHalted = this.halted;
    this.halted = !!obs.halted;
    if (this.halted && !wasHalted) {
      this.haltEvent = this.fire('HALT', index, 0.6, Number.MAX_SAFE_INTEGER, true);
    }
    if (!this.halted && wasHalted && this.haltEvent) {
      this.haltEvent.durationTicks = index - this.haltEvent.startIndex;
      this.haltEvent = null;
      this.fire('RESUME', index, 0.5, EVENT_RULES.durations.RESUME, true);
    }
    if (obs.dividend) this.fire('DIVIDEND', index, clamp01(0.4 + this.company.scale * 0.6), EVENT_RULES.durations.DIVIDEND);

    if (obs.tick === 0) {
      this.dayVolume = 0;
      this.prevClose = this.closes[this.closes.length - 1];
    }
    const last = this.price;
    this.price = obs.price;
    this.dayVolume += obs.volume;
    // A halted market freezes the read-outs: nothing traded, so nothing to interpret.
    if (this.halted) return;

    const tickPct = Math.abs(obs.price / last - 1) * 100;
    this.swing = obs.tick === 0 && this.swing === 0 ? tickPct : SWING_SMOOTHING * tickPct + (1 - SWING_SMOOTHING) * this.swing;

    const before = { dir: this.direction.level, act: this.activity.level };
    const dir = this.direction.update(this.dayChangePct);
    const act = this.activity.update(this.volumeRatio(obs.tick));
    this.volatility.update(this.swing);

    if (act === ACTIVITY.indexOf('FRENZY') && before.act < act) {
      this.fire('VOLUME_SPIKE', index, clamp01(this.company.scale * (this.volumeRatio(obs.tick) / 5)), EVENT_RULES.durations.VOLUME_SPIKE);
    }
    const moveMag = clamp01((this.company.scale * Math.abs(this.dayChangePct)) / EVENT_RULES.bigMoveFullPct);
    if (moveMag >= EVENT_RULES.bigMoveMinMagnitude) {
      if (dir === DIRECTION.indexOf('UP_HARD') && before.dir < dir) this.fire('BIG_UP', index, moveMag, EVENT_RULES.durations.BIG_UP);
      if (dir === DIRECTION.indexOf('DOWN_HARD') && before.dir > dir) this.fire('BIG_DOWN', index, moveMag, EVENT_RULES.durations.BIG_DOWN);
    }
  }

  /** Close the day: record the close, fire new-high/low, update health and construction. */
  closeDay(index: number): void {
    const prior = this.closes.slice(-WINDOW);
    this.closes.push(this.price);
    this.volumes.push(this.dayVolume);
    const m = EVENT_RULES.newExtremeMarginPct / 100;
    if (this.price > Math.max(...prior) * (1 + m)) this.fire('NEW_HIGH', index, clamp01(0.3 + this.company.scale * 0.5), EVENT_RULES.durations.NEW_HIGH);
    if (this.price < Math.min(...prior) * (1 - m)) this.fire('NEW_LOW', index, clamp01(0.3 + this.company.scale * 0.5), EVENT_RULES.durations.NEW_LOW);
  }

  /** Health uses a score that needs the whole sector, so the runner computes it. */
  setHealth(score: number): void {
    this.healthScore = score;
    this.healthIdx = this.healthIdx === null ? rawLevel(score, HEALTH_RULE) : classify(score, HEALTH_RULE, this.healthIdx);
  }

  /** Start from a finished site at the level the data calls for on day 0. */
  startAt(size: { levelTarget: number; ceiling: number; cycle: number | null }): void {
    this.size = size;
    this.construction = settled(size.levelTarget);
  }

  /** End of day: take the level the data calls for and work one day towards it (DESIGN.md §5). */
  advanceConstruction(size: { levelTarget: number; ceiling: number; cycle: number | null }): void {
    this.size = size;
    this.construction = stepConstruction(this.construction, size.levelTarget);
  }

  get dayChangePct(): number {
    return (this.price / this.prevClose - 1) * 100;
  }

  private volumeRatio(tick: number): number {
    const expected = (avg(this.volumes.slice(-WINDOW)) * (tick + 1)) / TICKS_PER_DAY;
    return expected > 0 ? this.dayVolume / expected : 1;
  }

  private fire(type: EventType, index: number, magnitude: number, durationTicks: number, ignoreCooldown = false): MarketEvent | null {
    const last = this.lastFired.get(type);
    if (!ignoreCooldown && last !== undefined && index - last < EVENT_RULES.cooldownTicks) return null;
    this.lastFired.set(type, index);
    const event: MarketEvent = { id: `${this.ticker}-${type}-${index}`, ticker: this.ticker, type, startIndex: index, durationTicks, magnitude };
    this.events.push(event);
    return event;
  }

  snapshot(index: number, tick: number): CompanyState {
    this.events = this.events.filter((e) => e.startIndex + e.durationTicks > index);
    return {
      ticker: this.ticker,
      price: this.price,
      prevClose: this.prevClose,
      dayChangePct: this.dayChangePct,
      volumeRatio: this.volumeRatio(tick),
      swingPct: this.swing,
      return20Pct: this.return20Pct,
      healthScore: this.healthScore,
      health: HEALTH[this.healthIdx ?? 2],
      direction: DIRECTION[this.direction.level],
      activity: ACTIVITY[this.activity.level],
      volatility: VOLATILITY[this.volatility.level],
      halted: this.halted,
      events: this.events.filter((e) => e.startIndex <= index).map((e) => ({ ...e })),
      level: this.construction.done,
      levelTarget: this.size.levelTarget,
      ceiling: this.size.ceiling,
      cycle: this.size.cycle,
      ...siteOf(this.construction),
    };
  }
}
