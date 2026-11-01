import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial, type Group, type Mesh } from 'three';
import { SITE_TIERS } from '../../config/companies';
import { HEALTH, type SlotState } from '../../engine/types';
import { Tanker, Workers, type Lane } from '../agents';
import { Box, Cone, Cyl, Roof, type Vec3 } from '../kit';
import { Static } from '../Static';
import { useMotion } from '../motion';
import { BAY_Z, BayLines, BayVehicles, BUILD_W, ClosedBay,  DOCK_X, isBuilt, openBays, runningCount, Slots, TIER_BAYS, Weeds, type SlotDesign } from './shared';
import { crewMax } from '../../engine/visual';
import type { ArchetypeProps } from './types';

/*
 * Oil field on the shared plan (see shared.tsx): origin at the lot's back
 * corner, rows growing toward the camera.
 *
 *   back corner     the drilling rig (tallest)
 *   back edge       control hut and the flare stack
 *   front-right     the first tank, beside the tanker bays
 *   front of rows   pumpjacks: two in row 1 (one a tier-1 pad), one more in each later row
 *   back-left edge  a separator (tier 2) and the gas processing unit (tier 3, tall)
 *   toward the front tank pairs (tiers 2 and 3)
 *
 * Activity sets the pumpjacks' pace, the flare's size and the tanker traffic.
 * Decline shuts in the newest pumpjacks first; struggling puts the flare out,
 * rusts the tanks and lets dry scrub into the yard.
 */

/** Pumpjacks in build order: the first is there from the start, then slots 0, 1 and 3. */
const PUMPJACKS: [number, number][] = [
  [3.4, 5.0],
  [7.0, 5.0],
  [4.0, 9.2],
  [5.0, 12.8],
];
const PUMPJACK_SLOT = [-1, 0, 1, 3];
const DRY_SCRUB = ['#b8a55a', '#a39248', '#c7b46a'];
const DERRICK: [number, number] = [2.2, 2.2];
const PROCESSING: [number, number] = [2.2, 11.4];

const LANES: Lane[][] = [
  [
    [10.9, 0.5, 10.9, 5.6],
    [1.2, 5.8, 10.6, 5.8],
  ],
  [
    [10.9, 6.4, 10.9, 9.6],
    [2.4, 9.9, 10.6, 9.9],
  ],
  [
    [10.9, 10.4, 10.9, 13.6],
    [3.8, 13.8, 10.6, 13.8],
  ],
];

const SLOTS: SlotDesign[] = [
  {
    at: PUMPJACKS[1],
    w: 2.2,
    d: 1.0,
    h: 1.8,
    crane: [7.4, 3.0],
    built: (p) => <PumpjackUnit index={1} {...p} />,
    partial: () => <PumpjackBase at={PUMPJACKS[1]} />,
  },
  {
    at: PUMPJACKS[2],
    w: 2.2,
    d: 1.0,
    h: 1.8,
    crane: [2.8, 7.0],
    built: (p) => <PumpjackUnit index={2} {...p} />,
    partial: () => <PumpjackBase at={PUMPJACKS[2]} />,
  },
  {
    at: [8.2, 8.4],
    w: 4.6,
    d: 2.1,
    h: 2.2,
    crane: [10.6, 6.8],
    built: (p) => <TankPair at={[8.2, 8.4]} {...p} />,
    partial: () => <TankPair at={[8.2, 8.4]} bare />,
  },
  {
    at: PUMPJACKS[3],
    w: 2.2,
    d: 1.0,
    h: 1.8,
    crane: [5.0, 10.8],
    built: (p) => <PumpjackUnit index={3} {...p} />,
    partial: () => <PumpjackBase at={PUMPJACKS[3]} />,
  },
  {
    at: PROCESSING,
    w: 2.6,
    d: 3.8,
    h: 4.5,
    crane: [4.4, 10.2],
    built: (p) => <ProcessingUnit {...p} />,
    partial: () => (
      <group position={[PROCESSING[0], 0, PROCESSING[1]]}>
        <Box size={[2.4, 0.3, 3.6]} color="#9a948a" />
        {[1.0, -0.4].map((z) => (
          <Cyl key={z} r={0.42} h={1.8} at={[-0.4, 0.3, z]} color="#cfc8ba" />
        ))}
      </group>
    ),
  },
  {
    at: [8.4, 12.4],
    w: 4.6,
    d: 2.1,
    h: 2.2,
    crane: [10.8, 10.6],
    built: (p) => <TankPair at={[8.4, 12.4]} {...p} />,
    partial: () => <TankPair at={[8.4, 12.4]} bare />,
  },
];

