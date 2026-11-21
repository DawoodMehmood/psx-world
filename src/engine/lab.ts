import { settled, siteOf, type Construction } from './construction';
import { MAX_LEVEL } from './ladder';
import type { CompanyState, EventType } from './types';

/*
 * The lab (DESIGN.md §9): pure helpers to put any company in any state on
 * purpose, so every level, build stage and effect can be looked at without
 * waiting for a scenario to reach it.
 */

export type BuildMode = 'idle' | 'up' | 'down';

/** A site state to show: `level` fully built, plus the next level being built (up) or this one wound down (down), `q` of the way through. */
export interface LabBuild {
  level: number;
  mode: BuildMode;
  q: number;
}

/** Events the lab can switch on (a halt is the separate "halted" switch). */
export const LAB_EVENTS: EventType[] = ['VOLUME_SPIKE', 'BIG_UP', 'BIG_DOWN', 'NEW_HIGH', 'NEW_LOW', 'RESUME', 'DIVIDEND'];

/** Demo override: force some of a company's levels, its site, or its events. */
export type Override = Partial<Pick<CompanyState, 'health' | 'direction' | 'activity' | 'volatility' | 'halted'>> & {
  build?: LabBuild;
  events?: EventType[];
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function labConstruction({ level, mode, q }: LabBuild): Construction {
  const L = clamp(Math.round(level), 1, MAX_LEVEL);
  if (mode === 'up' && L < MAX_LEVEL) return { done: L, project: { level: L + 1, dir: 'UP', q: clamp(q, 0, 0.99) } };
  if (mode === 'down' && L > 1) return { done: L, project: { level: L, dir: 'DOWN', q: clamp(q, 0.01, 1) } };
  return settled(L);
}

/** The site fields of a company state for a lab build. */
export function labSite(b: LabBuild) {
  const c = labConstruction(b);
  return { level: c.done, levelTarget: c.done, ...siteOf(c) };
}

/** A company state with an override applied: forced levels, a forced site and forced events. Pure. */
export function applyOverride(c: CompanyState, o: Override | undefined): CompanyState {
  if (!o) return c;
  const { build, events, ...levels } = o;
  let out: CompanyState = { ...c, ...levels };
  if (build) out = { ...out, ...labSite(build) };
  if (events) out = { ...out, events: events.map((type) => ({ id: `${c.ticker}-${type}-lab`, ticker: c.ticker, type, startIndex: 0, durationTicks: 1e9, magnitude: 0.8 })) };
  return out;
}

export interface TourStep extends LabBuild {
  label: string;
}

/** Progress points through a project, chosen so every stage of a building, an enlargement and an upgrade shows. */
const UP_STEPS = [0.1, 0.25, 0.45, 0.7, 0.9];
const DOWN_STEPS = [0.9, 0.5, 0.1];

/** Every state of the ladder in order: each level finished, then its next level going up in stages, then winding down in stages. */
export function labTour(): TourStep[] {
  const steps: TourStep[] = [];
  for (let level = 1; level <= MAX_LEVEL; level++) {
    steps.push({ level, mode: 'idle', q: 0, label: `Level ${level} finished` });
    if (level < MAX_LEVEL) for (const q of UP_STEPS) steps.push({ level, mode: 'up', q, label: `Level ${level} + building level ${level + 1}, ${Math.round(q * 100)}%` });
    if (level > 1) for (const q of DOWN_STEPS) steps.push({ level, mode: 'down', q, label: `Level ${level} winding down, ${Math.round(q * 100)}% left` });
  }
  return steps;
}
