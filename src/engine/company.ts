import {
  ACTIVITY_RULE,
  CONSTRUCTION_RULES,
  DIRECTION_RULE,
  EVENT_RULES,
  HEALTH_RULE,
  MIN_DWELL_TICKS,
  SWING_SMOOTHING,
  VOLATILITY_RULE,
} from '../config/thresholds';
import { classify, LevelTracker, rawLevel } from './levels';
import {
  ACTIVITY,
  DIRECTION,
  HEALTH,
  SLOT_STAGES,
  TICKS_PER_DAY,
  VOLATILITY,
  type CompanyState,
  type EventType,
  type History,
  type MarketEvent,
  type Observation,
  type SlotState,
} from './types';

/** What the engine needs to know about a company. */
export interface EngineCompany {
  ticker: string;
  sectorId: string;
  /** 0–1 relative size; scales event magnitude. */
  scale: number;
  /** Site tier on day 1. */
  startTier: number;
  /** Expansion slots each tier adds; its length is the number of tiers. */
  slotsPerTier: number[];
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
  private tier: number;
  private slots: SlotState[];
  private expansion: SlotState | null = null;
  private strongStreak = 0;

  constructor(
    readonly company: EngineCompany,
    history: History,
  ) {
    this.closes = [...history.closes];
    this.volumes = [...history.volumes];
    this.prevClose = this.closes[this.closes.length - 1];
    this.price = this.prevClose;
    this.tier = company.startTier;
    // Starting on a bigger site means everything on the smaller tiers is already built.
    const builtAlready = sum(company.slotsPerTier.slice(0, this.tier - 1));
    this.slots = Array.from({ length: sum(company.slotsPerTier) }, (_, i) => ({ stage: i < builtAlready ? 'COMPLETE' : 'EMPTY', paused: false }));
  }

  get ticker() {
    return this.company.ticker;
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

  /**
   * One project at a time (SPEC §8): the current tier's slots in order, then a
   * site expansion to the next tier. The first project waits for a run of
   * strong days; later ones follow the next day while health stays strong.
   */
  advanceConstruction(): void {
    const strong = (this.healthIdx ?? 0) >= HEALTH.indexOf('STRONG');
    this.strongStreak = strong ? this.strongStreak + 1 : 0;
    const project = this.currentProject();
    if (!project) return;
    if (project.stage === 'EMPTY') {
      if (this.strongStreak >= CONSTRUCTION_RULES.startAfterStrongDays) project.stage = 'STAKED';
      return;
    }
    if (!strong) {
      project.paused = true;
      return;
    }
    project.paused = false;
    project.stage = SLOT_STAGES[SLOT_STAGES.indexOf(project.stage) + 1];
    if (project === this.expansion && project.stage === 'COMPLETE') {
      this.tier++;
      this.expansion = null;
    }
  }

  private currentProject(): SlotState | null {
    const unlocked = sum(this.company.slotsPerTier.slice(0, this.tier));
    const slot = this.slots.slice(0, unlocked).find((s) => s.stage !== 'COMPLETE');
    if (slot) return slot;
    if (this.tier >= this.company.slotsPerTier.length) return null;
    this.expansion ??= { stage: 'EMPTY', paused: false };
    return this.expansion;
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
      tier: this.tier,
      slots: this.slots.map((s) => ({ ...s })),
      expansion: this.expansion && this.expansion.stage !== 'EMPTY' ? { ...this.expansion } : null,
    };
  }
}