function builtPumpjacks(slots: SlotState[]): number {
  return PUMPJACK_SLOT.filter((s) => s < 0 || isBuilt(slots, s)).length;
}

export function OilField(props: ArchetypeProps) {
  const { scale, accent, seed, health, tier } = props;
  const h = HEALTH.indexOf(health);
  const derrickH = 5 + scale * 2.5;
  const bays = BAY_Z.slice(0, TIER_BAYS[tier - 1]);
  const open = openBays(h, bays);
  const [dx, dz] = DERRICK;
  return (
    <group>
      {/* drilling rig at the back corner */}
      <Box size={[2.8, 0.5, 2.8]} at={[dx, 0, dz]} color="#8d8478" rounded={0.08} />
      <mesh position={[dx, 0.5 + derrickH / 2, dz]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 1.4, derrickH, 4, 1]} />
        <meshStandardMaterial color="#d8463b" roughness={0.85} flatShading />
      </mesh>
      {[0.25, 0.5, 0.75].map((f) => {
        const r = 1.4 - (1.4 - 0.35) * f + 0.05;
        return (
          <mesh key={f} position={[dx, 0.5 + derrickH * f, dz]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <cylinderGeometry args={[r - 0.03, r, 0.22, 4, 1]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.85} flatShading />
          </mesh>
        );
      })}
      <Box size={[0.9, 0.5, 0.9]} at={[dx, 0.5 + derrickH, dz]} color={accent} rounded={0.06} />

      {/* control hut and flare stack along the back edge */}
      <Static>
        <Box size={[1.8, 1.3, 1.2]} at={[5.6, 0, 1.2]} color="#ece3cf" rounded={0.08} />
        <Roof w={2.0} d={1.4} h={0.5} at={[5.6, 1.3, 1.2]} color={accent} />
        <Box size={[1.0, 0.4, 0.06]} at={[5.6, 0.6, 1.82]} color={h <= 0 ? '#5a554e' : '#8fb4cf'} shadow={false} />
      </Static>
      <Flare at={[8.4, 1.0]} lit={h >= 1} />

      {/* the first tank, beside the tanker bays */}
      <Tank at={[9.7, 3.6]} accent={accent} rusty={h <= 0} />

      {/* pipeline from the pumpjacks to the tank */}
      <Static>
        <Cyl r={0.1} h={6.4} at={[5.6, 0.3, 4.2]} rot={[0, 0, Math.PI / 2]} color="#c9a347" low center />
        {[2.6, 8.6].map((x) => (
          <Box key={x} size={[0.18, 0.25, 0.25]} at={[x, 0, 4.2]} color="#7b7368" />
        ))}
      </Static>

      <PumpjackUnit index={0} {...props} />

      {/* tanker bays with a loading arm over each */}
      {bays.map((z) => (
        <Static key={z}>
          <BayLines z={z} />
          <Box size={[0.16, 1.9, 0.16]} at={[BUILD_W + 0.15, 0, z - 0.5]} color="#7b7368" />
          <Box size={[DOCK_X - BUILD_W - 0.15, 0.12, 0.12]} at={[(BUILD_W + 0.15 + DOCK_X) / 2, 1.85, z - 0.5]} color="#c9a347" />
          <Cyl r={0.05} h={0.5} at={[DOCK_X, 1.35, z - 0.5]} color="#5f584f" low />
          {!open.includes(z) && <ClosedBay z={z} />}
        </Static>
      ))}
      <BayVehicles bays={open} vehicle={(i) => <Tanker cab={i % 2 === 0 ? accent : '#f2b632'} />} />

      {tier >= 2 && (
        <Static>
          {/* pipe rack across the yard and a separator vessel on the back-left edge */}
          <Cyl r={0.09} h={9.8} at={[5.7, 0.9, 6.3]} rot={[0, 0, Math.PI / 2]} color="#c9a347" low center />
          {[1.6, 5.7, 9.8].map((x) => (
            <Box key={x} size={[0.12, 0.9, 0.5]} at={[x, 0, 6.3]} color="#7b7368" />
          ))}
          <group position={[1.2, 0, 7.6]}>
            <Box size={[1.4, 0.6, 0.3]} at={[0, 0, -0.7]} color="#7b7368" />
            <Box size={[1.4, 0.6, 0.3]} at={[0, 0, 0.7]} color="#7b7368" />
            <Cyl r={0.55} h={2.2} at={[0, 0.95, 0]} rot={[Math.PI / 2, 0, 0]} color={h <= 0 ? '#b9a48f' : '#e8e6e1'} center />
          </group>
        </Static>
      )}
      {tier >= 3 && <Barrels at={[9.9, 10.6]} />}

      <Slots designs={SLOTS} props={props} />

      <Workers lanes={LANES.slice(0, tier).flat()} max={crewMax(4 + tier * 3, h)} />
      {h <= 0 && <Weeds depth={SITE_TIERS.oil[tier - 1].depth} seed={seed} colors={DRY_SCRUB} />}
    </group>
  );
}

