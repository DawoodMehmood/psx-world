import { LOT_SIZE } from '../../config/layout';

/**
 * Where an event's poles stand (searchlights, the crash siren): on the very
 * corners of the site pad, just inside its curb. Every site design keeps these
 * four corner cells free (a test checks it), so a pole is never in the way and
 * never out on the street, where the cars are.
 */

/** How far inside the pad's edge a pole stands: clear of the curb and of the pole's own base. */
export const POST_INSET = 0.5;
/** Radius of a searchlight base. */
export const POST_BASE_R = 0.22;

export type Corner = 'frontLeft' | 'frontRight' | 'backLeft' | 'backRight';

/** Corner positions in site coordinates (origin at the lot's back corner; the pad spans x 0…LOT_SIZE, z 0…depth). */
export function cornerPost(corner: Corner, depth: number): [number, number] {
  const x = corner.endsWith('Left') ? POST_INSET : LOT_SIZE - POST_INSET;
  const z = corner.startsWith('front') ? depth - POST_INSET : POST_INSET;
  return [x, z];
}

/** The same, relative to the centre of the site, where the effects are drawn. */
export function cornerOffset(corner: Corner, depth: number): [number, number] {
  const [x, z] = cornerPost(corner, depth);
  return [x - LOT_SIZE / 2, z - depth / 2];
}
