import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, DoubleSide, Vector3, type Group, type Mesh } from 'three';
import { SITE_TIERS } from '../../config/companies';
import { HEALTH } from '../../engine/types';
import { Van, Workers, type Lane } from '../agents';
import { Box, Cone, Cyl, GEO, mat, Rope, Tree, type Vec3 } from '../kit';
import { agentCount, useMotion } from '../motion';
import { ActivityWindows, BAY_Z, BayLines, BayVehicles, BUILD_W, ClosedBay, CREW, closedByDecline, isBuilt, openBays, Slots, TIER_BAYS, ToLet, Weeds, type SlotDesign } from './shared';
import type { ArchetypeProps } from './types';

/*
 * Tech campus on the shared plan (see shared.tsx): origin at the lot's back
 * corner, rows growing toward the camera, all on a lawn.
 *
 *   back corner     the glass HQ tower (tallest)
 *   back edge       the telecom mast, its network line running to the first data center
 *   row 1 front     pad: a data center, server lights facing the camera
 *   back-left edge  an office block (tier 2) and a glass lab dome (tier 3)
 *   rows 2 and 3    a data center each; a café (tier 2) and a dish farm (tier 3) by the courier bays
 *
 * Activity drives the data pulses along the network line, the server lights,
 * lit windows and, when busy, delivery drones. Decline closes the front-most
 * buildings first: servers go dark and a TO LET board goes up. The HQ never closes.
 */

const LAWN = '#9ed98a';
const HQ: [number, number] = [2.2, 2.2];
const MAST: [number, number] = [9.4, 1.0];
const DC1: [number, number] = [6.6, 4.8];
const DC2: [number, number] = [6.6, 8.4];
const DC3: [number, number] = [6.6, 12.4];
const OFFICE: [number, number] = [1.6, 7.8];
const DOME: [number, number] = [2.1, 12.0];
const DISHES: [number, number] = [9.9, 12.8];

const LANES: Lane[][] = [
  [
    [4.2, 0.6, 4.2, 3.6],
    [10.9, 0.5, 10.9, 5.6],
  ],
  [
    [3.4, 6.2, 10.6, 6.2],
    [10.9, 6.4, 10.9, 9.6],
  ],
  [
    [3.6, 10.3, 10.6, 10.3],
    [10.9, 10.4, 10.9, 13.6],
  ],
];

const SLOTS: SlotDesign[] = [
  {
    at: DC1,
    w: 4.6,
    d: 1.9,
    h: 1.8,
    crane: [10.4, 4.8],
    built: (p) => <DataCenter at={DC1} {...p} closed={closedFrom(p, 1)} />,
    partial: () => <Box size={[4.4, 0.8, 1.7]} at={[DC1[0], 0, DC1[1]]} color="#9aa3ab" />,
  },
  {
    at: OFFICE,
    w: 2.6,
    d: 3.6,
    h: 4,
    crane: [3.6, 6.4],
    built: (p) => <OfficeBlock {...p} closed={closedFrom(p, 2)} />,
    partial: () => <Box size={[1.4, 2.4, 2.2]} at={[OFFICE[0], 0, OFFICE[1]]} color="#c8c2b6" />,
  },
  {
    at: DC2,
    w: 4.6,
    d: 2.1,
    h: 1.8,
    crane: [3.6, 9.6],
    built: (p) => <DataCenter at={DC2} {...p} seed={p.seed + 4} closed={closedFrom(p, 3)} />,
    partial: () => <Box size={[4.4, 0.8, 1.9]} at={[DC2[0], 0, DC2[1]]} color="#9aa3ab" />,
  },
  {
    at: DOME,
    w: 3.0,
    d: 3.0,
    h: 2.8,
    crane: [4.0, 13.8],
    built: (p) => <LabDome {...p} closed={closedFrom(p, 4)} />,
    partial: () => <Cyl r={1.3} h={0.6} at={[DOME[0], 0, DOME[1]]} color="#c8c2b6" />,
  },
  {
    at: DC3,
    w: 4.6,
    d: 2.1,
    h: 1.8,
    crane: [6.6, 10.6],
    built: (p) => <DataCenter at={DC3} {...p} seed={p.seed + 8} closed={closedFrom(p, 5)} />,
    partial: () => <Box size={[4.4, 0.8, 1.9]} at={[DC3[0], 0, DC3[1]]} color="#9aa3ab" />,
  },
  {
    at: DISHES,
    w: 2.4,
    d: 2.4,
    h: 2.2,
    crane: [10.6, 10.8],
    built: (p) => <DishFarm {...p} closed={closedFrom(p, 6)} />,
    partial: () => (
      <group position={[DISHES[0], 0, DISHES[1]]}>
        {[
          [-0.6, -0.5],
          [0.5, 0.6],
        ].map(([x, z]) => (
          <Box key={x} size={[0.8, 0.3, 0.8]} at={[x, 0, z]} color="#8e9a9f" />
        ))}
      </group>
    ),
  },
];

