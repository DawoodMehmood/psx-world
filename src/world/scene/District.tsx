import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, MeshStandardMaterial, type Group, type Mesh } from 'three';
import { center, districtRect, LOT_SIZE, parkRect } from '../../config/layout';
import type { SectorDefinition, SectorId } from '../../config/sectors';
import type { SectorMood } from '../../engine/types';
import { useSectorVisual } from '../../store/useSimStore';
import { useWorldStore } from '../../store/useWorldStore';
import { FlagMast } from '../buildings/FlagMast';
import { Antenna } from '../buildings/TechCampus';
import { Box, Car, Cone, Cyl, GEO, mat, Rope, type Vec3 } from '../kit';
import { Static } from '../Static';
import { ACTIVITY_INTENSITY, agentCount, BEACON, createMotion, MotionContext, useMotion } from '../motion';

/*
 * A district's shared life (SPEC §11), in its park: a landmark that works
 * harder when the sector is busy, lamp posts that glow warm when the sector is
 * up and cool when it's down, a district flag that follows breadth, bunting
 * when the whole sector rallies, and cars on the district roads.
 */

/** Lamp posts on three diagonals of the park circle; the fourth (toward the camera) holds the district flag. */
const LAMPS: [number, number][] = [
  [-2.2, -2.2],
  [2.2, -2.2],
  [-2.2, 2.2],
];
const FLAG_SPOT: Vec3 = [3.1, 0, 3.1];
const LAMP_H = 2.2;

function beaconFor(breadth: number): string {
  if (breadth >= 0.67) return BEACON.UP_HARD;
  if (breadth > 0) return BEACON.UP;
  if (breadth <= -0.67) return BEACON.DOWN_HARD;
  if (breadth < 0) return BEACON.DOWN;
  return BEACON.FLAT;
}

export function District({ sector }: { sector: SectorDefinition }) {
  const state = useSectorVisual(sector.id);
  const motion = useMemo(createMotion, []);
  const beaconTarget = useMemo(() => new Color(), []);
  const target = useRef(state);
  target.current = state;
  useFrame((_, frameDt) => {
    const dt = Math.min(frameDt, 0.1);
    const s = target.current;
    const k = 1 - Math.exp(-dt * 2);
    motion.intensity += (ACTIVITY_INTENSITY[s.activity] - motion.intensity) * k;
    motion.flag += (0.5 + s.breadth * 0.46 - motion.flag) * (1 - Math.exp(-dt * 1.4));
    motion.beacon.lerp(beaconTarget.set(beaconFor(s.breadth)), k);
    motion.speed = 0.3 + motion.intensity * 1.2;
    motion.t += dt * motion.speed;
  });
  const [px, pz] = center(parkRect(sector.id));
  const selected = useWorldStore((s) => s.selectedSector === sector.id);
  const selectSector = useWorldStore((s) => s.selectSector);
  return (
    <MotionContext.Provider value={motion}>
      <group position={[px, 0, pz]}>
        {/* the whole park is the click target for the district card */}
        <mesh
          position={[0, 0.12, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            selectSector(sector.id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = '';
          }}
        >
          <planeGeometry args={[LOT_SIZE, LOT_SIZE]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {selected && <ParkRing color={sector.color} />}
        <Landmark id={sector.id} color={sector.color} />
        {LAMPS.map(([x, z]) => (
          <Lamp key={`${x}${z}`} at={[x, 0, z]} />
        ))}
        <FlagMast at={FLAG_SPOT} color={sector.color} />
        <Bunting mood={state.mood} color={sector.color} />
      </group>
      <DistrictTraffic id={sector.id} />
    </MotionContext.Provider>
  );
}

/** Outline around the selected district's park. */
function ParkRing({ color }: { color: string }) {
  const half = LOT_SIZE / 2 + 0.15;
  const t = 0.3;
  return (
    <group position={[0, 0.16, 0]}>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[LOT_SIZE + 0.6, 0.12, t]} at={[0, 0, s * half]} color={color} glow={0.5} shadow={false} />
          <Box size={[t, 0.12, LOT_SIZE + 0.6]} at={[s * half, 0, 0]} color={color} glow={0.5} shadow={false} />
        </group>
      ))}
    </group>
  );
}

function Landmark({ id, color }: { id: SectorId; color: string }) {
  switch (id) {
    case 'banks':
      return <Fountain />;
    case 'oil':
      return <FlareTower color={color} />;
    case 'cement':
      return <WaterTower color={color} />;
    case 'tech':
      return (
        <group scale={1.25}>
          <Antenna at={[0, 0]} />
        </group>
      );
  }
}

