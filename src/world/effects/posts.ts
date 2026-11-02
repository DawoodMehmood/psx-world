import { LOT_SIZE } from '../../config/layout';

/**
 * Where an event's poles stand (searchlights, the crash siren): just outside
 * the site pad at its corners, on the curb. Everything on a site stands inside
 * the pad, so nothing can be in the way, whatever the sector or tier.
 */

/** How far outside the pad's edge a pole stands: clear of the curb and of the pole's own base. */
export const POST_OUTSET = 0.4;
/** Radius of a searchlight base; it must not reach back across the pad's edge. */
export const POST_BASE_R = 0.22;

export type Corner = 'frontLeft' | 'frontRight' | 'backLeft' | 'backRight';

/** Corner positions in site coordinates (origin at the lot's back corner; the pad spans x 0…LOT_SIZE, z 0…depth). */
export function cornerPost(corner: Corner, depth: number): [number, number] {
  const x = corner.endsWith('Left') ? -POST_OUTSET : LOT_SIZE + POST_OUTSET;
  const z = corner.startsWith('front') ? depth - 0.3 : 0.3;
  return [x, z];
}

/** The same, relative to the centre of the site, where the effects are drawn. */
export function cornerOffset(corner: Corner, depth: number): [number, number] {
  const [x, z] = cornerPost(corner, depth);
  return [x - LOT_SIZE / 2, z - depth / 2];
}
