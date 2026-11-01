import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { createRng } from '../../engine/rng';
import { inflate, mainRoads, overlaps, parkRect, lotRect, districtStreets, center, signSpot, LOT_SIZE, PLAZA_HALF, WORLD_HALF, type Rect } from '../../config/layout';
import { SECTORS } from '../../config/sectors';
import { Box, Car, Cyl, Trees, Ball, type Vec3 } from '../kit';
import { Static } from '../Static';
import { District } from './District';
import { SectorSign } from './SectorSign';

const TREE_GREENS = ['#4fa83d', '#5cb84a', '#3f9a3a', '#6cc04f'];

function blockedRects(): Rect[] {
  // Lots are left alone: each company draws its own reserved land and trees.
  const plots = SECTORS.flatMap((s) => [0, 1, 2].map((i) => lotRect(s.id, i)));
  const plaza: Rect = { minX: -PLAZA_HALF, maxX: PLAZA_HALF, minZ: -PLAZA_HALF, maxZ: PLAZA_HALF };
  const roads = [...mainRoads(), ...SECTORS.flatMap((s) => districtStreets(s.id))];
  const signs = SECTORS.map((s) => {
    const [x, z] = signSpot(s.id);
    return { minX: x - 1.6, maxX: x + 1.6, minZ: z - 1.6, maxZ: z + 1.6 };
  });
  // the middle of each park holds the district landmark, lamps and bunting
  const landmarks = SECTORS.map((s) => {
    const [x, z] = center(parkRect(s.id));
    return { minX: x - 3.8, maxX: x + 3.8, minZ: z - 3.8, maxZ: z + 3.8 };
  });
  return [...plots, plaza, ...roads, ...signs, ...landmarks].map((r) => inflate(r, 0.7));
}

/** Seeded trees scattered on free grass, plus a small park in each district. */
export function Scenery() {
  const trees = useMemo(() => {
    const rng = createRng(42);
    const blocked = blockedRects();
    const out: { at: Vec3; size: number; color: string }[] = [];
    let tries = 0;
    while (out.length < 150 && tries < 6000) {
      tries++;
      const x = (rng() * 2 - 1) * (WORLD_HALF - 1);
      const z = (rng() * 2 - 1) * (WORLD_HALF - 1);
      const spot: Rect = { minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6 };
      if (blocked.some((b) => overlaps(b, spot))) continue;
      if (out.some((t) => Math.hypot(t.at[0] - x, t.at[2] - z) < 1.5)) continue;
      out.push({ at: [x, 0, z], size: 0.75 + rng() * 0.5, color: TREE_GREENS[Math.floor(rng() * TREE_GREENS.length)] });
    }
    return out;
  }, []);

  return (
    <group>
      {SECTORS.map((s) => (
        <group key={s.id}>
          <Park rect={parkRect(s.id)} quadrant={s.quadrant} />
          <SectorSign sector={s} />
          <District sector={s} />
        </group>
      ))}
      <Trees trees={trees} />
      <RingTraffic />
    </group>
  );
}

/** District park: a path cross with planters. The outer corner is left clear for the district sign. */
function Park({ rect, quadrant }: { rect: Rect; quadrant: [number, number] }) {
  const [x, z] = center(rect);
  return (
    <group position={[x, 0, z]}>
      <Static>
      <Box size={[1.2, 0.05, LOT_SIZE - 1]} color="#ede3c8" shadow={false} />
      <Box size={[LOT_SIZE - 1, 0.05, 1.2]} color="#ede3c8" shadow={false} />
      <Cyl r={2.2} h={0.06} color="#ede3c8" shadow={false} />
      {[
        [-4.5, -4.5],
        [4.5, 4.5],
        [-4.5, 4.5],
        [4.5, -4.5],
      ]
        .filter(([dx, dz]) => !(Math.sign(dx) === quadrant[0] && Math.sign(dz) === quadrant[1]))
        .map(([dx, dz]) => (
        <Ball key={`${dx}${dz}`} r={0.55} at={[dx, 0.4, dz]} color="#4c9e46" />
      ))}
      </Static>
    </group>
  );
}

const RING_LANES = [7.5, 8.5];
const CAR_COLORS = ['#e8524a', '#f0c94a', '#4a90e2', '#f4f4f4', '#7bc96f', '#ff9f43'];

/** Position and heading on a square loop of half-size `h` at progress s ∈ [0, 1). */
function onSquare(h: number, s: number): [number, number, number] {
  const side = Math.floor(s * 4);
  const t = s * 4 - side;
  const a = -h + 2 * h * t;
  switch (side) {
    case 0:
      return [a, h, 0];
    case 1:
      return [h, -a, Math.PI / 2];
    case 2:
      return [-a, -h, Math.PI];
    default:
      return [-h, a, -Math.PI / 2];
  }
}

/** Ambient cars on the ring road. Inner lane runs one way, outer lane the other. */
function RingTraffic() {
  const refs = useRef<(Group | null)[]>([]);
  const cars = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        lane: i % 2,
        offset: i / 8 + (i % 2) * 0.06,
        speed: 0.018 + (i % 3) * 0.003,
        color: CAR_COLORS[i % CAR_COLORS.length],
      })),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    cars.forEach((c, i) => {
      const g = refs.current[i];
      if (!g) return;
      const dir = c.lane === 0 ? 1 : -1;
      const s = (((c.offset + dir * t * c.speed) % 1) + 1) % 1;
      const [x, z, heading] = onSquare(RING_LANES[c.lane], s);
      g.position.set(x, 0.05, z);
      g.rotation.y = heading + (dir < 0 ? Math.PI : 0);
    });
  });
  return (
    <>
      {cars.map((c, i) => (
        <group key={i} ref={(el) => {
            refs.current[i] = el;
          }} scale={0.8}>
          <Car color={c.color} />
        </group>
      ))}
    </>
  );
}
