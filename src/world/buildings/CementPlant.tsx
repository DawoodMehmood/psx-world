import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial, Quaternion, Vector3, type Mesh } from 'three';
import { SITE_TIERS } from '../../config/companies';
import { HEALTH, type SlotState } from '../../engine/types';
import { MixerTruck, Workers, type Lane } from '../agents';
import { Box, Cone, Cyl, GEO, mat, Roof, Rope, TARP_BLUE, type Vec3 } from '../kit';
import { Static } from '../Static';
import { agentCount, useMotion } from '../motion';
import { BAY_Z, BayLines, BayVehicles, BUILD_W, ClosedBay, CREW, DOCK_X, isBuilt, openBays, runningCount, Slots, Weeds, type SlotDesign } from './shared';
import type { ArchetypeProps } from './types';

/*
 * Cement site on the shared plan (see shared.tsx): origin at the lot's back
 * corner, rows growing toward the camera.
 *
 *   back-left edge   a preheater tower per kiln line (the tallest parts), rows z 3.4 · 7.9 · 12
 *   kiln drums       run from each preheater toward the front-right, burner facing the camera
 *   back edge        the hall (low), behind the first kiln
 *   front of row 1   quarry and the conveyor up to the first preheater
 *   front-right      silos beside the truck strip, one bay each; loading wings add more toward the front
 *   between rows     clinker stockpiles (tier 2) and the clinker dome (tier 3), both low,
 *                    clear of the tall silos so nothing hides them
 */

const SILO_X = 10.6;
const SILO_R = 0.6;
const KILN_Z = [3.4, 7.9, 12.0];
const PREHEATER_X = 1.1;
const KILN_LEN = 4.6;
/** Drum center: from just in front of the preheater, running toward +x. */
const KILN_CX = 2.3 + KILN_LEN / 2;
/** Between the second and third kiln rows, where only a low drum stands in front of it. */
const DOME: [number, number] = [5.6, 9.95];

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
    at: DOME,
    w: 2.6,
    d: 2.4,
    h: 2.2,
    crane: [3.2, 10.0],
    built: () => <ClinkerDome />,
    partial: () => <Cyl r={1.15} h={0.5} at={[DOME[0], 0, DOME[1]]} color="#cfc8ba" />,
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
  const { health, tier, slots } = props;
  const h = HEALTH.indexOf(health);
  return (
    <group>
      <Hall h={h} />
      <KilnLine line={0} {...props} />
      <Quarry />
      <Conveyor from={[3.6, 0.3, 5.2]} to={[1.9, 2.6, 4.0]} />

      {/* the original two silos and bays */}
      {[0, 1].map((i) => (
        <SiloBay key={i} bay={i} {...props} />
      ))}

      {h <= 0 && <Weeds depth={SITE_TIERS.cement[tier - 1].depth} seed={props.seed} />}

      {/* tier 2 yard: clinker stockpiles between the kiln rows */}
      {tier >= 2 && (
        <Static>
          <Cone r={0.8} h={1} at={[8.7, 0, 9.1]} color="#9a948a" />
          <Cone r={0.6} h={0.8} at={[7.6, 0, 9.3]} color="#a8a196" />
        </Static>
      )}

      <Slots designs={SLOTS} props={props} />

      <BayVehicles bays={openBays(h, builtBays(slots)).map((b) => BAY_Z[b])} vehicle={() => <MixerTruck />} />
      <Workers lanes={LANES.slice(0, tier).flat()} max={Math.round((4 + tier * 3) * CREW[h])} />
    </group>
  );
}

/** The hall along the back edge, with boarded-up windows when struggling. */
function Hall({ h }: { h: number }) {
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
    <group position={[4.8, 0, 1.2]}>
      <Static>
      <Box size={[3.6, 2.2, 2.0]} color="#efe7d6" rounded={0.08} />
      {/* ridge along the hall's length */}
      <group position={[0, 2.2, 0]} rotation={[0, Math.PI / 2, 0]}>
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
      </Static>
    </group>
  );
}

