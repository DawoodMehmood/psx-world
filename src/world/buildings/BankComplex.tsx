import { SITE_TIERS } from '../../config/companies';
import { HEALTH } from '../../engine/types';
import { CashVan, Workers, type Lane } from '../agents';
import { Box, Car, Cyl, GEO, mat, Roof, Tree } from '../kit';
import { Static } from '../Static';
import { ActivityWindows, BAY_Z, BayLines, BayVehicles, ClosedBay, CREW, closedByDecline, openBays, Slots, TIER_BAYS, ToLet, Weeds, type SlotDesign } from './shared';
import type { ArchetypeProps } from './types';

/*
 * Bank downtown on the shared plan (see shared.tsx): origin at the lot's back
 * corner, rows growing toward the camera.
 *
 *   back edge   the skyline: HQ tower at the corner, then the second tower
 *               (tier 2) and the third (tier 3) along the same edge
 *   row 1 front plaza and ATM; pad: a classic branch hall facing the camera
 *   row 2       an office wing (tier 2) and the fountain garden
 *   row 3       a second wing and a domed rotunda (tier 3)
 *
 * Every tall building stands on the back edge, so nothing tall ever hides a
 * lower one. Activity lights windows and brings out people and cars. Decline
 * closes the front-most buildings first: windows go dark and a TO LET board
 * goes up. The HQ never closes.
 */

const CARS = ['#f0c94a', '#e9e9ef', '#3a3f4a', '#f0c94a', '#c94a4a', '#e9e9ef'];
/** The skyline along the back edge: x center and width of each tower, all the same depth. */
const TOWER_Z = 1.9;
const TOWER_D = 3.0;
const HQ_X = 2.3;
const TOWER2_X = 6.1;
const TOWER3_X = 9.4;

const LANES: Lane[][] = [
  [
    [0.5, 3.9, 10.8, 3.9],
    [10.9, 0.5, 10.9, 5.6],
  ],
  [
    [0.5, 6.3, 10.8, 6.3],
    [10.9, 6.3, 10.9, 9.6],
  ],
  [
    [0.5, 10.3, 10.8, 10.3],
    [10.9, 10.3, 10.9, 13.6],
  ],
];

const SLOTS: SlotDesign[] = [
  {
    at: [7.2, 5.0],
    w: 4.6,
    d: 1.9,
    h: 2.4,
    crane: [10.3, 4.6],
    built: (p) => <BranchHall {...p} closed={closedFrom(p, 1)} />,
    partial: () => <Box size={[4.4, 1.0, 1.7]} at={[7.2, 0, 5.0]} color="#e6dfcf" />,
  },
  {
    at: [TOWER2_X, TOWER_Z],
    w: 2.8,
    d: TOWER_D + 0.2,
    h: 5,
    crane: [4.4, 4.6],
    built: (p) => <Tower at={[TOWER2_X, TOWER_Z]} w={2.6} d={TOWER_D} floors={Math.round(4 + p.scale * 4)} color="#e3ebf2" {...p} seed={p.seed + 11} closed={closedFrom(p, 2)} />,
    partial: () => <TowerCore at={[TOWER2_X, TOWER_Z]} w={2.6} d={TOWER_D} h={3} />,
  },
  {
    at: [6.4, 8.0],
    w: 4.6,
    d: 2.6,
    h: 2.6,
    crane: [10.0, 8.0],
    built: (p) => <Wing at={[6.4, 8.0]} {...p} closed={closedFrom(p, 3)} />,
    partial: () => <Box size={[4.4, 1.1, 2.4]} at={[6.4, 0, 8.0]} color="#e6dfcf" />,
  },
  {
    at: [TOWER3_X, TOWER_Z],
    w: 2.8,
    d: TOWER_D + 0.2,
    h: 6,
    crane: [10.4, 4.5],
    built: (p) => <Tower at={[TOWER3_X, TOWER_Z]} w={2.6} d={TOWER_D} floors={Math.round(6 + p.scale * 5)} color="#dde6ee" {...p} seed={p.seed + 23} closed={closedFrom(p, 4)} />,
    partial: () => <TowerCore at={[TOWER3_X, TOWER_Z]} w={2.6} d={TOWER_D} h={3.6} />,
  },
  {
    at: [6.4, 12.0],
    w: 4.6,
    d: 2.6,
    h: 2.6,
    crane: [10.0, 12.0],
    built: (p) => <Wing at={[6.4, 12.0]} {...p} seed={p.seed + 5} closed={closedFrom(p, 5)} />,
    partial: () => <Box size={[4.4, 1.1, 2.4]} at={[6.4, 0, 12.0]} color="#e6dfcf" />,
  },
  {
    at: [2.2, 12.2],
    w: 2.8,
    d: 2.8,
    h: 3.2,
    crane: [3.9, 13.6],
    built: (p) => <Rotunda {...p} closed={closedFrom(p, 6)} />,
    partial: () => <Cyl r={1.15} h={1.2} at={[2.2, 0, 12.2]} color="#e6dfcf" />,
  },
];

