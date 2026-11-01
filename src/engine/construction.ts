import { FOOTPRINT_LEVELS, footprintTier, kindOf, SLOT_COUNT, slotIndex, slotsBuilt, UPGRADE_LEVELS, upgradeIndex } from './ladder';
import type { SlotStage, SlotState } from './types';

/*
 * Construction as a function of the data (DESIGN.md §5). The built level is a
 * target; what is on screen is a timeline that works towards it, one project
 * at a time, one level a step. Replaying the target series over a fixed
 * window from a settled start gives every viewer the same stage.
 */

/** Trading days a level's project takes. */
export const BUILD_DAYS = {
  UP: { BUILDING: 5, UPGRADE: 3, FOOTPRINT: 2 },
  DOWN: { BUILDING: 3, UPGRADE: 2, FOOTPRINT: 1 },
};

export interface Project {
  level: number;
  dir: 'UP' | 'DOWN';
  /** How complete the level is, 0–1, whichever way the project is going. A new project starts at 0 (up) or 1 (down). */
  q: number;
}

export interface Construction {
  /** Highest level fully built. */
  done: number;
  project: Project | null;
}

const days = (level: number, dir: Project['dir']) => {
  const d = BUILD_DAYS[dir];
  const item = kindOf(level) === 'UPGRADE' ? d.UPGRADE : d.BUILDING;
  return item + (FOOTPRINT_LEVELS.includes(level) ? d.FOOTPRINT : 0);
};

/** Share of a project's timeline spent enlarging the site first (zero for levels that don't). */
const footprintShare = (level: number) => (FOOTPRINT_LEVELS.includes(level) ? BUILD_DAYS.UP.FOOTPRINT / (BUILD_DAYS.UP.FOOTPRINT + BUILD_DAYS.UP.BUILDING) : 0);

const EPS = 1e-9;

export const settled = (level: number): Construction => ({ done: level, project: null });

/** One end-of-day step towards `target`. */
export function stepConstruction(state: Construction, target: number): Construction {
  let { done, project } = state;
  if (project) {
    // The data turned round mid-project: carry on the other way from the same point.
    if (project.dir === 'UP' && target < project.level) project = { ...project, dir: 'DOWN' };
    else if (project.dir === 'DOWN' && target >= project.level) project = { ...project, dir: 'UP' };
    const q = project.q + (project.dir === 'UP' ? 1 : -1) / days(project.level, project.dir);
    if (project.dir === 'UP' && q >= 1 - EPS) {
      done = project.level;
      project = null;
    } else if (project.dir === 'DOWN' && q <= EPS) {
      done = project.level - 1;
      project = null;
    } else project = { ...project, q };
    if (project) return { done, project };
  }
  // Nothing underway: start the next level the day the data calls for it, shown at its first stage.
  if (target > done) return { done, project: { level: done + 1, dir: 'UP', q: 0 } };
  if (target < done) return { done, project: { level: done, dir: 'DOWN', q: 1 } };
  return { done, project: null };
}

/** The construction after the last of `targets` (one per day), assuming it started settled at the first. */
export function replayConstruction(targets: number[]): Construction {
  let state = settled(targets[0]);
  for (let i = 1; i < targets.length; i++) state = stepConstruction(state, targets[i]);
  return state;
}

/** Stage of a building on its pad at completion fraction `q`. */
function buildingStage(q: number, dir: Project['dir']): SlotStage {
  if (dir === 'DOWN' && q <= EPS) return 'EMPTY';
  if (q >= 1 - EPS) return dir === 'DOWN' ? 'FRAME' : 'COMPLETE';
  if (q >= 0.6 - EPS) return 'FRAME';
  if (q >= 0.2 - EPS) return 'FOUNDATION';
  return 'STAKED';
}

export interface Site {
  /** Site tier (1–3): how deep the site reaches into its lot. */
  tier: number;
  /** Every expansion pad, in build order. */
  slots: SlotState[];
  /** The site enlargement underway, if any. */
  expansion: SlotState | null;
  /** The upgrades: finished, being fitted, or being wound down. */
  upgrades: SlotState[];
}

/** The site's visible state: finished pads and upgrades, the one being worked on, and the tier. Wind-downs show paused (tarped). */
export function siteOf({ done, project }: Construction): Site {
  const built = slotsBuilt(done);
  const slots: SlotState[] = Array.from({ length: SLOT_COUNT }, (_, i) => ({ stage: i < built ? 'COMPLETE' : 'EMPTY', paused: false }));
  let tier = footprintTier(done);
  let expansion: SlotState | null = null;
  if (project && kindOf(project.level) !== 'UPGRADE') {
    const down = project.dir === 'DOWN';
    const e = footprintShare(project.level);
    const itemQ = e > 0 ? Math.max(0, Math.min(1, (project.q - e) / (1 - e))) : project.q;
    const itemStarted = e === 0 || project.q >= e - EPS;
    if (kindOf(project.level) === 'BUILDING') {
      const i = slotIndex(project.level);
      slots[i] = { stage: itemStarted ? buildingStage(itemQ, project.dir) : 'EMPTY', paused: down };
    }
    if (e > 0) {
      const enlarged = footprintTier(project.level);
      if (project.q >= e - EPS) tier = enlarged;
      else {
        tier = enlarged - 1;
        if (!down) expansion = { stage: project.q / e < 0.5 - EPS ? 'STAKED' : 'FOUNDATION', paused: false };
      }
    }
  }
  const upgrades: SlotState[] = UPGRADE_LEVELS.map((level) => ({ stage: done >= level ? 'COMPLETE' : 'EMPTY', paused: false }));
  if (project && kindOf(project.level) === 'UPGRADE') upgrades[upgradeIndex(project.level)] = { stage: 'FRAME', paused: project.dir === 'DOWN' };
  return { tier, slots, expansion, upgrades };
}
