import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial, Vector3, type Group, type Mesh } from 'three';
import { beltBasis } from '../belt';
import { SITE_TIERS } from '../../config/companies';
import { HEALTH, type SlotState } from '../../engine/types';
import { MixerTruck, Workers, type Lane } from '../agents';
import { Box, Cone, Cyl, GEO, mat, Roof, Rope, TARP_BLUE, type Vec3 } from '../kit';
import { Static } from '../Static';
import { agentCount, useMotion } from '../motion';
import { BAY_Z, BayLines, BayVehicles, ClosedBay, DOCK_X, isBuilt, openBays, runningCount, Slots, Weeds, type SlotDesign } from './shared';
import { crewMax } from '../../engine/visual';
import { UpgradeSite } from '../construction/UpgradeSite';
import { BURNER_X, EXCAVATOR, FEED_BELT, HALL_X, HALL_Z, HOPPER, KILN_CX, KILN_LEN, KILN_Z, PACKING, PREHEATER_X, preheaterBands, preheaterHeight, QUARRY, SILO_R, SILO_X, siloBands, siloHeight } from './sitePlan';
import type { ArchetypeProps } from './types';

/*
 * Cement site on the shared plan (see shared.tsx): origin at the lot's back
 * corner, rows growing toward the camera.
 *
 *   back-left edge   a preheater tower per kiln line (the tallest parts), rows z 3.4 · 7.9 · 12
 *   kiln drums       run from each preheater toward the front-right, burner facing the camera
 *   back edge        the hall (low), behind the first kiln
 *   front of row 1   quarry, a short low belt to a hopper at the first preheater's foot (an elevator climbs from it at level 3)
 *   front-right      silos beside the truck strip, one bay each; loading wings add more toward the front
 *   between rows     stockpiles (tier 2) and the packing house (level 8), both low,
 *                    clear of the tall silos so nothing hides them
 */

/** The upgrades, in ladder order (levels 3, 6 and 10), as they show on a cement site. */
const RAISED_SILOS = 0;
const TALL_KILNS = 1;
const WIDE_YARD = 2;
const done = (p: Pick<ArchetypeProps, 'upgrades'>, i: number) => p.upgrades[i]?.stage === 'COMPLETE';


/** Which bays exist: 0 and 1 from the start, then each loading slot adds its own. */
function builtBays(slots: SlotState[]): number[] {
  return [0, 1, ...(isBuilt(slots, 0) ? [2] : []), ...(isBuilt(slots, 2) ? [3, 4] : []), ...(isBuilt(slots, 5) ? [5, 6] : [])];
}

/*
 * Decline (SPEC §8): nothing is demolished; the plant winds down instead.
 *   STEADY and up  everything runs
 *   WEAK           newest kiln line mothballed under a tarp, a bay coned off, crew cut back
 *   STRUGGLING     only the first kiln runs, most bays closed, windows boarded, weeds in the yard
 */
function builtKilns(slots: SlotState[]): number {
  return 1 + Number(isBuilt(slots, 1)) + Number(isBuilt(slots, 3));
}

/** Walking lanes each tier adds: between the kilns and the silos, and between the kiln rows. */
const LANES: Lane[][] = [
  [
    [9.4, 0.5, 9.4, 5.6],
    [2.2, 2.4, 9.0, 2.4],
    [6.2, 5.5, 9.0, 5.5],
  ],
  [
    [9.4, 6.4, 9.4, 9.6],
    [2.2, 6.3, 7.0, 6.3],
  ],
  [
    [9.4, 10.4, 9.4, 13.6],
    [2.2, 13.4, 9.0, 13.4],
  ],
];

const siloStump = (i: number) => <Cyl key={i} r={SILO_R} h={1.4} at={[SILO_X, 0, BAY_Z[i]]} color="#cfc8ba" />;
/** Footprint of a silo bay: from the silo to the end of its bay. */
const BAY_CX = (SILO_X - SILO_R + 13.9) / 2;
const BAY_W = 13.9 - (SILO_X - SILO_R);
/** Footprint of a kiln line: preheater to burner hood. */
const KILN_PAD_CX = (PREHEATER_X - 0.85 + KILN_CX + KILN_LEN / 2 + 0.45) / 2;
const KILN_PAD_W = KILN_CX + KILN_LEN / 2 + 0.45 - (PREHEATER_X - 0.85);