/** Slots in the order they close when health falls: front-most first (the wings, rotunda and branch hall), the towers last. */
const CLOSE_ORDER = [4, 5, 2, 0, 3, 1];

/** Whether the building at this position in build order (1 = slot 0) is closed by decline. The HQ (0) never closes. */
function closedFrom(p: ArchetypeProps, order: number): boolean {
  return closedByDecline(p, order - 1, CLOSE_ORDER);
}

export function BankComplex(props: ArchetypeProps) {
  const { scale, accent, seed, health, tier } = props;
  const h = HEALTH.indexOf(health);
  const floors = Math.round(5 + scale * 6);
  const bays = BAY_Z.slice(0, TIER_BAYS[tier - 1]);
  const open = openBays(h, bays);
  return (
    <group>
      {/* plaza in front of the skyline */}
      <Static>
        <Box size={[10.8, 0.04, 2.2]} at={[5.6, 0, 4.9]} color="#f4efe2" shadow={false} />
        <Atm out={h <= 0} accent={accent} />
      </Static>

      {/* HQ at the back corner */}
      <Static>
        <Box size={[4.2, 0.6, TOWER_D + 0.6]} at={[HQ_X, 0, TOWER_Z]} color="#d9d2c0" rounded={0.1} />
        <Box size={[1.8, 0.2, 0.7]} at={[HQ_X, 1.4, TOWER_Z + TOWER_D / 2 + 0.35]} color={accent} />
        <Box size={[1.2, 1.3, 0.1]} at={[HQ_X, 0.6, TOWER_Z + TOWER_D / 2 + 0.03]} color="#6f8aa3" />
      </Static>
      <Tower at={[HQ_X, TOWER_Z]} w={3.6} d={TOWER_D} floors={floors} color="#f3f0e8" {...props} base={0.6} closed={false} />

      {bays.map((z) => (
        <group key={z}>
          <BayLines z={z} color="#f7f4ec" />
          {!open.includes(z) && <ClosedBay z={z} />}
        </group>
      ))}
      <BayVehicles bays={open} vehicle={(i) => (i === 0 ? <CashVan stripe={accent} /> : <Car color={CARS[i % CARS.length]} />)} />

      {tier >= 2 && (
        <>
          <Fountain at={[2.2, 8.0]} dry={h <= 0} />
          <Tree at={[3.9, 0, 9.3]} size={0.8} />
          <Tree at={[9.9, 0, 9.5]} size={0.7} />
        </>
      )}
      {tier >= 3 && (
        <>
          <Tree at={[9.8, 0, 13.3]} size={0.8} />
          <Tree at={[4.2, 0, 10.9]} size={0.7} />
        </>
      )}

      <Slots designs={SLOTS} props={props} />

      <Workers lanes={LANES.slice(0, tier).flat()} max={Math.round((5 + tier * 3) * CREW[h])} office />
      {h <= 0 && <Weeds depth={SITE_TIERS.bank[tier - 1].depth} seed={seed} />}
    </group>
  );
}

/** A tower: walls, activity-lit windows, an accent crown and a roof box. */
function Tower({ at, w, d, floors, color, accent, seed, closed, base = 0 }: ArchetypeProps & { at: [number, number]; w: number; d: number; floors: number; color: string; closed: boolean; base?: number }) {
  const [x, z] = at;
  const towerH = 0.6 + floors;
  return (
    <group>
      <Static>
        <Box size={[w, towerH, d]} at={[x, base, z]} color={color} rounded={0.15} />
        <Box size={[w + 0.3, 0.45, d + 0.3]} at={[x, base + towerH, z]} color={closed ? '#a7a196' : accent} rounded={0.1} />
        <Box size={[w * 0.55, 0.6, d * 0.55]} at={[x, base + towerH + 0.45, z]} color="#e8e3d6" rounded={0.1} />
      </Static>
      <ActivityWindows at={[x, base, z]} w={w} d={d} floors={floors - 1} cols={3} seed={seed} closed={closed} darkColor="#7b93ad" />
      {closed && (
        <>
          <Box size={[w * 0.7, 0.9, 0.06]} at={[x, base, z + d / 2 + 0.02]} color="#8f8a82" shadow={false} />
          <ToLet at={[x, base + 1.5, z + d / 2 + 0.08]} w={Math.min(1.4, w * 0.6)} />
        </>
      )}
    </group>
  );
}

/** Concrete core with rebar on top: a tower going up. */
function TowerCore({ at, w, d, h }: { at: [number, number]; w: number; d: number; h: number }) {
  return (
    <group>
      <Box size={[w * 0.6, h, d * 0.6]} at={[at[0], 0, at[1]]} color="#c8c2b6" />
      {[-0.3, 0.3].map((f) => (
        <Box key={f} size={[w, 0.15, d]} at={[at[0], h * (0.5 + f), at[1]]} color="#d6d0c4" shadow={false} />
      ))}
    </group>
  );
}