/** Slots in the order they close when health falls: front-most first, the office block and first data center last. */
const CLOSE_ORDER = [4, 3, 5, 2, 1, 0];

/** Whether the building at this position in build order (1 = slot 0) is closed by decline. The HQ (0) never closes. */
function closedFrom(p: ArchetypeProps, order: number): boolean {
  return closedByDecline(p, order - 1, CLOSE_ORDER);
}

export function TechCampus(props: ArchetypeProps) {
  const { scale, accent, seed, health, tier, slots } = props;
  const h = HEALTH.indexOf(health);
  const depth = SITE_TIERS.tech[tier - 1].depth;
  const floors = Math.round(4 + scale * 6);
  const towerH = floors * 0.9 + 0.4;
  const bays = BAY_Z.slice(0, TIER_BAYS[tier - 1]);
  const open = openBays(h, bays);
  const serversBuilt = isBuilt(slots, 0);
  const serversUp = serversBuilt && !closedFrom(props, 1);
  const [hx, hz] = HQ;
  return (
    <group>
      {/* lawn over the build area, and a path from the HQ door */}
      <Box size={[BUILD_W - 0.2, 0.04, depth - 0.2]} at={[BUILD_W / 2, 0, depth / 2]} color={LAWN} shadow={false} />
      <Box size={[0.8, 0.06, 2.0]} at={[hx, 0, hz + 2.7]} color="#eef1ee" shadow={false} />

      {/* HQ tower at the back corner */}
      <Box size={[3.4, towerH, 3.4]} at={[hx, 0, hz]} color="#9fd3ee" rounded={0.2} />
      <ActivityWindows at={[hx, 0, hz]} w={3.4} d={3.4} floors={floors - 1} floorHeight={0.9} baseHeight={0.5} cols={4} seed={seed} litColor="#fff3b0" darkColor="#5f9fc6" />
      <Cyl r={1.95} h={0.3} at={[hx, towerH, hz]} color={accent} />
      <Cyl r={1.1} h={0.5} at={[hx, towerH + 0.3, hz]} color="#e9f4f8" />
      <Cyl r={0.05} h={1.2} at={[hx, towerH + 0.8, hz]} color="#cfd8dc" low />

      <Antenna at={MAST} />
      {/* the line runs to the front data center, so it goes in once that is built */}
      {serversBuilt && <NetworkLine on={serversUp} accent={accent} />}
      <Drones center={HQ} y={towerH + 1.6} />

      {bays.map((z) => (
        <group key={z}>
          <BayLines z={z} color="#f7f4ec" />
          {!open.includes(z) && <ClosedBay z={z} />}
        </group>
      ))}
      <BayVehicles bays={open} vehicle={(i) => <Van color={i % 2 === 0 ? accent : '#f2b632'} />} />

      {tier >= 2 && (
        <>
          <Cafe at={[9.8, 6.8]} accent={accent} closed={h <= 0} />
          <Tree at={[4.0, 0, 9.8]} size={0.75} color="#3fa66b" />
        </>
      )}
      {tier >= 3 && (
        <>
          <Tree at={[4.4, 0, 10.6]} size={0.7} color="#3fa66b" />
          <Tree at={[9.2, 0, 10.6]} size={0.65} color="#3fa66b" />
        </>
      )}

      <Slots designs={SLOTS} props={props} />

      <Workers lanes={LANES.slice(0, tier).flat()} max={Math.round((4 + tier * 3) * CREW[h])} office />
      {h <= 0 && <Weeds depth={depth} seed={seed} colors={['#b5c76a', '#a3b85a', '#c3d27a']} />}
    </group>
  );
}