/** Expansion slots in build order: tier 1 has slot 0, tier 2 slots 1–2, tier 3 slots 3–5 (see SITE_TIERS). */
const SLOTS: SlotDesign[] = [
  {
    at: [BAY_CX, BAY_Z[2]],
    w: BAY_W,
    d: 1.3,
    h: 3,
    crane: [8.4, 5.3],
    built: (p) => <SiloBay bay={2} {...p} />,
    partial: () => siloStump(2),
  },
  {
    at: [KILN_PAD_CX, KILN_Z[1]],
    w: KILN_PAD_W,
    d: 1.9,
    h: 2.8,
    crane: [8.4, 6.5],
    built: (p) => <KilnLine line={1} {...p} />,
    partial: (p) => <KilnLine line={1} {...p} bare />,
  },
  {
    at: [BAY_CX, (BAY_Z[3] + BAY_Z[4]) / 2],
    w: BAY_W,
    d: 2.9,
    h: 3,
    crane: [8.6, 7.0],
    built: (p) => <LoadingWing bays={[3, 4]} {...p} />,
    partial: () => [3, 4].map(siloStump),
  },
  {
    at: [KILN_PAD_CX, KILN_Z[2]],
    w: KILN_PAD_W,
    d: 1.9,
    h: 2.8,
    crane: [8.4, 10.6],
    built: (p) => <KilnLine line={2} {...p} />,
    partial: (p) => <KilnLine line={2} {...p} bare />,
  },
  {
    at: [PACKING.at[0], PACKING.at[1]],
    w: PACKING.w,
    d: PACKING.d,
    h: 2.0,
    crane: [3.0, 10.0],
    built: (p) => <PackingHouse accent={p.accent} />,
    partial: () => <Box size={[PACKING.w - 0.3, 0.5, PACKING.d - 0.3]} at={[PACKING.at[0], 0, PACKING.at[1]]} color="#cfc8ba" />,
  },
  {
    at: [BAY_CX, (BAY_Z[5] + BAY_Z[6]) / 2],
    w: BAY_W,
    d: 2.9,
    h: 3,
    crane: [8.6, 11.2],
    built: (p) => <LoadingWing bays={[5, 6]} {...p} />,
    partial: () => [5, 6].map(siloStump),
  },
];

export function CementPlant(props: ArchetypeProps) {
  const { health, tier, slots, upgrades } = props;
  const h = HEALTH.indexOf(health);
  const wide = done(props, WIDE_YARD);
  return (
    <group>
      <Hall h={h} extended={wide} />
      <KilnLine line={0} {...props} />
      <Quarry wide={wide} />
      {/* raw material: a short, low belt from the quarry into a hopper at the first preheater's foot */}
      <Conveyor from={[...FEED_BELT.from]} to={[...FEED_BELT.to]} />
      <Hopper />
      {done(props, RAISED_SILOS) && <Elevator h={preheaterHeight(props.scale, done(props, TALL_KILNS)) - 0.5} />}
      {wide && <Excavator />}

      {/* upgrades being fitted: scaffolding round the silos, the elevator, the first preheater and the quarry */}
      <UpgradeSite state={upgrades[RAISED_SILOS]} at={[SILO_X, 2.2]} w={1.9} d={3.6} h={siloHeight(props.scale, false) - 0.2} />
      <UpgradeSite state={upgrades[RAISED_SILOS]} at={[HOPPER.at[0], HOPPER.at[1] - 0.1]} w={1.3} d={1.2} h={preheaterHeight(props.scale, false) - 0.6} />
      <UpgradeSite state={upgrades[TALL_KILNS]} at={[PREHEATER_X, KILN_Z[0]]} w={2.2} d={2.2} h={preheaterHeight(props.scale, false) - 0.3} />
      <UpgradeSite state={upgrades[WIDE_YARD]} at={[QUARRY.wide.at[0], QUARRY.wide.at[1]]} w={3.2} d={2.4} h={1.5} />

      {/* the original two silos and bays */}
      {[0, 1].map((i) => (
        <SiloBay key={i} bay={i} {...props} />
      ))}

      {h <= 0 && <Weeds depth={SITE_TIERS.cement[tier - 1].depth} seed={props.seed} />}

      {/* tier 2 yard: clinker stockpiles between the kiln rows, well inside the site's edge (it is 10 deep at this tier) */}
      {tier >= 2 && (
        <Static>
          <Cone r={0.7} h={0.9} at={[8.3, 0, 8.1]} color="#9a948a" />
          <Cone r={0.5} h={0.7} at={[7.0, 0, 8.5]} color="#a8a196" />
        </Static>
      )}

      <Slots designs={SLOTS} props={props} />

      <BayVehicles bays={openBays(h, builtBays(slots)).map((b) => BAY_Z[b])} vehicle={() => <MixerTruck />} />
      <Workers lanes={LANES.slice(0, tier).flat()} max={crewMax(4 + tier * 3, h)} />
    </group>
  );
}

