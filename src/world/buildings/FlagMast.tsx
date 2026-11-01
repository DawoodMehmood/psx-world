import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial, type Group, type Mesh } from 'three';
import { Box, Cyl, GEO, type Vec3 } from '../kit';
import { useMotion } from '../motion';

const MAST_H = 3.4;

/**
 * The company's direction signal (SPEC §7): flag high = up, half = flat,
 * low = down, with a warm/cool beacon on top. Volatility makes the flag flap
 * hard and the beacon flicker; a halt freezes it.
 */
export function FlagMast({ at, color }: { at: Vec3; color: string }) {
  const motion = useMotion();
  const flag = useRef<Group>(null);
  const beacon = useRef<Mesh>(null);
  const wave = useRef(at[0] * 3.1 + at[2] * 1.7);
  const beaconMat = useMemo(() => new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6, flatShading: true }), []);

  useFrame(({ clock }, dt) => {
    if (!flag.current) return;
    const j = motion.jitter;
    if (!motion.halted) wave.current += dt * (2.2 + j * 6);
    flag.current.position.y = 0.6 + motion.flag * (MAST_H - 1.2);
    flag.current.rotation.y = Math.sin(wave.current) * (0.18 + j * 0.4) + (j > 0 ? Math.sin(wave.current * 2.7) * j * 0.15 : 0);
    beaconMat.color.copy(motion.beacon);
    beaconMat.emissive.copy(motion.beacon);
    const flicker = j > 0.5 && Math.sin(clock.elapsedTime * 23) * Math.sin(clock.elapsedTime * 7.7) > 0.3 ? 0.15 : 1;
    beaconMat.emissiveIntensity = motion.halted ? 0.15 : 0.7 * flicker;
  });

  return (
    <group position={at}>
      <Cyl r={0.22} h={0.2} color="#9a9488" />
      <Cyl r={0.05} h={MAST_H} color="#f2efe6" low />
      <mesh ref={beacon} geometry={GEO.ball} material={beaconMat} position={[0, MAST_H + 0.12, 0]} scale={0.17} />
      <group ref={flag}>
        <Box size={[0.06, 0.7, 1.1]} at={[0, -0.35, 0.58]} color={color} rounded={0.025} />
      </group>
    </group>
  );
}
