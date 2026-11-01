import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Ball, Box, Cyl, Dome } from './kit';
import { Static } from './Static';
import { agentCount, useMotion } from './motion';

const HELMETS = ['#ffcf3a', '#ffffff', '#ff8a2a'];

/** A little worker in a hi-vis vest and hard hat, about 0.8 units tall. */
export function Worker({ helmet = '#ffcf3a' }: { helmet?: string }) {
  return (
    <Static>
      <Cyl r={0.06} h={0.28} at={[0, 0, 0]} color="#3c4a66" low shadow={false} />
      <Cyl r={0.13} h={0.3} at={[0, 0.26, 0]} color="#ff7a1a" low />
      <Ball r={0.11} at={[0, 0.68, 0]} color="#c98d62" shadow={false} />
      <Dome r={0.12} at={[0, 0.72, 0]} color={helmet} />
    </Static>
  );
}

const SHIRTS = ['#4f7fd1', '#e8e3d6', '#d65a5a', '#3f9a7a', '#f0b84a', '#8a6ad1'];

/** Someone in office clothes, about 0.8 units tall. */
export function OfficeWorker({ shirt = '#4f7fd1', hair = '#3a2a20' }: { shirt?: string; hair?: string }) {
  return (
    <Static>
      <Cyl r={0.06} h={0.28} at={[0, 0, 0]} color="#2f3440" low shadow={false} />
      <Cyl r={0.13} h={0.3} at={[0, 0.26, 0]} color={shirt} low />
      <Ball r={0.11} at={[0, 0.68, 0]} color="#c98d62" shadow={false} />
      <Dome r={0.115} at={[0, 0.7, 0]} color={hair} />
    </Static>
  );
}

/** A lane people walk back and forth along: [x1, z1, x2, z2] in plot coordinates. */
export type Lane = [number, number, number, number];

/**
 * Up to `max` workers pacing along lanes. How many are out follows Activity;
 * how fast they walk follows the plot's motion clock.
 */
export function Workers({ lanes, max, min = 0, office = false }: { lanes: Lane[]; max: number; min?: number; office?: boolean }) {
  const motion = useMotion();
  const refs = useRef<(Group | null)[]>([]);
  useFrame(() => {
    const count = agentCount(motion, max, min);
    refs.current.forEach((g, i) => {
      if (!g) return;
      g.visible = i < count;
      if (!g.visible) return;
      const [x1, z1, x2, z2] = lanes[i % lanes.length];
      const raw = motion.t * (0.09 + (i % 3) * 0.025) + i * 0.37;
      const f = raw - Math.floor(raw);
      const s = f < 0.5 ? f * 2 : 2 - f * 2;
      g.position.set(x1 + (x2 - x1) * s, Math.abs(Math.sin(motion.t * 7 + i)) * 0.04, z1 + (z2 - z1) * s);
      const dx = (x2 - x1) * (f < 0.5 ? 1 : -1);
      const dz = (z2 - z1) * (f < 0.5 ? 1 : -1);
      g.rotation.y = Math.atan2(dx, dz);
    });
  });
  return (
    <>
      {Array.from({ length: max }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          {office ? <OfficeWorker shirt={SHIRTS[i % SHIRTS.length]} hair={i % 3 === 0 ? '#6b4a2a' : '#2a211c'} /> : <Worker helmet={HELMETS[i % HELMETS.length]} />}
        </group>
      ))}
    </>
  );
}