/** The hall along the back edge, with boarded-up windows when struggling. */
function Hall({ h, extended }: { h: number; extended: boolean }) {
  const windows = (
    <>
      <Box size={[0.5, 0.45, 0.04]} color={h <= 0 ? '#5a554e' : '#cfe9f7'} shadow={false} />
      {h <= 0 && (
        <>
          <Box size={[0.62, 0.1, 0.05]} at={[0, 0.12, 0.01]} rot={[0, 0, 0.35]} color="#a87b4f" shadow={false} />
          <Box size={[0.62, 0.1, 0.05]} at={[0, 0.12, 0.01]} rot={[0, 0, -0.35]} color="#9a6e45" shadow={false} />
        </>
      )}
    </>
  );
  return (
    <group position={[HALL_X, 0, HALL_Z]}>
      <Static>
      <Box size={[3.6, 2.2, 2.0]} color="#efe7d6" rounded={0.08} />
      {/* ridge along the hall's length; the last upgrade adds a second storey under it */}
      {extended && <Box size={[3.4, 1.1, 1.8]} at={[0, 2.2, 0]} color="#efe7d6" rounded={0.08} />}
      <group position={[0, extended ? 3.3 : 2.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Roof w={2.2} d={3.8} h={0.8} color="#9b9284" />
      </group>
      {/* door and windows on the faces the camera sees */}
      <Box size={[0.06, 1.2, 0.9]} at={[1.81, 0, -0.3]} color="#7d756a" shadow={false} />
      <group position={[1.82, 1.5, 0.55]} rotation={[0, Math.PI / 2, 0]}>
        {windows}
      </group>
      {[-1.1, 0, 1.1].map((x) => (
        <group key={x} position={[x, 1.5, 1.01]}>
          {windows}
        </group>
      ))}
      {extended &&
        [-1.1, 0, 1.1].map((x) => (
          <group key={x} position={[x, 2.75, 0.91]}>
            {windows}
          </group>
        ))}
      </Static>
    </group>
  );
}

/**
 * A silo with its loading spout over its own painted truck bay. Health shows
 * as cones across the bay when it is closed and patches on the silo (struggling).
 */
function SiloBay({ bay, scale, accent, health, slots, upgrades }: ArchetypeProps & { bay: number }) {
  const h = HEALTH.indexOf(health);
  const z = BAY_Z[bay];
  const closed = !openBays(h, builtBays(slots)).includes(bay);
  // the first upgrade lifts every silo a little and rings it with a walkway; silos hide what is behind them, so not by much
  const raised = done({ upgrades }, RAISED_SILOS);
  const siloH = siloHeight(scale, raised);
  const bands = siloBands(scale);
  const spoutY = 1.75;
  const armFrom = SILO_X + SILO_R - 0.1;
  const armTo = DOCK_X - 0.1;
  return (
    <Static>
      <Cyl r={SILO_R} h={siloH} at={[SILO_X, 0, z]} color="#e6e1d6" />
      {/* a band for each step of company size, so a big company's silos read as bigger at a glance */}
      {Array.from({ length: bands }, (_, i) => (
        <Cyl key={i} r={SILO_R + 0.02} h={0.13} at={[SILO_X, siloH * (0.16 + (0.74 * i) / Math.max(1, bands - 1)), z]} color={h <= 0 ? '#9a948a' : accent} />
      ))}
      <Cone r={SILO_R} h={0.4} at={[SILO_X, siloH, z]} color="#cfc8ba" />
      {raised && <Cyl r={SILO_R + 0.14} h={0.07} at={[SILO_X, siloH - 0.55, z]} color="#8a8174" />}
      {/* spout arm reaching over the bay */}
      <Box size={[armTo - armFrom, 0.14, 0.2]} at={[(armFrom + armTo) / 2, spoutY, z]} color="#8a8174" />
      <Cyl r={0.08} h={0.4} at={[armTo, spoutY - 0.4, z]} color="#5f584f" low />
      <BayLines z={z} />
      {h <= 0 && <Box size={[0.05, 0.6, 0.45]} at={[SILO_X + SILO_R + 0.01, siloH * 0.3, z]} color="#a39d92" shadow={false} />}
      {closed && <ClosedBay z={z} />}
    </Static>
  );
}

/** Two more silo bays, the same as every other: each silo loads the truck in its own bay. */
function LoadingWing({ bays, ...p }: ArchetypeProps & { bays: number[] }) {
  return (
    <group>
      {bays.map((i) => (
        <SiloBay key={i} bay={i} {...p} />
      ))}
    </group>
  );
}

/**
 * A kiln line: preheater tower on the back-left edge, drum on piers running
 * toward the front-right, burner hood at the front end. A mothballed line has
 * a cold burner, no smoke, and its drum wrapped in a tarp.
 */
function KilnLine({ line, scale, accent, health, slots, upgrades, bare = false }: ArchetypeProps & { line: number; bare?: boolean }) {
  const tall = !bare && done({ upgrades }, TALL_KILNS);
  const towerH = preheaterHeight(scale, tall);
  const y = 1.15;
  const z = KILN_Z[line];
  const mothballed = !bare && line >= runningCount(HEALTH.indexOf(health), builtKilns(slots));
  const burnerX = BURNER_X;
  return (
    <group>
      <group position={[KILN_CX, 0, z]}>
        <Kiln at={[0, y, 0]} length={KILN_LEN} r={0.5} piers={[-1.6, 0, 1.6]} color={bare ? '#c9c2b6' : accent} bare={bare} wrapped={mothballed} />
        {!bare && <KilnGlow at={[KILN_LEN / 2 + 0.25, y - 0.55, 0]} cold={mothballed} />}
      </group>
      <Preheater z={z} h={bare ? towerH * 0.45 : towerH} accent={accent} stack={!bare} smoke={!bare && !mothballed} tall={tall} bands={preheaterBands(scale)} />
      {mothballed && (
        // chained shut: a rope with a padlock board across the front of the line
        <group position={[burnerX + 0.35, 0, z]} rotation={[0, Math.PI / 2, 0]}>
          <Static>
          {[-0.7, 0.7].map((px) => (
            <Box key={px} size={[0.08, 0.6, 0.08]} at={[px, 0, 0]} color="#5f584f" shadow={false} />
          ))}
          <Rope from={[-0.7, 0.5, 0]} to={[0, 0.38, 0]} color="#e8c547" r={0.02} />
          <Rope from={[0, 0.38, 0]} to={[0.7, 0.5, 0]} color="#e8c547" r={0.02} />
          <Box size={[0.32, 0.22, 0.04]} at={[0, 0.2, -0.02]} color="#e8463a" shadow={false} />
          </Static>
        </group>
      )}
    </group>
  );
}

function Preheater({ z, h, accent, stack, smoke, bands, tall = false }: { z: number; h: number; accent: string; stack: boolean; smoke: boolean; bands: number; tall?: boolean }) {
  const x = PREHEATER_X;
  const stackH = tall ? 2.2 : 1.4;
  return (
    <group>
      <Static>
        <Box size={[1.7, h, 1.7]} at={[x, 0, z]} color="#d8d0c0" rounded={0.08} />
        {/* one band per step of company size */}
        {Array.from({ length: bands }, (_, i) => (
          <Box key={i} size={[1.85, 0.14, 1.85]} at={[x, h * (0.14 + (0.76 * i) / Math.max(1, bands - 1)), z]} color="#8a8174" />
        ))}
        {stack && (
          <>
            <Cyl r={0.24} h={stackH} at={[x - 0.3, h, z - 0.3]} color="#b9b1a3" />
            <Cyl r={0.26} h={0.18} at={[x - 0.3, h + stackH - 0.16, z - 0.3]} color={smoke ? accent : '#8a8174'} />
          </>
        )}
        {/* the upgrade adds a second cyclone on the back-left edge, where a tall part hides nothing */}
        {tall && (
          <>
            <Cyl r={0.34} h={h * 0.78} at={[x - 0.95, 0, z]} color="#d8d0c0" />
            <Cone r={0.34} h={0.5} at={[x - 0.95, h * 0.78, z]} color="#8a8174" />
          </>
        )}
      </Static>
      {stack && smoke && <Smoke at={[x - 0.3, h + stackH + 0.02, z - 0.3]} />}
    </group>
  );
}

/**
 * Kiln drum on piers, tilted down toward +x. `bare` leaves off the tyres
 * (half-built look); `wrapped` sleeves the whole drum in a tarp that follows
 * its tilt, gathered and tied at both ends (mothballed).
 */
function Kiln({ at, length, r, piers, color, bare = false, wrapped = false }: { at: Vec3; length: number; r: number; piers: number[]; color: string; bare?: boolean; wrapped?: boolean }) {
  const [x, y, z] = at;
  const tilt = Math.PI / 2 - 0.06;
  return (
    <Static>
      {piers.map((px) => (
        <Box key={px} size={[0.4, y - r * 0.6 - (px - x) * 0.06, r * 1.6]} at={[px, 0, z]} color="#8a8174" />
      ))}
      <Cyl r={r} h={length} at={[x, y, z]} rot={[0, 0, tilt]} color={color} center />
      {!bare &&
        [-0.3, 0.05, 0.4].map((f) => {
          const tx = x + f * length;
          return <Cyl key={f} r={r + 0.05} h={0.2} at={[tx, y - (tx - x) * 0.06, z]} rot={[0, 0, tilt]} color="#5f584f" center />;
        })}
      {wrapped && (
        <>
          <Cyl r={r + 0.1} h={length + 0.1} at={[x, y, z]} rot={[0, 0, tilt]} color={TARP_BLUE} center />
          {[-1, 1].map((s) => {
            const tx = x + s * (length / 2 + 0.12);
            return <Cyl key={s} r={r * 0.6} h={0.2} at={[tx, y - (tx - x) * 0.06, z]} rot={[0, 0, tilt]} color="#3570c4" center />;
          })}
          {[-0.42, -0.14, 0.14, 0.42].map((f) => {
            const tx = x + f * length;
            return <Cyl key={f} r={r + 0.12} h={0.07} at={[tx, y - (tx - x) * 0.06, z]} rot={[0, 0, tilt]} color="#e8dcc0" center shadow={false} />;
          })}
        </>
      )}
    </Static>
  );
}

/** Burner hood at the kiln's low end; glows hotter with activity. Dark when `cold`. */
function KilnGlow({ at, cold = false }: { at: Vec3; cold?: boolean }) {
  const motion = useMotion();
  const glow = useMemo(() => new MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 0.6, flatShading: true }), []);
  useFrame(() => {
    glow.emissiveIntensity = motion.halted ? 0.05 : 0.25 + motion.intensity * 1.6 + motion.heat * 2;
  });
  return (
    <group position={at}>
      <Box size={[0.4, 1.0, 1.0]} color="#6d675f" rounded={0.05} />
      <mesh material={cold ? mat('#2e2a26') : glow} position={[0.21, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.32, 16]} />
      </mesh>
    </group>
  );
}