/**
 * A silo with its loading spout over its own painted truck bay. Health shows
 * as a pennant (thriving), cones across the bay when it is closed, and
 * patches on the silo (struggling).
 */
function SiloBay({ bay, scale, accent, health, slots }: ArchetypeProps & { bay: number }) {
  const h = HEALTH.indexOf(health);
  const z = BAY_Z[bay];
  const closed = !openBays(h, builtBays(slots)).includes(bay);
  const siloH = 3 + scale * 1.5;
  const spoutY = 1.75;
  const armFrom = SILO_X + SILO_R - 0.1;
  const armTo = DOCK_X - 0.1;
  return (
    <Static>
      <Cyl r={SILO_R} h={siloH} at={[SILO_X, 0, z]} color="#e6e1d6" />
      <Cyl r={SILO_R + 0.02} h={0.2} at={[SILO_X, siloH * 0.78, z]} color={h <= 0 ? '#9a948a' : accent} />
      <Cone r={SILO_R} h={0.4} at={[SILO_X, siloH, z]} color="#cfc8ba" />
      {/* spout arm reaching over the bay */}
      <Box size={[armTo - armFrom, 0.14, 0.2]} at={[(armFrom + armTo) / 2, spoutY, z]} color="#8a8174" />
      <Cyl r={0.08} h={0.4} at={[armTo, spoutY - 0.4, z]} color="#5f584f" low />
      <BayLines z={z} />
      {h <= 0 && <Box size={[0.05, 0.6, 0.45]} at={[SILO_X + SILO_R + 0.01, siloH * 0.3, z]} color="#a39d92" shadow={false} />}
      {closed && <ClosedBay z={z} />}
      {h >= 4 && (
        <group position={[SILO_X, siloH + 0.4, z]}>
          <Cyl r={0.03} h={0.7} color="#f2efe6" low shadow={false} />
          <Box size={[0.04, 0.24, 0.36]} at={[0, 0.42, 0.2]} color={accent} shadow={false} />
        </group>
      )}
    </Static>
  );
}

/** Two more silo bays under a shared canopy over the truck strip. */
function LoadingWing({ bays, ...p }: ArchetypeProps & { bays: number[] }) {
  const z = (BAY_Z[bays[0]] + BAY_Z[bays[1]]) / 2;
  const span = BAY_Z[bays[1]] - BAY_Z[bays[0]] + 1.2;
  return (
    <group>
      {bays.map((i) => (
        <SiloBay key={i} bay={i} {...p} />
      ))}
      <Static>
        <Box size={[2.4, 0.12, span]} at={[BUILD_W + 1.25, 2.3, z]} color={p.accent} rounded={0.04} />
        {[BUILD_W + 0.15, BUILD_W + 2.35].flatMap((x) => [z - span / 2 + 0.1, z + span / 2 - 0.1].map((pz) => <Box key={`${x}${pz}`} size={[0.1, 2.3, 0.1]} at={[x, 0, pz]} color="#8a8174" />))}
      </Static>
    </group>
  );
}

/**
 * A kiln line: preheater tower on the back-left edge, drum on piers running
 * toward the front-right, burner hood at the front end. A mothballed line has
 * a cold burner, no smoke, and its drum wrapped in a tarp.
 */
