import { BAY_Z } from './sitePlan';

/*
 * Ground footprints of everything that can stand on a bank, oil or tech site
 * (every tier, every upgrade), as plain rectangles in site coordinates, so
 * tests can check that nothing overlaps, nothing crowds the pad's edge and the
 * corners stay free for the event poles. Keep them in step with the site code:
 * when a part moves, move its rectangle too.
 */

export interface Rect {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const rect = (name: string, cx: number, cz: number, w: number, d: number): Rect => ({ name, minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
const bays = (): Rect[] => BAY_Z.map((z, i) => ({ name: `bay ${i}`, minX: 11.4, maxX: 14, minZ: z - 0.55, maxZ: z + 0.55 }));

// ── banks ────────────────────────────────────────────────────────────────────

export const BANK = {
  /** The plaza between the skyline and the first rows, where the ATM, the plaza fountain and the planters stand. */
  atm: { at: [2.4, 4.7] },
  plazaFountain: { at: [3.75, 5.0], r: 0.75 },
  planters: [
    { at: [1.3, 5.5], w: 0.9, d: 0.45 },
    { at: [10.3, 5.5], w: 0.9, d: 0.45 },
  ],
  /** Garden fountain (tier 2). */
  fountain: { at: [2.2, 8.0], r: 1.0 },
} as const;

export function bankFootprints(): Rect[] {
  const [ax, az] = BANK.atm.at;
  const pf = BANK.plazaFountain;
  return [
    rect('HQ and its base', 2.3, 1.9, 4.2, 3.6),
    rect('second tower', 6.1, 1.9, 2.8, 3.2),
    rect('third tower', 9.4, 1.9, 2.8, 3.2),
    rect('branch hall', 7.2, 5.0, 4.6, 1.9),
    rect('wing 1', 6.4, 8.0, 4.5, 2.5),
    rect('wing 2', 6.4, 12.0, 4.5, 2.5),
    rect('rotunda', 2.2, 12.2, 2.6, 2.6),
    rect('ATM', ax, az, 0.8, 0.6),
    rect('plaza fountain', pf.at[0], pf.at[1], pf.r * 2, pf.r * 2),
    ...BANK.planters.map((p, i) => rect(`planter ${i}`, p.at[0], p.at[1], p.w, p.d)),
    rect('garden fountain', BANK.fountain.at[0], BANK.fountain.at[1], BANK.fountain.r * 2, BANK.fountain.r * 2),
    rect('tree a', 3.4, 9.4, 0.8, 0.8),
    rect('tree b', 9.9, 9.5, 0.8, 0.8),
    rect('tree c', 9.8, 13.3, 0.8, 0.8),
    rect('tree d', 3.8, 10.2, 0.8, 0.8),
    ...bays(),
  ];
}

// ── oil ──────────────────────────────────────────────────────────────────────

export const OIL = {
  derrick: { at: [2.2, 2.2] },
  hut: { at: [5.6, 1.2] },
  flare: { at: [8.4, 1.0] },
  /** Floodlight poles the last upgrade puts round the yard. */
  floodlights: [
    [0.7, 4.6],
    [10.4, 5.4],
    [10.4, 9.8],
  ],
  /** Where the gusher bursts out (a wellhead beside the rig). */
  wellhead: [1.7, 4.0],
} as const;

export function oilFootprints(): Rect[] {
  return [
    rect('drilling rig', OIL.derrick.at[0], OIL.derrick.at[1], 3.0, 3.0),
    rect('control hut and centre', OIL.hut.at[0], OIL.hut.at[1], 2.4, 1.6),
    rect('flare stack', OIL.flare.at[0], OIL.flare.at[1], 0.8, 0.8),
    rect('first tank', 9.7, 3.6, 1.8, 1.8),
    rect('pumpjack 0', 3.4, 5.0, 2.2, 1.0),
    rect('pumpjack 1', 7.0, 5.0, 2.2, 1.0),
    rect('pumpjack 2', 4.6, 9.2, 2.2, 1.0),
    rect('pumpjack 3', 5.0, 12.8, 2.2, 1.0),
    rect('separator', 1.2, 7.6, 1.4, 2.2),
    rect('tank pair 1', 8.2, 8.4, 4.4, 1.9),
    rect('tank pair 2', 8.4, 12.4, 4.4, 1.9),
    rect('processing unit', 2.2, 11.4, 2.6, 3.8),
    rect('barrels', 9.9, 10.6, 1.2, 1.2),
    ...OIL.floodlights.map((p, i) => rect(`floodlight ${i}`, p[0], p[1], 0.4, 0.4)),
    ...bays(),
  ];
}

// ── tech ─────────────────────────────────────────────────────────────────────

export const TECH = {
  hq: { at: [2.2, 2.2] },
  office: { at: [1.6, 7.8] },
  dc: [
    [6.6, 4.8],
    [6.6, 8.4],
    [6.6, 12.4],
  ],
  cafe: { at: [10.0, 6.8] },
  /** Rooftop cooling units the level-6 upgrade puts on every data center. */
  /** Where the delivery-drone light show forms: above the HQ. */
  show: [2.2, 2.2],
} as const;

export function techFootprints(): Rect[] {
  return [
    rect('HQ', TECH.hq.at[0], TECH.hq.at[1], 4.0, 4.0),
    rect('mast', 9.4, 1.0, 1.4, 1.4),
    rect('office block', TECH.office.at[0], TECH.office.at[1], 2.6, 3.6),
    ...TECH.dc.map((p, i) => rect(`data center ${i}`, p[0], p[1], 4.6, i ? 2.1 : 1.9)),
    rect('lab dome', 2.1, 12.0, 2.9, 2.9),
    rect('dish farm', 10.2, 12.8, 2.4, 2.4),
    rect('cafe and parasols', TECH.cafe.at[0], TECH.cafe.at[1] + 0.85, 2.1, 2.3),
    rect('tree a', 3.6, 9.9, 0.8, 0.8),
    rect('tree b', 4.4, 10.6, 0.8, 0.8),
    rect('tree c', 9.2, 10.6, 0.8, 0.8),
    ...bays(),
  ];
}