/** Packing house (level 8): bags are filled here and stacked for the trucks. White shed with the company's band, a door, windows and pallets of bags. */
function PackingHouse({ accent }: { accent: string }) {
  return (
    <group position={[PACKING.at[0], 0, PACKING.at[1]]}>
      <Static>
        <Box size={[2.1, 1.5, 1.5]} color="#f6f1e4" rounded={0.08} />
        <Box size={[2.12, 0.2, 1.52]} at={[0, 0.8, 0]} color={accent} />
        <group position={[0, 1.5, 0]}>
          <Roof w={1.7} d={2.3} h={0.55} color="#9b9284" />
        </group>
        {/* door and windows on the faces the camera sees */}
        <Box size={[0.06, 0.9, 0.7]} at={[1.06, 0, -0.1]} color="#7d756a" shadow={false} />
        {[-0.55, 0.45].map((x) => (
          <Box key={x} size={[0.4, 0.35, 0.04]} at={[x, 0.95, 0.76]} color="#cfe9f7" shadow={false} />
        ))}
        {/* pallets of bags along the front */}
        {[-0.6, 0.1, 0.8].map((x, i) => (
          <group key={x}>
            <Box size={[0.55, 0.12, 0.4]} at={[x, 0, 1.05]} color="#c8935a" />
            <Box size={[0.5, 0.3 + (i % 2) * 0.15, 0.36]} at={[x, 0.12, 1.05]} color="#fbfaf5" rounded={0.03} />
          </group>
        ))}
      </Static>
    </group>
  );
}

