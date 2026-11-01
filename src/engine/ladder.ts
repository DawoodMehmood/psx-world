/*
 * The level ladder (DESIGN.md §4). Every archetype follows the same shape:
 * level 1 is the core site, then nine growth steps. A step is either a new
 * building (built on the next expansion pad) or an upgrade to something
 * already standing. Two steps also enlarge the site.
 */

export type LevelKind = 'CORE' | 'BUILDING' | 'UPGRADE';

/** Kind of each level, index 0 = level 1. */
export const LEVEL_KINDS: LevelKind[] = ['CORE', 'BUILDING', 'UPGRADE', 'BUILDING', 'BUILDING', 'UPGRADE', 'BUILDING', 'BUILDING', 'BUILDING', 'UPGRADE'];

/** Levels whose project starts by enlarging the site: to the 10-row site, then the whole lot. */
export const FOOTPRINT_LEVELS = [4, 7];

export const MAX_LEVEL = LEVEL_KINDS.length;

/** Expansion pads in the site designs: one per BUILDING level. */
export const SLOT_COUNT = LEVEL_KINDS.filter((k) => k === 'BUILDING').length;

export const kindOf = (level: number): LevelKind => LEVEL_KINDS[level - 1];

/** Site tier (1–3) of a finished site at this level. */
export const footprintTier = (level: number): number => 1 + FOOTPRINT_LEVELS.filter((l) => l <= level).length;

/** Expansion pads that are built once this level is done. */
export const slotsBuilt = (level: number): number => LEVEL_KINDS.slice(0, level).filter((k) => k === 'BUILDING').length;

/** The pad a BUILDING level builds on. */
export const slotIndex = (level: number): number => slotsBuilt(level) - 1;

/** Levels that upgrade something already standing, in order (0 = the first upgrade). */
export const UPGRADE_LEVELS = LEVEL_KINDS.flatMap((k, i) => (k === 'UPGRADE' ? [i + 1] : []));

export const upgradeIndex = (level: number): number => UPGRADE_LEVELS.indexOf(level);
