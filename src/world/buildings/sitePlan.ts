/*
 * The geometry of a site, as plain numbers (no React or Three), so the layout
 * can be checked by tests. Site coordinates: origin at the lot's back corner,
 * x and z growing toward the camera (see shared.tsx).
 */

/** Width of the build area; beyond it is the vehicle strip along the side street. */
export const BUILD_W = 11.4;
/** Where a vehicle stops in its bay, and where it leaves the lot on the side street. */
export const DOCK_X = 12.7;
export const STREET_X = 15.9;
/** Bay rows along the vehicle strip: three in tier 1's rows, two more in each later tier. */
export const BAY_Z = [1.4, 3.0, 4.6, 7.2, 8.8, 11.4, 13.0];
/** Bays each tier has. */
export const TIER_BAYS = [3, 5, 7];

// ── the height rule ──────────────────────────────────────────────────────────

export interface Column {
  x: number;
  z: number;
  r: number;
  h: number;
}

export interface Spot {
  name: string;
  x: number;
  y: number;
  z: number;
}

/**
 * SPEC §3: from the fixed camera a tall thing hides what is behind it, toward
 * the lot's back corner. A point `k` tiles behind a column (equal steps back
 * in x and z) at height `y` is hidden when `k + y < h`, if it lies within the
 * column's width of that line of sight. `slack` widens the width a little so
 * a part's own size counts.
 */
export function hides(col: Column, p: Spot, slack = 0.2): boolean {
  const dx = col.x - p.x;
  const dz = col.z - p.z;
  const along = (dx + dz) / 2;
  const across = Math.abs(dx - dz) / Math.SQRT2;
  return along > 0 && across < col.r + slack && along + p.y < col.h;
}

// ── cement ───────────────────────────────────────────────────────────────────

export const SILO_X = 10.6;
export const SILO_R = 0.6;
export const KILN_Z = [3.4, 7.9, 12.0];
export const PREHEATER_X = 1.1;
/** Short enough that the burner hood stands clear of the silos' line of sight. */
export const KILN_LEN = 3.35;
/** The drum starts flush against the preheater's face (x = 1.95) and runs toward +x. */
export const KILN_START = PREHEATER_X + 0.85;
/** Drum center. */
export const KILN_CX = KILN_START + KILN_LEN / 2;
/** Burner hood centre: the front end of a kiln line. */
export const BURNER_X = KILN_CX + KILN_LEN / 2 + 0.45;
/** Hall, along the back edge behind the first kiln. */
export const HALL_X = 3.9;
export const HALL_Z = 1.2;
/** Packing house (level 8), between the second and third kiln rows. Its pad sits in the 2.2 gap between the kiln pads. */
export const PACKING = { at: [5.0, 9.95], w: 2.4, d: 1.9 } as const;
/** Quarry pit: its normal size, and the widened one the last upgrade gives it. */
export const QUARRY = { normal: { at: [4.6, 5.25], w: 2.6, d: 1.3 }, wide: { at: [4.4, 5.4], w: 2.8, d: 2.0 } } as const;
/** The one excavator that works the widened quarry. */
export const EXCAVATOR: [number, number] = [4.6, 5.5];
/** Feed hopper against the first preheater's front face, fed by a short low belt from the quarry; the elevator (level 3) rises from it. */
export const HOPPER = { at: [1.2, 4.78], w: 0.8, d: 0.8, h: 0.7 } as const;
/**
 * The belt ends just outside a black opening in the hopper's side that faces
 * it (the +x face), as if dumping into it.
 */
export const FEED_BELT = { from: [3.5, 0.3, 5.3], to: [1.75, 0.5, 4.85] } as const;
/** The opening on the hopper's +x face: centre height and z, and its size. */
export const HOPPER_OPENING = { z: 4.82, y: 0.4, w: 0.5, h: 0.36 } as const;
/**
 * Two heaps of clinker side by side in front of the second kiln line's burner
 * opening, in a row across its face and touching, centred on the kiln's axis.
 */
export const STOCKPILES = [
  { at: [7.0, 7.25], r: 0.8, h: 1.0 },
  { at: [7.0, 8.55], r: 0.6, h: 0.8 },
] as const;

/** Taller companies get taller silos; the first upgrade only adds a little, because silos hide what is behind them. */
export const siloHeight = (scale: number, upgraded: boolean) => 2.8 + scale * 1.6 + (upgraded ? 0.4 : 0);
export const preheaterHeight = (scale: number, upgraded: boolean) => 3.6 + scale * 2.2 + (upgraded ? 0.9 : 0);
/** Bands round a silo or preheater: more of them for a bigger company, so size reads at a glance. */
export const siloBands = (scale: number) => 1 + Math.round(scale * 5);
export const preheaterBands = (scale: number) => 2 + Math.round(scale * 5);

/** Everything low that has to stay in view on a cement site, at the sizes where the silos are tallest. */
export function cementSpots(): Spot[] {
  const spots: Spot[] = [];
  KILN_Z.forEach((z, i) => {
    for (let x = KILN_START; x <= BURNER_X; x += 0.5) spots.push({ name: `kiln ${i} drum x=${x}`, x, y: 1.15, z });
    spots.push({ name: `kiln ${i} burner`, x: BURNER_X, y: 0.6, z });
  });
  spots.push({ name: 'hall end', x: HALL_X + 1.8, y: 1.1, z: HALL_Z });
  spots.push({ name: 'packing house far end', x: PACKING.at[0] + PACKING.w / 2, y: 1, z: PACKING.at[1] });
  for (const q of [QUARRY.normal, QUARRY.wide]) spots.push({ name: 'quarry far end', x: q.at[0] + q.w / 2, y: 0.3, z: q.at[1] });
  spots.push({ name: 'excavator', x: EXCAVATOR[0], y: 0.5, z: EXCAVATOR[1] });
  spots.push({ name: 'feed belt start', x: FEED_BELT.from[0], y: FEED_BELT.from[1], z: FEED_BELT.from[2] });
  return spots;
}

export interface Rect {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const rect = (name: string, cx: number, cz: number, w: number, d: number): Rect => ({ name, minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });

/** Ground footprints of everything that can stand on a cement site (all tiers and upgrades), for checks. */
export function cementFootprints(): Rect[] {
  return [
    ...KILN_Z.map((z, i) => ({ name: `kiln line ${i}`, minX: PREHEATER_X - 0.85, maxX: BURNER_X + 0.45, minZ: z - 0.9, maxZ: z + 0.9 })),
    rect('hall', HALL_X, HALL_Z, 3.6, 2.0),
    rect('packing house', PACKING.at[0], PACKING.at[1], PACKING.w, PACKING.d),
    rect('quarry (wide)', QUARRY.wide.at[0], QUARRY.wide.at[1], QUARRY.wide.w, QUARRY.wide.d),
    rect('hopper', HOPPER.at[0], HOPPER.at[1], HOPPER.w, HOPPER.d),
    rect('stockpiles', 7.0, 7.8, 1.6, 2.7),
    ...BAY_Z.map((z, i) => ({ name: `silo bay ${i}`, minX: SILO_X - SILO_R, maxX: 14, minZ: z - 0.55, maxZ: z + 0.55 })),
  ];
}

/** Every silo that can ever stand: seven bays, at their tallest. */
export function cementSilos(scale = 1, upgraded = true): Column[] {
  return BAY_Z.map((z) => ({ x: SILO_X, z, r: SILO_R, h: siloHeight(scale, upgraded) }));
}
