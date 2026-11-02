import { LOT_SIZE } from '../config/layout';

/**
 * Posts for the rope or fence round a strip of new land from z = `from` to
 * z = `to`, across the whole width of the lot. Posts stand at every corner and
 * at even spacing along each side, so every rope ends on a post.
 */
export function fencePosts(from: number, to: number, spacing = 1.6): [number, number][] {
  const posts: [number, number][] = [];
  const nx = Math.max(1, Math.ceil(LOT_SIZE / spacing));
  for (let i = 0; i <= nx; i++) posts.push([(LOT_SIZE * i) / nx, to]);
  const nz = Math.max(1, Math.ceil((to - from) / spacing));
  // from the back end of the sides up to (not including) the front corners, which the front row already has
  for (let i = 0; i < nz; i++) {
    const z = from + ((to - from) * i) / nz;
    posts.push([0, z], [LOT_SIZE, z]);
  }
  return posts;
}