/** The quarry pit at the front of the first row, where the conveyor starts. The last upgrade widens it toward the camera. */
function Quarry({ wide = false }: { wide?: boolean }) {
  const q = wide ? QUARRY.wide : QUARRY.normal;
  const rocks: Vec3[] = [
    [4.2, 5.3, 0.42],
    [5.1, 5.0, 0.35],
    [5.4, 5.5, 0.3],
    ...(wide ? ([[3.5, 5.9, 0.34], [4.6, 6.1, 0.3], [5.3, 6.0, 0.32]] as Vec3[]) : []),
  ];
  return (
    <Static>
      <Box size={[q.w, 0.06, q.d]} at={[q.at[0], 0, q.at[1]]} color="#9c8466" shadow={false} />
      {rocks.map(([x, z, r]) => (
        <mesh key={x + z} geometry={GEO.blob} material={mat('#b49a78')} position={[x, r * 0.6, z]} scale={[r * 1.3, r, r * 1.2]} castShadow />
      ))}
    </Static>
  );
}

/** One excavator working the widened quarry: tracks, a turning cab, a boom, a stick and a bucket that dig and lift. */
function Excavator() {
  const motion = useMotion();
  const body = useRef<Group>(null);
  const boom = useRef<Group>(null);
  const stick = useRef<Group>(null);
  useFrame(() => {
    if (!body.current || !boom.current || !stick.current) return;
    const t = motion.t * 0.8;
    body.current.rotation.y = Math.sin(t * 0.45) * 0.8;
    boom.current.rotation.z = 0.7 + Math.sin(t) * 0.1;
    stick.current.rotation.z = -1.2 + Math.sin(t) * 0.35;
  });
  return (
    <group position={[EXCAVATOR[0], 0.04, EXCAVATOR[1]]} scale={1.5}>
      <Box size={[1.1, 0.24, 0.6]} color="#3a3a3a" />
      <Box size={[1.2, 0.07, 0.2]} at={[0, 0.2, 0.3]} color="#575757" shadow={false} />
      <Box size={[1.2, 0.07, 0.2]} at={[0, 0.2, -0.3]} color="#575757" shadow={false} />
      <group ref={body} position={[0, 0.24, 0]}>
        <Box size={[0.8, 0.34, 0.7]} color="#f2b632" rounded={0.04} />
        <Box size={[0.32, 0.36, 0.4]} at={[-0.12, 0.34, 0.1]} color="#cfe9f7" />
        <Box size={[0.3, 0.3, 0.7]} at={[-0.5, 0, 0]} color="#8a8174" />
        <group ref={boom} position={[0.3, 0.3, 0]}>
          <Box size={[1.1, 0.14, 0.16]} at={[0.55, 0, 0]} color="#f2b632" />
          <group ref={stick} position={[1.1, 0, 0]}>
            <Box size={[0.8, 0.12, 0.14]} at={[0.4, 0, 0]} color="#e0a52a" />
            <Box size={[0.3, 0.24, 0.36]} at={[0.85, -0.08, 0]} color="#6d675f" />
          </group>
        </group>
      </group>
    </group>
  );
}