/** Low data center, server lights blinking on its front face; dark when closed. */
function DataCenter({ at, accent, seed, closed }: ArchetypeProps & { at: [number, number]; closed: boolean }) {
  const motion = useMotion();
  const lights = useRef<Group>(null);
  useFrame(() => {
    if (!lights.current) return;
    const t = motion.t * (1 + motion.intensity * 3);
    lights.current.children.forEach((child, i) => {
      child.visible = !closed && Math.sin(t * (2 + (i % 3)) + i * 1.7 + seed) > 0.4 - motion.intensity * 1.2;
    });
  });
  const [x, z] = at;
  return (
    <group position={[x, 0, z]}>
      <Box size={[4.4, 1.6, 1.7]} color="#5c6670" rounded={0.1} />
      <Box size={[4.5, 0.2, 1.8]} at={[0, 1.6, 0]} color="#47505a" />
      {[-1.4, -0.2, 1.0].map((cx) => (
        <Box key={cx} size={[0.6, 0.35, 0.6]} at={[cx, 1.8, -0.3]} color="#8a959e" />
      ))}
      <Box size={[4.4, 0.18, 0.06]} at={[0, 1.25, 0.86]} color={closed ? '#8a959e' : accent} shadow={false} />
      <group ref={lights}>
        {Array.from({ length: 15 }, (_, i) => (
          <Box
            key={i}
            size={[0.18, 0.1, 0.04]}
            at={[-1.9 + Math.floor(i / 3) * 0.95, 0.3 + (i % 3) * 0.28, 0.87]}
            color={i % 4 === 0 ? '#ffb340' : '#5cf2a0'}
            glow={1.2}
            shadow={false}
          />
        ))}
      </group>
      {closed && <ToLet at={[0.9, 0.35, 0.92]} w={1.6} />}
    </group>
  );
}

function OfficeBlock({ scale, accent, seed, closed }: ArchetypeProps & { closed: boolean }) {
  const floors = Math.round(3 + scale * 3);
  const hgt = floors * 0.9 + 0.4;
  return (
    <group>
      <Box size={[2.4, hgt, 3.4]} at={[OFFICE[0], 0, OFFICE[1]]} color="#f4f6f7" rounded={0.15} />
      <ActivityWindows at={[OFFICE[0], 0, OFFICE[1]]} w={2.4} d={3.4} floors={floors - 1} floorHeight={0.9} baseHeight={0.5} cols={3} seed={seed + 3} closed={closed} darkColor="#7fb2cf" />
      <Box size={[2.5, 0.3, 3.5]} at={[OFFICE[0], hgt, OFFICE[1]]} color={closed ? '#a7a196' : accent} rounded={0.1} />
      {closed && <ToLet at={[OFFICE[0], 0.6, OFFICE[1] + 1.76]} w={1.0} />}
    </group>
  );
}