/** Street lamp whose globe takes the district's beacon color. */
function Lamp({ at }: { at: Vec3 }) {
  const motion = useMotion();
  const glow = useMemo(() => new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.8, flatShading: true }), []);
  useFrame(() => {
    glow.color.copy(motion.beacon);
    glow.emissive.copy(motion.beacon);
  });
  return (
    <group position={at}>
      <Static>
        <Cyl r={0.12} h={0.15} color="#5f6a70" />
        <Cyl r={0.05} h={LAMP_H} color="#5f6a70" low />
      </Static>
      <mesh geometry={GEO.ball} material={glow} position={[0, LAMP_H + 0.12, 0]} scale={0.18} />
    </group>
  );
}

/** Pennant strings between the lamps and the flag, only while the whole sector rallies; they sway with activity. */
function Bunting({ mood, color }: { mood: SectorMood; color: string }) {
  const motion = useMotion();
  const group = useRef<Group>(null);
  const shown = useRef(0);
  const posts: [number, number][] = [LAMPS[0], LAMPS[1], [FLAG_SPOT[0], FLAG_SPOT[2]], LAMPS[2]];
  const colors = [color, '#ffd23f', '#ffffff', '#e8524a'];
  useFrame((_, frameDt) => {
    const g = group.current;
    if (!g) return;
    shown.current += ((mood === 'RALLY' ? 1 : 0) - shown.current) * (1 - Math.exp(-Math.min(frameDt, 0.1) * 3));
    g.visible = shown.current > 0.02;
    g.scale.y = shown.current;
    g.children.forEach((c, i) => {
      if (c.userData.pennant) c.rotation.x = Math.sin(motion.t * 4 + i) * 0.25;
    });
  });
  const y = LAMP_H - 0.05;
  return (
    <group ref={group} position={[0, y, 0]}>
      {posts.map(([x0, z0], i) => {
        const [x1, z1] = posts[(i + 1) % posts.length];
        return <Rope key={`r${i}`} from={[x0, 0, z0]} to={[x1, 0, z1]} color="#f4f1ea" r={0.015} />;
      })}
      {posts.flatMap(([x0, z0], i) => {
        const [x1, z1] = posts[(i + 1) % posts.length];
        const yaw = Math.atan2(x1 - x0, z1 - z0);
        return [0.2, 0.4, 0.6, 0.8].map((f, j) => (
          <group key={`p${i}-${j}`} position={[x0 + (x1 - x0) * f, -0.02, z0 + (z1 - z0) * f]} rotation={[0, yaw, 0]} userData={{ pennant: true }}>
            <Cone r={0.13} h={0.3} at={[0, -0.3, 0]} rot={[Math.PI, 0, 0]} color={colors[(i + j) % colors.length]} />
          </group>
        ));
      })}
    </group>
  );
}

/** Banks: a tiered fountain. Its jets rise with district activity. */
function Fountain() {
  const motion = useMotion();
  const jets = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const h = 0.3 + motion.intensity * 1.6;
    jets.current.forEach((m, i) => {
      if (!m) return;
      const bob = 1 + Math.sin(motion.t * 5 + i * 1.3) * 0.08;
      m.scale.set(i === 0 ? 0.1 : 0.06, h * (i === 0 ? 1.4 : 0.8) * bob, i === 0 ? 0.1 : 0.06);
      m.position.y = (i === 0 ? 1.05 : 0.45) + m.scale.y / 2;
    });
  });
  const ring = [0, 1, 2, 3, 4, 5].map((i) => (i / 6) * Math.PI * 2);
  return (
    <group>
      <Static>
        <Cyl r={1.8} h={0.4} color="#d9d2c0" />
        <Cyl r={1.6} h={0.05} at={[0, 0.38, 0]} color="#7cc8f0" shadow={false} />
        <Cyl r={0.7} h={0.65} at={[0, 0.4, 0]} color="#e6dfcf" />
        <Cyl r={0.6} h={0.05} at={[0, 1.02, 0]} color="#7cc8f0" shadow={false} />
      </Static>
      <mesh
        ref={(el) => {
          jets.current[0] = el;
        }}
        geometry={GEO.cylLow}
        material={mat('#c8ecff', 0.25)}
      />
      {ring.map((a, i) => (
        <mesh
          key={a}
          ref={(el) => {
            jets.current[i + 1] = el;
          }}
          geometry={GEO.cylLow}
          material={mat('#c8ecff', 0.25)}
          position={[Math.cos(a) * 1.2, 0.45, Math.sin(a) * 1.2]}
        />
      ))}
    </group>
  );
}