/** One pumpjack in build order; the newest are shut in first when health falls. */
function PumpjackUnit({ index, accent, seed, health, slots }: ArchetypeProps & { index: number }) {
  const shutIn = index >= runningCount(HEALTH.indexOf(health), builtPumpjacks(slots));
  return <Pumpjack at={[PUMPJACKS[index][0], 0, PUMPJACKS[index][1]]} accent={accent} phase={seed + index * 1.9} shutIn={shutIn} />;
}

function PumpjackBase({ at }: { at: [number, number] }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      <Static>
        <Box size={[2, 0.2, 0.7]} color="#6e675e" />
        <Box size={[0.18, 1.0, 0.18]} at={[0, 0.2, 0]} color="#5b554d" />
      </Static>
    </group>
  );
}

/**
 * Nodding pumpjack; its pace follows the plot's motion clock. A shut-in one
 * stands still with its head down, painted grey, with a red tag on the post.
 */
function Pumpjack({ at, accent, phase, shutIn }: { at: Vec3; accent: string; phase: number; shutIn: boolean }) {
  const motion = useMotion();
  const beam = useRef<Group>(null);
  useFrame(() => {
    if (beam.current) beam.current.rotation.z = shutIn ? -0.22 : Math.sin(motion.t * 1.6 + phase) * 0.28;
  });
  return (
    <group position={at}>
      <Static>
        <Box size={[2, 0.2, 0.7]} color="#6e675e" />
        <Box size={[0.18, 1.2, 0.18]} at={[0, 0.2, -0.22]} rot={[0.18, 0, 0]} color="#5b554d" />
        <Box size={[0.18, 1.2, 0.18]} at={[0, 0.2, 0.22]} rot={[-0.18, 0, 0]} color="#5b554d" />
        <Cyl r={0.08} h={0.6} at={[0.95, 0.2, 0]} color="#3f3a35" low />
        {shutIn && (
          <group position={[-0.6, 0, 0.36]}>
            <Box size={[0.06, 0.7, 0.06]} color="#5b554d" shadow={false} />
            <Box size={[0.36, 0.24, 0.04]} at={[0, 0.5, 0.02]} color="#e8463a" shadow={false} />
            <Box size={[0.24, 0.05, 0.05]} at={[0, 0.6, 0.04]} color="#ffffff" shadow={false} />
          </group>
        )}
      </Static>
      <group ref={beam} position={[0, 1.35, 0]}>
        <Box size={[1.9, 0.18, 0.2]} at={[0, -0.09, 0]} color={shutIn ? '#9a948a' : accent} />
        <Box size={[0.25, 0.55, 0.26]} at={[0.95, -0.35, 0]} color="#3f3a35" rounded={0.05} />
        <Box size={[0.35, 0.3, 0.3]} at={[-0.85, -0.3, 0]} color="#3f3a35" />
      </group>
    </group>
  );
}

function Tank({ at, accent, rusty = false, bare = false }: { at: [number, number]; accent: string; rusty?: boolean; bare?: boolean }) {
  const [x, z] = at;
  return (
    <Static>
      <group position={[x, 0, z]}>
      <Cyl r={0.9} h={bare ? 0.8 : 1.8} color={bare ? '#cfc8ba' : '#f1eee6'} />
      {!bare && (
        <>
          <Cyl r={0.92} h={0.25} at={[0, 1.1, 0]} color={rusty ? '#a8835e' : accent} />
          <Cone r={0.9} h={0.35} at={[0, 1.8, 0]} color="#dcd7cb" />
          {rusty &&
            [0.4, -0.5].map((a) => (
              <Box key={a} size={[0.16, 0.8, 0.04]} at={[Math.sin(a) * 0.9, 0.3, Math.cos(a) * 0.9]} rot={[0, a, 0]} color="#a8835e" shadow={false} />
            ))}
        </>
      )}
      </group>
    </Static>
  );
}