/** Glass lab dome on a ring of accent. */
function LabDome({ accent, closed }: ArchetypeProps & { closed: boolean }) {
  return (
    <group position={[DOME[0], 0, DOME[1]]}>
      <Cyl r={1.4} h={0.5} color="#e9f4f8" />
      <Cyl r={1.42} h={0.14} at={[0, 0.5, 0]} color={closed ? '#a7a196' : accent} shadow={false} />
      <mesh geometry={GEO.dome} material={mat(closed ? '#8fa6b3' : '#9fd3ee', closed ? 0 : 0.15)} position={[0, 0.6, 0]} scale={[1.35, 1.6, 1.35]} castShadow />
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} position={[0, 0.6, 0]} rotation={[0, r, 0]} scale={[1.37, 1.62, 1.37]}>
          <torusGeometry args={[1, 0.02, 4, 24, Math.PI]} />
          <meshStandardMaterial color="#e9f4f8" />
        </mesh>
      ))}
      {closed && <ToLet at={[0.4, 0.15, 1.42]} w={0.9} />}
    </group>
  );
}

/** Three satellite dishes; parked face-up and grey when closed. */
function DishFarm({ accent, closed }: ArchetypeProps & { closed: boolean }) {
  const spots: [number, number, number][] = [
    [-0.6, -0.5, 0.75],
    [0.5, 0.6, 0.75],
    [0.6, -0.6, 0.5],
  ];
  return (
    <group position={[DISHES[0], 0, DISHES[1]]}>
      {spots.map(([x, z, r], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box size={[0.8, 0.3, 0.8]} color="#8e9a9f" />
          <Cyl r={0.08} h={0.8} at={[0, 0.3, 0]} color="#cfd8dc" low />
          <group position={[0, 1.15, 0]} rotation={closed ? [0, 0, 0] : [0.5, 0.6 + i, 0]}>
            <Cone r={r} h={0.3} rot={[Math.PI, 0, 0]} color={closed ? '#b9b9b9' : '#f7f7f7'} />
            <Cyl r={0.05} h={0.4} color={closed ? '#8e9a9f' : accent} low />
          </group>
        </group>
      ))}
      {closed && <ToLet at={[-0.4, 0.4, 1.2]} w={0.9} />}
    </group>
  );
}

const MAST_H = 5.4;
const MAST_SECTIONS = 6;
const MAST_BASE = 0.55;
const MAST_TOP = 0.16;

/**
 * Telecom mast: an open lattice in red and white bands, tapering up to a work
 * platform with panel antennas, a microwave dish on a bracket off the front
 * face, and a blinking red light on top. An equipment cabinet stands at its foot.
 */
