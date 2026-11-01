import type { ReactNode } from 'react';
import { districtRect, districtStreets, mainRoads, center, WORLD_HALF, type Rect } from '../../config/layout';
import { SECTORS } from '../../config/sectors';
import { Box } from '../kit';

const size = (r: Rect): [number, number] => [r.maxX - r.minX, r.maxZ - r.minZ];

function Slab({ rect, y, h, color }: { rect: Rect; y: number; h: number; color: string }) {
  const [w, d] = size(rect);
  const [x, z] = center(rect);
  return <Box size={[w, h, d]} at={[x, y, z]} color={color} shadow={false} />;
}

/** Floating island base, district ground and roads with lane dashes. */
export function Ground() {
  const edge = WORLD_HALF;
  const roads = [...mainRoads(), ...SECTORS.flatMap((s) => districtStreets(s.id))];
  return (
    <group>
      {/* island: grass top over a chunky dirt block */}
      <Box size={[edge * 2 + 1, 3, edge * 2 + 1]} at={[0, -3.2, 0]} color="#a0703f" shadow={false} />
      <Box size={[edge * 2 + 1.3, 0.5, edge * 2 + 1.3]} at={[0, -0.95, 0]} color="#7a5230" shadow={false} />
      <Box size={[edge * 2 + 1, 0.4, edge * 2 + 1]} at={[0, -0.4, 0]} color="#86c556" shadow={false} />

      {SECTORS.map((s) => (
        <Slab key={s.id} rect={districtRect(s.id)} y={0} h={0.02} color={s.ground} />
      ))}

      {roads.map((r, i) => (
        <Slab key={i} rect={r} y={0.01} h={0.05} color="#8e8b88" />
      ))}
      <LaneDashes />

    </group>
  );
}

/** Cream dashes down the middle of the avenues. */
function LaneDashes() {
  const dashes: ReactNode[] = [];
  for (let d = 10.5; d < WORLD_HALF - 1; d += 2) {
    for (const sign of [-1, 1]) {
      dashes.push(<Box key={`x${d}${sign}`} size={[1, 0.02, 0.15]} at={[sign * d, 0.06, 0]} color="#f3ead2" shadow={false} />);
      dashes.push(<Box key={`z${d}${sign}`} size={[0.15, 0.02, 1]} at={[0, 0.06, sign * d]} color="#f3ead2" shadow={false} />);
    }
  }
  return <>{dashes}</>;
}