function KilnLine({ line, scale, accent, seed, health, slots, bare = false }: ArchetypeProps & { line: number; bare?: boolean }) {
  const towerH = 4 + scale * 1.5;
  const y = 1.15;
  const z = KILN_Z[line];
  const mothballed = !bare && line >= runningCount(HEALTH.indexOf(health), builtKilns(slots));
  const burnerX = KILN_CX + KILN_LEN / 2 + 0.45;
  return (
    <group>
      <group position={[KILN_CX, 0, z]}>
        <Kiln at={[0, y, 0]} length={KILN_LEN} r={0.5} piers={[-1.6, 0, 1.6]} color={bare ? '#c9c2b6' : accent} bare={bare} wrapped={mothballed} />
        {!bare && <KilnGlow at={[KILN_LEN / 2 + 0.25, y - 0.55, 0]} seed={seed + line} cold={mothballed} />}
      </group>
      <Preheater z={z} h={bare ? towerH * 0.45 : towerH} accent={accent} stack={!bare} smoke={!bare && !mothballed} />
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

function Preheater({ z, h, accent, stack, smoke }: { z: number; h: number; accent: string; stack: boolean; smoke: boolean }) {
  const x = PREHEATER_X;
  return (
    <group>
      <Static>
        <Box size={[1.7, h, 1.7]} at={[x, 0, z]} color="#d8d0c0" rounded={0.08} />
        {[0.3, 0.55, 0.8].map((f) => (
          <Box key={f} size={[1.85, 0.16, 1.85]} at={[x, h * f, z]} color="#8a8174" />
        ))}
        {stack && (
          <>
            <Cyl r={0.24} h={1.4} at={[x - 0.3, h, z - 0.3]} color="#b9b1a3" />
            <Cyl r={0.26} h={0.18} at={[x - 0.3, h + 1.24, z - 0.3]} color={smoke ? accent : '#8a8174'} />
          </>
        )}
      </Static>
      {stack && smoke && <Smoke at={[x - 0.3, h + 1.42, z - 0.3]} />}
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

/** Burner hood at the kiln's low end; glows hotter with activity and sputters when volatile. Dark when `cold`. */
function KilnGlow({ at, seed, cold = false }: { at: Vec3; seed: number; cold?: boolean }) {
  const motion = useMotion();
  const glow = useMemo(() => new MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 0.6, flatShading: true }), []);
  useFrame(({ clock }) => {
    const sputter = motion.jitter > 0 ? 0.6 + 0.4 * Math.sin(clock.elapsedTime * 13 + seed) : 1;
    glow.emissiveIntensity = motion.halted ? 0.05 : (0.25 + motion.intensity * 1.6) * sputter;
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

/** Domed clinker store (tier 3). */
function ClinkerDome() {
  return (
    <group position={[DOME[0], 0, DOME[1]]}>
      <Static>
      <Cyl r={1.2} h={0.5} color="#cfc8ba" />
      <mesh geometry={GEO.dome} material={mat('#e6e1d6')} position={[0, 0.5, 0]} scale={[1.15, 1.1, 1.15]} castShadow receiveShadow />
      <Box size={[0.5, 0.6, 0.06]} at={[0, 0.2, 1.18]} color="#7d756a" shadow={false} />
      </Static>
    </group>
  );
}

/** The quarry pit at the front of the first row, where the conveyor starts. */
function Quarry() {
  return (
    <Static>
      <Box size={[2.6, 0.06, 1.3]} at={[4.6, 0, 5.25]} color="#9c8466" shadow={false} />
      {(
        [
          [4.2, 5.3, 0.42],
          [5.1, 5.0, 0.35],
          [5.6, 5.5, 0.3],
        ] as Vec3[]
      ).map(([x, z, r]) => (
        <mesh key={x + z} geometry={GEO.blob} material={mat('#b49a78')} position={[x, r * 0.6, z]} scale={[r * 1.3, r, r * 1.2]} castShadow />
      ))}
    </Static>
  );
}

const ALONG = new Vector3(1, 0, 0);

/** Belt from the quarry up to the first preheater, with rock chunks riding it; more of them, faster, when busy. */
function Conveyor({ from, to }: { from: Vec3; to: Vec3 }) {
  const motion = useMotion();
  const chunks = useRef<(Mesh | null)[]>([]);
  const { mid, len, q, legs } = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const dir = b.clone().sub(a);
    return {
      mid: a.clone().add(b).multiplyScalar(0.5),
      len: dir.length(),
      q: new Quaternion().setFromUnitVectors(ALONG, dir.normalize()),
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