/** Cement mixer truck, nose along +x. The drum turns with the plot's motion clock. */
export function MixerTruck({ cab = '#f2b632' }: { cab?: string }) {
  const motion = useMotion();
  const drum = useRef<Group>(null);
  useFrame(() => {
    if (drum.current) drum.current.rotation.x = motion.t * 2.5;
  });
  return (
    <group>
      <Static>
        <Box size={[2.2, 0.35, 0.8]} at={[0, 0.2, 0]} color="#5a544d" />
        <Box size={[0.65, 0.75, 0.8]} at={[0.85, 0.5, 0]} color={cab} rounded={0.08} />
        <Box size={[0.08, 0.3, 0.6]} at={[1.18, 0.85, 0]} color="#cfe9f7" shadow={false} />
        {[-0.7, 0.85].map((x) => (
          <Cyl key={x} r={0.2} h={0.9} at={[x, 0.2, 0]} rot={[Math.PI / 2, 0, 0]} color="#2c2c34" low center shadow={false} />
        ))}
      </Static>
      <group position={[-0.35, 1.0, 0]} rotation={[0, 0, -0.25]}>
        <group ref={drum}>
          <Static>
            <Cyl r={0.45} h={1.3} rot={[0, 0, Math.PI / 2]} color="#f1ece2" center />
            <Box size={[1.2, 0.12, 0.12]} at={[0, 0.38, 0.22]} rot={[0.5, 0, 0]} color="#d94b3d" shadow={false} />
          </Static>
        </group>
      </group>
    </group>
  );
}

/** Armoured cash van, nose along +x, with a stripe in the bank's color. */
export function CashVan({ stripe }: { stripe: string }) {
  return (
    <Static>
      <Box size={[1.7, 0.95, 0.8]} at={[-0.15, 0.18, 0]} color="#8c99a6" rounded={0.08} />
      <Box size={[1.72, 0.14, 0.82]} at={[-0.15, 0.6, 0]} color={stripe} shadow={false} />
      <Box size={[0.5, 0.7, 0.8]} at={[0.85, 0.18, 0]} color="#7a8794" rounded={0.08} />
      <Box size={[0.06, 0.28, 0.62]} at={[1.1, 0.55, 0]} color="#cfe9f7" shadow={false} />
      {[-0.6, 0.75].map((x) => (
        <Cyl key={x} r={0.18} h={0.86} at={[x, 0.18, 0]} rot={[Math.PI / 2, 0, 0]} color="#2c2c34" low center shadow={false} />
      ))}
    </Static>
  );
}

/** Small courier van, nose along +x. */
export function Van({ color }: { color: string }) {
  return (
    <Static>
      <Box size={[1.5, 0.8, 0.72]} at={[-0.1, 0.16, 0]} color="#f4f4f6" rounded={0.1} />
      <Box size={[1.52, 0.16, 0.74]} at={[-0.1, 0.45, 0]} color={color} shadow={false} />
      <Box size={[0.06, 0.28, 0.58]} at={[0.66, 0.6, 0]} color="#cfe9f7" shadow={false} />
      {[-0.5, 0.42].map((x) => (
        <Cyl key={x} r={0.16} h={0.78} at={[x, 0.16, 0]} rot={[Math.PI / 2, 0, 0]} color="#2c2c34" low center shadow={false} />
      ))}
    </Static>
  );
}

/** Tanker truck, nose along +x. */
export function Tanker({ cab }: { cab: string }) {
  return (
    <Static>
      <Box size={[2.2, 0.3, 0.8]} at={[0, 0.2, 0]} color="#5a544d" />
      <Box size={[0.6, 0.75, 0.8]} at={[0.85, 0.45, 0]} color={cab} rounded={0.08} />
      <Box size={[0.08, 0.3, 0.6]} at={[1.16, 0.8, 0]} color="#cfe9f7" shadow={false} />
      <Cyl r={0.4} h={1.45} at={[-0.35, 0.92, 0]} rot={[0, 0, Math.PI / 2]} color="#e8e6e1" center />
      <Cyl r={0.41} h={0.12} at={[-0.35, 0.92, 0]} rot={[0, 0, Math.PI / 2]} color={cab} center shadow={false} />
      {[-0.7, 0.85].map((x) => (
        <Cyl key={x} r={0.2} h={0.9} at={[x, 0.2, 0]} rot={[Math.PI / 2, 0, 0]} color="#2c2c34" low center shadow={false} />
      ))}
    </Static>
  );
}