/** Short belt from the quarry up to the hopper, with rock chunks riding it; more of them, faster, when busy. */
function Conveyor({ from, to }: { from: Vec3; to: Vec3 }) {
  const motion = useMotion();
  const chunks = useRef<(Mesh | null)[]>([]);
  const { mid, len, q, legs } = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    return {
      mid: a.clone().add(b).multiplyScalar(0.5),
      len: b.clone().sub(a).length(),
      q: beltBasis(a, b),
      legs: [0.3, 0.7].map((f) => a.clone().lerp(b, f)),
    };
  }, [from, to]);
  useFrame(() => {
    const count = agentCount(motion, 8, 1);
    chunks.current.forEach((m, i) => {
      if (!m) return;
      m.visible = i < count;
      const u = (motion.t * 0.16 + i / 8) % 1;
      m.position.x = -len / 2 + u * len;
    });
  });
  return (
    <group>
      {/* local +x runs from the quarry up to the preheater */}
      <group position={mid} quaternion={q}>
        <Static>
          <Box size={[len, 0.14, 0.5]} at={[0, -0.07, 0]} color="#4d4740" />
          <Box size={[len, 0.05, 0.38]} at={[0, 0.07, 0]} color="#2f2b27" />
        </Static>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh
            key={i}
            ref={(el) => {
              chunks.current[i] = el;
            }}
            geometry={GEO.blob}
            material={mat('#b49a78')}
            position={[0, 0.2, 0]}
            scale={[0.15, 0.11, 0.14]}
            castShadow
          />
        ))}
      </group>
      <Static>
        {legs.map((p) => (
          <Box key={p.x} size={[0.12, p.y - 0.1, 0.12]} at={[p.x, 0, p.z]} color="#5f584f" />
        ))}
      </Static>
    </group>
  );
}

