import type { LevelRule } from '../config/thresholds';

/** Level index with no history: how many cuts the value is at or above. */
export function rawLevel(value: number, rule: LevelRule): number {
  return rule.cuts.filter((c) => value >= c).length;
}

/**
 * Level index with hysteresis: from `current`, move up only past cut + margin,
 * and down only below cut − margin. Can jump several levels at once.
 */
export function classify(value: number, rule: LevelRule, current: number): number {
  const { cuts, margins } = rule;
  let idx = current;
  while (idx < cuts.length && value >= cuts[idx] + margins[idx]) idx++;
  while (idx > 0 && value < cuts[idx - 1] - margins[idx - 1]) idx--;
  return idx;
}

/** A level that also respects a minimum dwell time before changing. */
export class LevelTracker {
  private idx: number | null = null;
  private dwell = 0;

  constructor(
    private readonly rule: LevelRule,
    private readonly minDwell: number,
  ) {}

  /** Feed one value; returns the (possibly unchanged) level index. */
  update(value: number): number {
    if (this.idx === null) {
      this.idx = rawLevel(value, this.rule);
      this.dwell = 0;
      return this.idx;
    }
    this.dwell++;
    const next = classify(value, this.rule, this.idx);
    if (next !== this.idx && this.dwell >= this.minDwell) {
      this.idx = next;
      this.dwell = 0;
    }
    return this.idx;
  }

  get level(): number {
    return this.idx ?? 0;
  }
}
