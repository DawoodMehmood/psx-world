import { describe, expect, it } from 'vitest';
import { ACTIVITY, DIRECTION, HEALTH, VOLATILITY } from '../src/engine/types';
import { companyVisual, crewMax, glowFor, movingVehicles, openBayCount, pace, runningCount } from '../src/engine/visual';

const base = { halted: false, activity: 'NORMAL', volatility: 'CALM', direction: 'FLAT', health: 'STEADY' } as const;

describe('companyVisual', () => {
  it('maps each activity level to a rising intensity', () => {
    const xs = ACTIVITY.map((activity) => companyVisual({ ...base, activity }).intensity);
    expect(xs).toEqual([0.1, 0.42, 0.72, 1]);
  });

  it('maps direction to a light pool: shade when down, none when flat, sun when up', () => {
    expect(DIRECTION.map((direction) => companyVisual({ ...base, direction }).pool)).toEqual([-1, -0.5, 0, 0.5, 1]);
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

describe('movement and composition', () => {
  it('runs faster the more frantic the price', () => {
    expect(pace(0)).toBe(1);
    expect(pace(0.45)).toBeGreaterThan(pace(0));
    expect(pace(1)).toBeGreaterThan(pace(0.45));
  });

  it('fills open bays with vehicles: none when quiet, never more than are open, at least one once busy', () => {
    expect(movingVehicles(0.1, 5)).toBe(0);
    expect(movingVehicles(0.42, 5)).toBe(2);
    expect(movingVehicles(1, 5)).toBe(5);
    expect(movingVehicles(1, 2)).toBe(2);
    expect(movingVehicles(0.4, 1)).toBe(1);
  });

  it('caps the crew by health before activity fills it', () => {
    expect(crewMax(10, 4)).toBe(10);
    expect(crewMax(10, 1)).toBe(6);
    expect(crewMax(10, 0)).toBe(4);
  });

  it('lets a weak company’s busy day fill fewer bays than a healthy one’s', () => {
    const busy = 1;
    expect(movingVehicles(busy, openBayCount(0, 7))).toBeLessThan(movingVehicles(busy, openBayCount(3, 7)));
  });

  it('lights lamps and the Exchange dome more as breadth rises, and never goes fully dark', () => {
    expect(glowFor(-1)).toBeCloseTo(0.15, 10);
    expect(glowFor(0)).toBeGreaterThan(glowFor(-1));
    expect(glowFor(1)).toBeCloseTo(1, 10);
    expect(glowFor(-3)).toBeCloseTo(0.15, 10);
    expect(glowFor(3)).toBeCloseTo(1, 10);
  });
});
