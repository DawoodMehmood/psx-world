import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, MeshStandardMaterial, type Mesh } from 'three';
import { useMarketVisual } from '../../store/useSimStore';
import { Workers, type Lane } from '../agents';
import { Box, Cyl, Dome, Tree, GEO } from '../kit';
import { Static } from '../Static';
import { ACTIVITY_INTENSITY, BEACON, createMotion, MotionContext } from '../motion';
import { FlagMast } from './FlagMast';

const GREEN = '#2e7d5b';

/** Walks around the podium: the plaza crowd. */
const PLAZA_LANES: Lane[] = [
  [5.4, -4.6, 5.4, 4.6],
  [-4.6, 5.4, 4.6, 5.4],
  [6.2, -2.5, 6.2, 3.5],
  [-2.5, 6.2, 3.5, 6.2],
  [-5.4, -4.6, -5.4, 4.6],
  [-4.6, -5.4, 4.6, -5.4],
];

/** Market breadth → the same warm/cool beacon colors a company's direction uses. */
function beaconFor(breadth: number): string {
  if (breadth >= 0.5) return BEACON.UP_HARD;
  if (breadth >= 0.17) return BEACON.UP;
  if (breadth <= -0.5) return BEACON.DOWN_HARD;
  if (breadth <= -0.17) return BEACON.DOWN;
  return BEACON.FLAT;
}

/**
 * The PSX Exchange landmark: stepped podium, colonnade, golden dome and a
 * beacon. It shows the whole market (SPEC §11): the beacon glows warm when
 * most of the market is up and cool when it's down, the big flag in front
 * rises and falls with market breadth, and the plaza fills with people as
 * trading gets busier.
 */
export function Exchange() {
  const market = useMarketVisual();
  const motion = useMemo(createMotion, []);
  const beaconTarget = useMemo(() => new Color(), []);
  const beacon = useRef<Mesh>(null);
  const beaconMat = useMemo(() => new MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffe9a8', emissiveIntensity: 1.4, flatShading: true }), []);
  const target = useRef(market);
  target.current = market;

  useFrame(({ clock }, frameDt) => {
    const dt = Math.min(frameDt, 0.1);
    const m = target.current;
    const k = 1 - Math.exp(-dt * 2);
    motion.intensity += (ACTIVITY_INTENSITY[m.activity] - motion.intensity) * k;
    motion.jitter += ((m.stormy ? 0.6 : 0) - motion.jitter) * k;
    motion.flag += (0.5 + m.breadth * 0.46 - motion.flag) * (1 - Math.exp(-dt * 1.4));
    motion.beacon.lerp(beaconTarget.set(beaconFor(m.breadth)), k);
    motion.speed = 0.4 + motion.intensity;
    motion.t += dt * motion.speed;
    if (beacon.current) {
      beacon.current.scale.setScalar(0.35 + Math.sin(clock.elapsedTime * (1.2 + motion.intensity * 2.5)) * 0.04);
      beaconMat.color.copy(motion.beacon);
      beaconMat.emissive.copy(motion.beacon);
    }
  });

  const columns: number[] = [-2.4, -1.2, 0, 1.2, 2.4];
  return (
    <MotionContext.Provider value={motion}>
      <group>
        {[-5.6, 5.6].flatMap((x) => [-5.6, 5.6].map((z) => <Tree key={`${x}${z}`} at={[x, 0.08, z]} size={0.9} />))}
        <Static>
        {/* plaza */}
        <Box size={[14, 0.08, 14]} color="#efe6d0" shadow={false} />
        {/* stepped podium */}
        <Box size={[9.4, 0.35, 9.4]} at={[0, 0.08, 0]} color="#d9cfb8" rounded={0.08} />
        <Box size={[8.6, 0.35, 8.6]} at={[0, 0.43, 0]} color="#e6dcc4" rounded={0.08} />

        {/* main hall */}
        <Box size={[6.4, 3, 6.4]} at={[0, 0.78, 0]} color="#f6f1e4" rounded={0.12} />
        {columns.map((o) => (
          <group key={o}>
            <Cyl r={0.22} h={3} at={[3.75, 0.78, o]} color="#fffaf0" low />
            <Cyl r={0.22} h={3} at={[o, 0.78, 3.75]} color="#fffaf0" low />
          </group>
        ))}
        <Box size={[7.8, 0.45, 7.8]} at={[0, 3.78, 0]} color={GREEN} rounded={0.1} />
        <Box size={[7, 0.25, 7]} at={[0, 4.23, 0]} color="#f6f1e4" />

        {/* drum + dome + market beacon */}
        <Cyl r={2.5} h={1.2} at={[0, 4.48, 0]} color="#f6f1e4" />
        <Cyl r={2.6} h={0.2} at={[0, 5.6, 0]} color={GREEN} />
        <Dome r={2.4} at={[0, 5.8, 0]} color="#f2c14e" />
        <Cyl r={0.12} h={0.9} at={[0, 8.1, 0]} color="#e0b040" />
        </Static>
        <mesh ref={beacon} geometry={GEO.ball} material={beaconMat} position={[0, 9.2, 0]} />

        {/* the market flag at the front corner of the plaza */}
        <group position={[6.3, 0.08, 6.3]} scale={1.7}>
          <FlagMast at={[0, 0, 0]} color={GREEN} />
        </group>

        <group position={[0, 0.08, 0]}>
          <Workers lanes={PLAZA_LANES} max={18} min={2} office />
        </group>
      </group>
    </MotionContext.Provider>
  );
}
