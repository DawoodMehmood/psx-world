/**
 * Position along a belt or elevator (0 at the start, 1 at the end) of item `i`
 * of `count` items at time `t`. The items stay evenly spaced however many are
 * out, so material comes as a steady stream and never in batches.
 */
export const flowPhase = (i: number, count: number, t: number): number => (((t + i / Math.max(1, count)) % 1) + 1) % 1;

/** How far an item at phase `u` has dropped into the opening it is dumped in: 0 until the last tenth of the belt, then 1 at the end. */
export const dumpDrop = (u: number): number => Math.max(0, Math.min(1, (u - 0.9) / 0.1));
