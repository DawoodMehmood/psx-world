import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial } from 'three';
import { Box, Cyl, GEO } from '../kit';

const SEGMENT = 0.6;

/** Trading halt: striped barrier tape around a w×d site and blinking amber lamps at the corners. Centered on the site. */
export function HaltTape({ w, d }: { w: number; d: number }) {
  const hx = w / 2 - 0.15;
  const hz = d / 2 - 0.15;
  const lamp = useMemo(() => new MeshStandardMaterial({ color: '#ffb000', emissive: '#ff9900', emissiveIntensity: 1, flatShading: true }), []);
  useFrame(({ clock }) => {
    lamp.emissiveIntensity = Math.sin(clock.elapsedTime * 4) > 0 ? 1.4 : 0.15;
  });
  const along = (half: number) => Array.from({ length: Math.round((half * 2) / SEGMENT) }, (_, i) => -half + SEGMENT * (i + 0.5));
  const corners: [number, number][] = [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz],
  ];
  return (
    <group>
      {corners.map(([x, z]) => (
        <group key={`${x}${z}`}>
          <Cyl r={0.06} h={0.8} at={[x, 0, z]} color="#d9d4c7" low />
          <mesh geometry={GEO.ball} material={lamp} position={[x, 0.9, z]} scale={0.12} />
        </group>
      ))}
      {along(hx).map((s, i) => {
        const color = i % 2 ? '#2b2a33' : '#ffd23f';
        return (
          <group key={`x${i}`}>
            <Box size={[SEGMENT, 0.14, 0.03]} at={[s, 0.5, hz]} color={color} shadow={false} />
            <Box size={[SEGMENT, 0.14, 0.03]} at={[s, 0.5, -hz]} color={color} shadow={false} />
          </group>
        );
      })}
      {along(hz).map((s, i) => {
        const color = i % 2 ? '#2b2a33' : '#ffd23f';
        return (
          <group key={`z${i}`}>
            <Box size={[0.03, 0.14, SEGMENT]} at={[hx, 0.5, s]} color={color} shadow={false} />
            <Box size={[0.03, 0.14, SEGMENT]} at={[-hx, 0.5, s]} color={color} shadow={false} />
          </group>
        );
      })}
    </group>
  );
}