/** Oil: a flare tower. The flame grows with district activity. */
function FlareTower({ color }: { color: string }) {
  const motion = useMotion();
  const flame = useRef<Group>(null);
  const glow = useMemo(() => new MeshStandardMaterial({ color: '#ffb340', emissive: '#ff7a1a', emissiveIntensity: 1.3, flatShading: true }), []);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const size = (0.4 + motion.intensity * 1.1) * (1 + Math.sin(clock.elapsedTime * 9) * 0.08);
    flame.current.scale.set(size, size * 1.7, size);
  });
  return (
    <group>
      <Static>
        <Box size={[1.4, 0.3, 1.4]} color="#7b7368" />
        {[
          [0.45, 0.45],
          [-0.45, 0.45],
          [-0.45, -0.45],
          [0.45, -0.45],
        ].map(([x, z]) => (
          <Rope key={`${x}${z}`} from={[x, 0.3, z]} to={[x * 0.25, 5.6, z * 0.25]} color="#d8463b" r={0.06} />
        ))}
        {[1.6, 3.2, 4.6].map((y) => {
          const a = 0.45 - (0.45 - 0.11) * ((y - 0.3) / 5.3);
          return <Box key={y} size={[a * 2 + 0.1, 0.1, a * 2 + 0.1]} at={[0, y, 0]} color="#f4f1ea" shadow={false} />;
        })}
        <Cyl r={0.2} h={0.6} at={[0, 5.5, 0]} color="#5f584f" />
        <Cyl r={0.22} h={0.1} at={[0, 5.9, 0]} color={color} shadow={false} />
      </Static>
      <group ref={flame} position={[0, 6.1, 0]}>
        <mesh material={glow} position={[0, 0.4, 0]}>
          <coneGeometry args={[0.35, 0.8, 6]} />
        </mesh>
      </group>
    </group>
  );
}

/** Cement: a water tower on legs, with a lamp on top that turns faster when the district is busy. */
function WaterTower({ color }: { color: string }) {
  const motion = useMotion();
  const lamp = useRef<Group>(null);
  useFrame(() => {
    if (lamp.current) lamp.current.rotation.y = motion.t * 3;
  });
  return (
    <group>
      <Static>
        {[
          [0.8, 0.8],
          [-0.8, 0.8],
          [-0.8, -0.8],
          [0.8, -0.8],
        ].map(([x, z]) => (
          <Rope key={`${x}${z}`} from={[x, 0, z]} to={[x * 0.7, 3.4, z * 0.7]} color="#8a8174" r={0.08} />
        ))}
        <Box size={[1.3, 0.08, 0.08]} at={[0, 1.6, 0.68]} color="#8a8174" shadow={false} />
        <Box size={[0.08, 0.08, 1.3]} at={[0.68, 1.6, 0]} color="#8a8174" shadow={false} />
        <Cyl r={1.1} h={1.6} at={[0, 3.4, 0]} color="#e6e1d6" />
        <Cyl r={1.12} h={0.3} at={[0, 4.0, 0]} color={color} />
        <Cone r={1.2} h={0.7} at={[0, 5.0, 0]} color="#bdb39f" />
      </Static>
      <group ref={lamp} position={[0, 5.7, 0]}>
        <Cyl r={0.12} h={0.2} color="#5f584f" />
        <Box size={[0.4, 0.14, 0.08]} at={[0.2, 0.1, 0]} color="#ffb340" glow={1.2} shadow={false} />
      </group>
    </group>
  );
}

const DISTRICT_CARS = 6;
const CAR_COLORS = ['#e8524a', '#f0c94a', '#4a90e2', '#f4f4f4', '#7bc96f', '#ff9f43'];

/** Cars circling the district's outer streets; more of them, and faster, when the sector is busy. */
function DistrictTraffic({ id }: { id: SectorId }) {
  const motion = useMotion();
  const refs = useRef<(Group | null)[]>([]);
  const loop = useMemo(() => {
    const r = districtRect(id);
    // the street centerlines sit on the district's edges
    return [
      [r.minX, r.minZ],
      [r.maxX, r.minZ],
      [r.maxX, r.maxZ],
      [r.minX, r.maxZ],
    ] as [number, number][];
  }, [id]);
  useFrame(() => {
    const count = agentCount(motion, DISTRICT_CARS, 1);
    refs.current.forEach((g, i) => {
      if (!g) return;
      g.visible = i < count;
      if (!g.visible) return;
      const s = (((motion.t * 0.012 + i / DISTRICT_CARS) % 1) + 1) % 1;
      const side = Math.floor(s * 4);
      const f = s * 4 - side;
      const [x0, z0] = loop[side];
      const [x1, z1] = loop[(side + 1) % 4];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      // drive on the right of the centerline
      const nx = -dz / len;
      const nz = dx / len;
      g.position.set(x0 + dx * f + nx * 0.4, 0.05, z0 + dz * f + nz * 0.4);
      g.rotation.y = Math.atan2(-dz, dx);
    });
  });
  return (
    <>
      {Array.from({ length: DISTRICT_CARS }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          scale={0.8}
        >
          <Car color={CAR_COLORS[i % CAR_COLORS.length]} />
        </group>
      ))}
    </>
  );
}