/** Classic branch hall facing the camera: columns, steps and a pediment. */
function BranchHall({ accent, closed }: ArchetypeProps & { closed: boolean }) {
  return (
    <group position={[7.2, 0, 5.0]}>
      <Static>
      <Box size={[4.6, 0.25, 1.9]} color="#d9d2c0" />
      <Box size={[4.2, 1.9, 1.4]} at={[0, 0.25, -0.2]} color="#f4ecdc" />
      {[-1.8, -0.9, 0, 0.9, 1.8].map((x) => (
        <Cyl key={x} r={0.13} h={1.9} at={[x, 0.25, 0.68]} color="#fbf7ee" />
      ))}
      <Box size={[4.6, 0.25, 1.9]} at={[0, 2.15, 0]} color="#e8e0cf" />
      <group position={[0, 2.4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Roof w={1.9} d={4.6} h={0.6} color={closed ? '#a7a196' : accent} />
      </group>
      <Box size={[1.0, 1.3, 0.06]} at={[0, 0.25, 0.51]} color={closed ? '#8f8a82' : '#6f8aa3'} shadow={false} />
      </Static>
      {closed && (
        <>
          {/* chained shut: a rope across the steps and a big board hung in front of the columns */}
          <Box size={[4.4, 0.06, 0.06]} at={[0, 0.6, 0.95]} color="#e8c547" shadow={false} />
          <ToLet at={[0, 0.95, 0.9]} w={1.6} />
        </>
      )}
    </group>
  );
}

/** Two-storey office wing with an accent parapet. */
function Wing({ at, accent, seed, closed }: ArchetypeProps & { at: [number, number]; closed: boolean }) {
  const [x, z] = at;
  return (
    <group>
      <Static>
        <Box size={[4.4, 2.4, 2.4]} at={[x, 0, z]} color="#efe6d2" rounded={0.1} />
        <Box size={[4.5, 0.25, 2.5]} at={[x, 2.4, z]} color={closed ? '#a7a196' : accent} />
      </Static>
      <ActivityWindows at={[x, 0, z]} w={4.4} d={2.4} floors={2} cols={4} seed={seed + 7} closed={closed} darkColor="#7b93ad" />
      {closed && <ToLet at={[x + 1.2, 0.5, z + 1.25]} w={1.0} />}
    </group>
  );
}

/** Domed rotunda: the bank's showpiece banking hall. */
function Rotunda({ accent, closed }: ArchetypeProps & { closed: boolean }) {
  return (
    <group position={[2.2, 0, 12.2]}>
      <Static>
      <Cyl r={1.3} h={0.3} color="#d9d2c0" />
      <Cyl r={1.1} h={1.9} at={[0, 0.3, 0]} color="#f4ecdc" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <Cyl key={i} r={0.1} h={1.9} at={[Math.cos(a) * 1.22, 0.3, Math.sin(a) * 1.22]} color="#fbf7ee" low />;
      })}
      <Cyl r={1.32} h={0.2} at={[0, 2.2, 0]} color="#e8e0cf" />
      <mesh geometry={GEO.dome} material={mat(closed ? '#a7a196' : accent)} position={[0, 2.4, 0]} scale={[1.05, 0.9, 1.05]} castShadow />
      <Cyl r={0.08} h={0.5} at={[0, 3.25, 0]} color="#e8c547" low />
      </Static>
      {closed && <ToLet at={[0.5, 0.8, 1.25]} w={0.9} />}
    </group>
  );
}

/** ATM kiosk on the plaza; its screen goes dark when the bank is struggling. */
function Atm({ out, accent }: { out: boolean; accent: string }) {
  return (
    <group position={[2.4, 0, 4.7]}>
      <Box size={[0.8, 1.2, 0.6]} color={out ? '#a7a196' : accent} rounded={0.08} />
      <Box size={[0.5, 0.35, 0.05]} at={[0, 0.6, 0.31]} color={out ? '#3a3f4a' : '#bfe8ff'} glow={out ? 0 : 0.4} shadow={false} />
    </group>
  );
}

/** Garden fountain; dry when the bank is struggling. */
function Fountain({ at, dry }: { at: [number, number]; dry: boolean }) {
  const [x, z] = at;
  return (
    <group position={[x, 0, z]}>
      <Static>
        <Cyl r={1.0} h={0.35} color="#d9d2c0" />
        <Cyl r={0.85} h={0.05} at={[0, 0.32, 0]} color={dry ? '#b9b1a3' : '#7cc8f0'} shadow={false} />
        <Cyl r={0.12} h={0.7} at={[0, 0.3, 0]} color="#d9d2c0" low />
        {!dry && <Cyl r={0.06} h={0.5} at={[0, 1.0, 0]} color="#c8ecff" glow={0.2} low shadow={false} />}
      </Static>
    </group>
  );
}
