import type { Archetype } from '../../config/companies';
import { LOT_SIZE } from '../../config/layout';
import { bankFootprints, oilFootprints, techFootprints, type Rect } from '../buildings/siteFootprints';
import { cementFootprints } from '../buildings/sitePlan';

/**
 * Where an event's poles stand (two searchlights, the crash siren): on the
 * very corners of the site pad, just inside its curb, whenever a corner is free.
 * Every site's footprints are known (a test checks all four sectors at every
 * tier), so where a part occupies a corner the pole takes the nearest free spot
 * along the pad's edge instead. It is never out on the street, where the cars are.
 */

/** How far inside the pad's edge a pole stands: clear of the curb and of the pole's own base. */
export const POST_INSET = 0.5;
/** Radius of a searchlight base. */
export const POST_BASE_R = 0.22;
/** A pole must keep this far from every part (its base radius plus a little air). */
export const POST_CLEARANCE = POST_BASE_R + 0.08;

export type Corner = 'frontLeft' | 'frontRight' | 'backLeft' | 'backRight';
export type Spot = [number, number];

/** Corner positions in site coordinates (origin at the lot's back corner; the pad spans x 0…LOT_SIZE, z 0…depth). */
export function cornerPost(corner: Corner, depth: number): Spot {
  const x = corner.endsWith('Left') ? POST_INSET : LOT_SIZE - POST_INSET;
  const z = corner.startsWith('front') ? depth - POST_INSET : POST_INSET;
  return [x, z];
}

/** The same, relative to the centre of the site, where the effects are drawn. */
export function cornerOffset(corner: Corner, depth: number): Spot {
  return postOffset(cornerPost(corner, depth), depth);
}

/** Any site position, relative to the centre of the site. */
export const postOffset = ([x, z]: Spot, depth: number): Spot => [x - LOT_SIZE / 2, z - depth / 2];

const FOOTPRINTS: Record<Archetype, () => Rect[]> = { cement: cementFootprints, bank: bankFootprints, oil: oilFootprints, tech: techFootprints };

/** Whether a pole at `spot` keeps clear of every part that exists at this depth. */
export function spotIsFree(archetype: Archetype, depth: number, [x, z]: Spot): boolean {
  return FOOTPRINTS[archetype]()
    .filter((r) => r.minZ <= depth)
    .every((r) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ)) >= POST_CLEARANCE);
}

export interface EventPosts {
  lightA: Spot;
  lightB: Spot;
  siren: Spot;
}

/**
 * The two searchlights prefer opposite corners (front-left and back-right) and the siren the back-left corner.
 * If a corner is taken, the pole stands at the free spot on the pad's edge nearest to it, at least 2 from the others.
 */
export function eventPosts(archetype: Archetype, depth: number): EventPosts {
  const edge: Spot[] = [];
  for (let x = POST_INSET; x <= LOT_SIZE - POST_INSET + 1e-9; x += 0.5) edge.push([x, POST_INSET], [x, depth - POST_INSET]);
  for (let z = POST_INSET; z <= depth - POST_INSET + 1e-9; z += 0.5) edge.push([POST_INSET, z], [LOT_SIZE - POST_INSET, z]);
  const taken: Spot[] = [];
  const pick = (corner: Corner): Spot => {
    const want = cornerPost(corner, depth);
    const ok = (s: Spot) => spotIsFree(archetype, depth, s) && taken.every((t) => Math.hypot(t[0] - s[0], t[1] - s[1]) >= 2);
    const best = ok(want) ? want : [...edge].filter(ok).sort((a, b) => Math.hypot(a[0] - want[0], a[1] - want[1]) - Math.hypot(b[0] - want[0], b[1] - want[1]))[0];
    if (!best) throw new Error(`no free pole spot for ${archetype} at depth ${depth}`);
    taken.push(best);
    return best;
  };
  const lightA = pick('frontLeft');
  const lightB = pick('backRight');
  const siren = pick('backLeft');
  return { lightA, lightB, siren };
}