export function Antenna({ at }: { at: [number, number] }) {
  const sections = useMemo(() => {
    const out: { from: Vec3; to: Vec3; r: number; color: string }[] = [];
    const half = (y: number) => MAST_BASE + (MAST_TOP - MAST_BASE) * (y / MAST_H);
    const corners: [number, number][] = [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ];
    for (let i = 0; i < MAST_SECTIONS; i++) {
      const y0 = (i * MAST_H) / MAST_SECTIONS;
      const y1 = ((i + 1) * MAST_H) / MAST_SECTIONS;
      const a0 = half(y0);
      const a1 = half(y1);
      const color = i % 2 === 0 ? '#e2463e' : '#f4f1ea';
      corners.forEach(([sx, sz], c) => {
        const [nx, nz] = corners[(c + 1) % 4];
        // leg, ring at the top of the section, and one diagonal brace per face
        out.push({ from: [sx * a0, y0, sz * a0], to: [sx * a1, y1, sz * a1], r: 0.045, color });
        out.push({ from: [sx * a1, y1, sz * a1], to: [nx * a1, y1, nz * a1], r: 0.03, color });
        out.push({ from: [sx * a0, y0, sz * a0], to: [nx * a1, y1, nz * a1], r: 0.022, color });
      });
    }
    return out;
  }, []);
  const beacon = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.visible = clock.elapsedTime % 1.6 < 0.8;
  });
  const deck = MAST_H - 0.9;
  const dishY = deck - 0.8;
  const faceZ = MAST_BASE + (MAST_TOP - MAST_BASE) * (dishY / MAST_H);
  return (
    <group position={[at[0], 0, at[1]]}>
      <Box size={[1.4, 0.2, 1.4]} color="#b9bfc2" />
      {/* equipment cabinet */}
      <Box size={[0.5, 0.6, 0.35]} at={[0.35, 0.2, 0.75]} color="#d8dde0" rounded={0.04} />
      <Box size={[0.3, 0.06, 0.02]} at={[0.35, 0.55, 0.93]} color="#5cf2a0" glow={0.8} shadow={false} />

      <group position={[0, 0.2, 0]}>
        {sections.map((m, i) => (
          <Rope key={i} from={m.from} to={m.to} r={m.r} color={m.color} />
        ))}
        {/* work platform with three panel antennas */}
        <Box size={[0.75, 0.06, 0.75]} at={[0, deck, 0]} color="#8e9a9f" shadow={false} />
        {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => (
          <group key={a} rotation={[0, a + Math.PI / 4, 0]}>
            <Box size={[0.08, 0.65, 0.24]} at={[0.36, deck + 0.1, 0]} color="#f7f7f7" rounded={0.02} />
          </group>
        ))}
        {/* microwave dish on a bracket, standing off the front face so it clears the legs */}
        <group position={[0, dishY, 0]}>
          {[-0.12, 0.12].map((y) => (
            <Box key={y} size={[0.06, 0.06, 0.42]} at={[0, y - 0.03, faceZ + 0.18]} color="#8e9a9f" shadow={false} />
          ))}
          <Box size={[0.1, 0.36, 0.08]} at={[0, -0.18, faceZ + 0.38]} color="#8e9a9f" shadow={false} />
          {/* bowl: a shallow hemisphere, back toward the mast, opening outward */}
          <mesh geometry={GEO.dome} position={[0, 0, faceZ + 0.62]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.36, 0.2, 0.36]} castShadow>
            <meshStandardMaterial color="#f4f6f7" roughness={0.85} flatShading side={DoubleSide} />
          </mesh>
          <Cyl r={0.37} h={0.04} at={[0, 0, faceZ + 0.62]} rot={[Math.PI / 2, 0, 0]} color="#d8dde0" center shadow={false} />
          {/* feed horn on three struts */}
          {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => (
            <Rope key={a} from={[Math.cos(a) * 0.32, Math.sin(a) * 0.32, faceZ + 0.63]} to={[0, 0, faceZ + 0.9]} r={0.012} color="#8e9a9f" />
          ))}
          <Box size={[0.08, 0.08, 0.08]} at={[0, -0.04, faceZ + 0.92]} color="#5f6a70" shadow={false} />
        </group>
        {/* top spike and light */}
        <Cyl r={0.03} h={0.7} at={[0, MAST_H, 0]} color="#cfd8dc" low />
        <mesh ref={beacon} geometry={GEO.ball} material={mat('#ff3b30', 1.6)} position={[0, MAST_H + 0.75, 0]} scale={0.09} />
      </group>
    </group>
  );
}

/**
 * Network line from the antenna to the front data center, on short poles.
 * Glowing pulses run along it: more and faster with Activity, none while the
 * data center is closed.
 */
