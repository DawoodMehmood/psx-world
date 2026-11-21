/**
 * The shadow camera only needs to cover what is on screen, plus a margin for
 * tall things just outside it whose shadows fall in. With the whole island
 * under one fixed box, every lot is drawn into the shadow map even when you are
 * looking at a corner of the city.
 */

/** The ground seen at this isometric angle is stretched by about this much along the screen's vertical. */
const GROUND_STRETCH = 1.8;
/** Room for the shadows of tall buildings just off screen. */
export const SHADOW_MARGIN = 14;

/** Half-size of the shadow camera's box for a view of `width` × `height` pixels at camera zoom `zoom`, never more than `max`. */
export function shadowRadius(width: number, height: number, zoom: number, max: number): number {
  const r = 0.5 * Math.hypot(width / zoom, (height * GROUND_STRETCH) / zoom) * 1.1 + SHADOW_MARGIN;
  return Math.min(max, r);
}