function TankPair({ at, accent = '#999', health, bare = false }: Partial<ArchetypeProps> & { at: [number, number]; bare?: boolean }) {
  const rusty = health === 'STRUGGLING';
  const [x, z] = at;
  return (
    <group>
      <Tank at={[x - 1.2, z]} accent={accent} rusty={rusty} bare={bare} />
      <Tank at={[x + 1.2, z]} accent={accent} rusty={rusty} bare={bare} />
    </group>
  );
}

/** Gas processing unit: two tall columns with platforms, a heater and a steam plume while running. */
function ProcessingUnit({ accent, health }: ArchetypeProps) {
  const running = HEALTH.indexOf(health) >= 2;
  return (
    <group position={[PROCESSING[0], 0, PROCESSING[1]]}>
      <Static>
      <Box size={[2.4, 0.3, 3.6]} color="#9a948a" />
      {[
        [-0.4, 1.0, 4.2],
        [-0.4, -0.4, 3.4],
      ].map(([x, z, ht]) => (
        <group key={z}>
          <Cyl r={0.42} h={ht} at={[x, 0.3, z]} color="#e8e6e1" />
          {[0.35, 0.7].map((f) => (
            <Cyl key={f} r={0.58} h={0.08} at={[x, 0.3 + ht * f, z]} color={accent} shadow={false} />
          ))}
          <Cone r={0.42} h={0.3} at={[x, 0.3 + ht, z]} color="#cfc8ba" />
        </group>
      ))}
      <Box size={[1.2, 1.2, 1.0]} at={[0.5, 0.3, -1.2]} color="#d8d0c0" rounded={0.06} />
      <Cyl r={0.15} h={1.2} at={[0.7, 1.5, -1.4]} color="#8a8174" low />
      </Static>
      {running && <Steam at={[0.7, 2.75, -1.4]} />}
    </group>
  );
}

function Steam({ at }: { at: Vec3 }) {
  const motion = useMotion();
  const puffs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const p = (motion.t * 0.25 + i / 4) % 1;
      m.position.set(p * 0.4, p * 1.8, 0);
      m.scale.setScalar((0.15 + p * 0.35) * Math.sin(Math.PI * Math.min(1, p * 1.15)));
    });
  });
  return (
    <group position={at}>
      {Array.from({ length: 4 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            puffs.current[i] = el;
          }}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#f4f2ee" flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Flare stack: the flame grows with Activity; out when struggling. */
function Flare({ at, lit }: { at: [number, number]; lit: boolean }) {
  const motion = useMotion();
  const flame = useRef<Group>(null);
  const glow = useMemo(() => new MeshStandardMaterial({ color: '#ffb340', emissive: '#ff7a1a', emissiveIntensity: 1.2, flatShading: true }), []);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const flicker = 1 + Math.sin(clock.elapsedTime * 9) * 0.08;
    const size = motion.halted ? 0.2 : (0.35 + motion.intensity * 0.9) * flicker;
    flame.current.scale.set(size, size * 1.6, size);
  });
  const [x, z] = at;
  return (
    <group position={[x, 0, z]}>
      <Static>
        <Box size={[0.8, 0.3, 0.8]} color="#7b7368" />
        <Cyl r={0.16} h={4.4} at={[0, 0.3, 0]} color="#d8d0c0" />
        {[1.4, 2.8].map((y) => (
          <Cyl key={y} r={0.2} h={0.2} at={[0, y, 0]} color="#d8463b" shadow={false} />
        ))}
        <Cyl r={0.24} h={0.2} at={[0, 4.6, 0]} color="#5f584f" />
      </Static>
      {lit && (
        <group ref={flame} position={[0, 4.8, 0]}>
          <mesh material={glow} position={[0, 0.4, 0]}>
            <coneGeometry args={[0.35, 0.8, 6]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Barrels({ at }: { at: [number, number] }) {
  const spots: [number, number, string][] = [
    [0, 0, '#3d7fd9'],
    [0.5, 0.1, '#d8463b'],
    [0.2, 0.5, '#3d7fd9'],
    [-0.4, 0.4, '#f2b632'],
  ];
  return (
    <group position={[at[0], 0, at[1]]}>
      <Static>
        {spots.map(([x, z, c]) => (
          <Cyl key={`${x}${z}`} r={0.2} h={0.5} at={[x, 0, z]} color={c} low />
        ))}
      </Static>
    </group>
  );
}
