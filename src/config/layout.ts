import { SECTOR_BY_ID, type SectorId } from './sectors';

/**
 * City layout on a tile grid (1 tile = 1 world unit). Origin is the Exchange.
 * x grows to the screen's lower-right, z to the screen's lower-left.
 *
 * Each district fills one quadrant. Inside a quadrant we use (u, v) = distance
 * from the center along x and z, so the same layout works for every quadrant.
 */

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const WORLD_HALF = 44;
export const PLAZA_HALF = 7;
export const RING_OUTER = 9;
export const AVENUE_HALF = 1;
/** Land reserved per company: room for its biggest possible site (SPEC §3). */
export const LOT_SIZE = 14;
const STREET_HALF = 0.8;

/** Street lines in (u, v): the district's edges and the street between its lots. */
const STREET_LINES = [10, 26, 42];
const DISTRICT_MIN = STREET_LINES[0];
const DISTRICT_MAX = STREET_LINES[STREET_LINES.length - 1];

/** Lot origins in (u, v): lot 0 nearest the Exchange, then along x, then along z. The 4th cell is the district park. */
const LOT_UV: [number, number][] = [
  [11, 11],
  [27, 11],
  [11, 27],
];
const PARK_UV: [number, number] = [27, 27];

function uvRect(sectorId: SectorId, u0: number, v0: number, u1: number, v1: number): Rect {
  const [sx, sz] = SECTOR_BY_ID[sectorId].quadrant;
  const xs = [sx * u0, sx * u1];
  const zs = [sz * v0, sz * v1];
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

export function lotRect(sectorId: SectorId, plot: number): Rect {
  const [u, v] = LOT_UV[plot];
  return uvRect(sectorId, u, v, u + LOT_SIZE, v + LOT_SIZE);
}

/**
 * A company's site of the given depth: the lot's full width, from its back
 * edge (−z, away from the camera) toward the front, so it grows toward the
 * camera and new buildings appear in front of old ones.
 */
export function siteRect(sectorId: SectorId, plot: number, depth: number): Rect {
  const lot = lotRect(sectorId, plot);
  return { minX: lot.minX, maxX: lot.maxX, minZ: lot.minZ, maxZ: lot.minZ + depth };
}

/**
 * The lot's back corner (−x, −z, farthest from the camera): the origin of site
 * coordinates. Sites extend into +x and +z from here, toward the camera.
 */
export function lotBackCorner(sectorId: SectorId, plot: number): [number, number] {
  const lot = lotRect(sectorId, plot);
  return [lot.minX, lot.minZ];
}

export function parkRect(sectorId: SectorId): Rect {
  const [u, v] = PARK_UV;
  return uvRect(sectorId, u, v, u + LOT_SIZE, v + LOT_SIZE);
}

/**
 * Where the district's name sign stands: near the park corner farthest from
 * the Exchange. The camera never rotates, and from there no tower stands
 * between the sign and the camera.
 */
export function signSpot(sectorId: SectorId): [number, number] {
  const [sx, sz] = SECTOR_BY_ID[sectorId].quadrant;
  const uv = PARK_UV[0] + LOT_SIZE - 2.5;
  return [sx * uv, sz * uv];
}

export function districtRect(sectorId: SectorId): Rect {
  return uvRect(sectorId, DISTRICT_MIN, DISTRICT_MIN, DISTRICT_MAX, DISTRICT_MAX);
}

/** Streets around every lot: a grid at STREET_LINES in both directions. */
export function districtStreets(sectorId: SectorId): Rect[] {
  const lo = DISTRICT_MIN - STREET_HALF;
  const hi = DISTRICT_MAX + STREET_HALF;
  return STREET_LINES.flatMap((line) => [
    uvRect(sectorId, lo, line - STREET_HALF, hi, line + STREET_HALF),
    uvRect(sectorId, line - STREET_HALF, lo, line + STREET_HALF, hi),
  ]);
}

/** Ring road around the plaza plus the two avenues that split the quadrants. */
export function mainRoads(): Rect[] {
  const r = RING_OUTER;
  const p = PLAZA_HALF;
  const a = AVENUE_HALF;
  const w = WORLD_HALF - 1;
  return [
    { minX: -r, maxX: r, minZ: -r, maxZ: -p },
    { minX: -r, maxX: r, minZ: p, maxZ: r },
    { minX: -r, maxX: -p, minZ: -p, maxZ: p },
    { minX: p, maxX: r, minZ: -p, maxZ: p },
    { minX: -a, maxX: a, minZ: -w, maxZ: -r },
    { minX: -a, maxX: a, minZ: r, maxZ: w },
    { minX: -w, maxX: -r, minZ: -a, maxZ: a },
    { minX: r, maxX: w, minZ: -a, maxZ: a },
  ];
}

export const center = (r: Rect): [number, number] => [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];

export function overlaps(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

export function inflate(r: Rect, by: number): Rect {
  return { minX: r.minX - by, maxX: r.maxX + by, minZ: r.minZ - by, maxZ: r.maxZ + by };
}
