import { describe, expect, it } from 'vitest';
import { ACTIVITY, DIRECTION, HEALTH, VOLATILITY } from '../src/engine/types';
import { companyVisual, openBayCount, runningCount } from '../src/engine/visual';

const base = { halted: false, activity: 'NORMAL', volatility: 'CALM', direction: 'FLAT', health: 'STEADY' } as const;

describe('companyVisual', () => {
  it('maps each activity level to a rising intensity', () => {
    const xs = ACTIVITY.map((activity) => companyVisual({ ...base, activity }).intensity);
    expect(xs).toEqual([0.1, 0.42, 0.72, 1]);
  });

  it('maps direction to a flag height that rises with the move and a distinct beacon', () => {
    const vs = DIRECTION.map((direction) => companyVisual({ ...base, direction }));
    expect(vs.map((v) => v.flag)).toEqual([0.04, 0.27, 0.5, 0.73, 0.96]);
    expect(new Set(vs.map((v) => v.beacon)).size).toBe(DIRECTION.length);
  });

  it('maps volatility to jitter', () => {
    expect(VOLATILITY.map((volatility) => companyVisual({ ...base, volatility }).jitter)).toEqual([0, 0.45, 1]);
  });

  it('cuts the crew only when health is below steady', () => {
    expect(HEALTH.map((health) => companyVisual({ ...base, health }).crew)).toEqual([0.35, 0.6, 1, 1, 1]);
  });

  it('carries the halt flag and health index through', () => {
    const v = companyVisual({ ...base, halted: true, health: 'THRIVING' });
    expect(v.halted).toBe(true);
    expect(v.healthIndex).toBe(4);
  });

  it('is deterministic: the same state gives the same visual', () => {
    expect(companyVisual({ ...base, activity: 'BUSY', direction: 'UP' })).toEqual(companyVisual({ ...base, activity: 'BUSY', direction: 'UP' }));
  });
});

describe('decline rules', () => {
  it('keeps every unit running at steady and above', () => {
    for (const h of [2, 3, 4]) expect(runningCount(h, 4)).toBe(4);
  });

  it('idles the newest unit when weak and keeps only the first when struggling', () => {
    expect(runningCount(1, 4)).toBe(3);
    expect(runningCount(1, 1)).toBe(1);
    expect(runningCount(0, 4)).toBe(1);
  });

  it('closes bays from the back as health falls, never all of them', () => {
    expect(openBayCount(2, 7)).toBe(7);
    expect(openBayCount(1, 7)).toBe(5);
    expect(openBayCount(0, 7)).toBe(3);
    expect(openBayCount(0, 1)).toBe(1);
    expect(openBayCount(1, 3)).toBe(2);
  });
});