/** Feed hopper against the first preheater's front face: the quarry belt ends in it. */
function Hopper() {
  return (
    <Static>
      <Box size={[HOPPER.w, HOPPER.h, HOPPER.d]} at={[HOPPER.at[0], 0, HOPPER.at[1]]} color="#8a8174" />
      <Box size={[HOPPER.w + 0.12, 0.08, HOPPER.d + 0.12]} at={[HOPPER.at[0], HOPPER.h, HOPPER.at[1]]} color="#5f584f" />
    </Static>
  );
}

/** Bucket elevator (level 3): a slim column hugging the preheater's front face, buckets riding up it; more of them when busy. */
function Elevator({ h }: { h: number }) {
  const motion = useMotion();
  const buckets = useRef<(Mesh | null)[]>([]);
  const x = HOPPER.at[0];
  const z = 4.55;
  const base = HOPPER.h + 0.05;
  useFrame(() => {
    const count = agentCount(motion, 7, 2);
    buckets.current.forEach((m, i) => {
      if (!m) return;
      m.visible = i < count;
      m.position.y = base + ((motion.t * 0.14 + i / 7) % 1) * (h - base - 0.1);
    });
  });
  return (
    <group>
      <Static>
        <Box size={[0.42, h - base, 0.34]} at={[x, base, z]} color="#4d4740" />
        <Box size={[0.56, 0.24, 0.5]} at={[x, h, z - 0.04]} color="#8a8174" />
        {/* a few ties back to the tower */}
        {[0.35, 0.65].map((f) => (
          <Box key={f} size={[0.12, 0.1, 0.3]} at={[x, base + (h - base) * f, z - 0.3]} color="#8a8174" shadow={false} />
        ))}
      </Static>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            buckets.current[i] = el;
          }}
          geometry={GEO.box}
          material={mat('#b49a78')}
          position={[x + 0.25, base, z]}
          scale={[0.1, 0.16, 0.2]}
        />
      ))}
    </group>
  );
}

/** Chimney puffs: one lazy wisp when quiet, a thick plume when busy. */
function Smoke({ at }: { at: Vec3 }) {
  const motion = useMotion();
  const puffs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const count = agentCount(motion, 6, 1);
    puffs.current.forEach((m, i) => {
      if (!m) return;
      m.visible = i < count;
      const p = (motion.t * 0.22 + i / 6) % 1;
      m.position.set(p * 0.6, p * 2.6, -p * 0.3);
      m.scale.setScalar((0.18 + p * 0.45) * Math.sin(Math.PI * Math.min(1, p * 1.15)));
    });
  });
  return (
    <group position={at}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            puffs.current[i] = el;
          }}
          geometry={GEO.blob}
          material={mat('#ece8e0')}
        />
      ))}
    </group>
  );
}