function NetworkLine({ on, accent }: { on: boolean; accent: string }) {
  const motion = useMotion();
  const pulses = useRef<(Mesh | null)[]>([]);
  const curve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(MAST[0] + 0.1, 2.2, MAST[1] + 0.5),
        new Vector3(MAST[0] + 0.2, 2.0, MAST[1] + 1.8),
        new Vector3(MAST[0] - 0.1, 1.9, MAST[1] + 2.8),
        new Vector3(DC1[0] + 1.8, 1.85, DC1[1] - 0.4),
      ]),
    [],
  );
  const cable = useMemo(() => curve.getPoints(24), [curve]);
  useFrame(() => {
    const count = on ? agentCount(motion, 6, 1) : 0;
    pulses.current.forEach((m, i) => {
      if (!m) return;
      m.visible = i < count;
      if (!m.visible) return;
      const u = (motion.t * 0.35 + i / 6) % 1;
      m.position.copy(curve.getPointAt(u));
    });
  });
  return (
    <group>
      {cable.slice(0, -1).map((p, i) => (
        <Rope key={i} from={[p.x, p.y, p.z]} to={[cable[i + 1].x, cable[i + 1].y, cable[i + 1].z]} color="#3a3f4a" r={0.03} />
      ))}
      {[1.8, 2.8].map((dz, i) => (
        <Cyl key={dz} r={0.05} h={2.0 - i * 0.1} at={[MAST[0] + 0.2 - i * 0.3, 0, MAST[1] + dz]} color="#8e9a9f" low />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            pulses.current[i] = el;
          }}
          geometry={GEO.ball}
          material={mat(accent, 1.4)}
          scale={0.13}
        />
      ))}
    </group>
  );
}

/** Delivery drones circling the HQ; they come out only when busy. */
function Drones({ center, y }: { center: [number, number]; y: number }) {
  const motion = useMotion();
  const refs = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    const count = motion.intensity > 0.6 ? Math.round((motion.intensity - 0.5) * 6) : 0;
    refs.current.forEach((g, i) => {
      if (!g) return;
      g.visible = i < count;
      if (!g.visible) return;
      const a = motion.t * 0.5 + (i * Math.PI * 2) / 3;
      const r = 2.6 + i * 0.5;
      g.position.set(center[0] + Math.cos(a) * r, y + i * 0.6 + Math.sin(clock.elapsedTime * 3 + i) * 0.08, center[1] + Math.sin(a) * r);
      g.rotation.y = -a;
    });
  });
  return (
    <>
      {Array.from({ length: 3 }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <Box size={[0.36, 0.12, 0.36]} at={[0, -0.06, 0]} color="#3a3f4a" shadow={false} />
          {[
            [0.24, 0.24],
            [-0.24, 0.24],
            [0.24, -0.24],
            [-0.24, -0.24],
          ].map(([x, z]) => (
            <Cyl key={`${x}${z}`} r={0.12} h={0.02} at={[x, 0.06, z]} color="#cfd8dc" low shadow={false} />
          ))}
          <Box size={[0.2, 0.18, 0.2]} at={[0, -0.28, 0]} color="#f2b632" shadow={false} />
        </group>
      ))}
    </>
  );
}

/** A small café with a striped awning and parasols; closed (awning grey) when struggling. */
function Cafe({ at, accent, closed }: { at: [number, number]; accent: string; closed: boolean }) {
  const [x, z] = at;
  return (
    <group position={[x, 0, z]}>
      <Box size={[1.6, 1.2, 1.2]} color="#f4ecdc" rounded={0.08} />
      <Box size={[1.8, 0.1, 0.6]} at={[0, 1.1, 0.85]} rot={[0.3, 0, 0]} color={closed ? '#a7a196' : accent} shadow={false} />
      <Box size={[1.0, 0.5, 0.05]} at={[0, 0.3, 0.61]} color={closed ? '#5a554e' : '#cfe9f7'} shadow={false} />
      {!closed &&
        [-0.6, 0.6].map((px) => (
          <group key={px} position={[px, 0, 1.6]}>
            <Cyl r={0.03} h={1.0} color="#8e9a9f" low shadow={false} />
            <Cone r={0.45} h={0.25} at={[0, 0.95, 0]} color={accent} />
            <Cyl r={0.22} h={0.05} at={[0, 0.45, 0]} color="#f7f7f7" low shadow={false} />
          </group>
        ))}
    </group>
  );
}
