import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { SlotState } from '../../engine/types';
import { Workers } from '../agents';
import { Box, Cyl, Tarp, type Vec3 } from '../kit';
import { useMotion } from '../motion';

interface Props {
  slot: SlotState;
  /** Footprint center (plot coordinates), width along x, depth along z, finished height. */
  at: [number, number];
  w: number;
  d: number;
  h: number;
  /** Where the tower crane stands during FRAME. */
  crane: [number, number];
  /** What stands there when COMPLETE. */
  children: ReactNode;
  /** The half-built version shown inside the scaffolding. */
  partial: ReactNode;
}

export const STAKE = '#8a5a34';
const CONCRETE = '#bdb8ae';
const SCAFFOLD = '#c9b27a';

/**
 * Generic building site (SPEC §8): EMPTY → STAKED → FOUNDATION → FRAME →
 * COMPLETE. When paused the crane stops, the workers leave and a tarp goes on.
 */
export function ConstructionSlot({ slot, at, w, d, h, crane, children, partial }: Props) {
  const [x, z] = at;
  if (slot.stage === 'EMPTY') return <ReservedPad at={at} w={w} d={d} />;
  if (slot.stage === 'COMPLETE') return <>{children}</>;
  const working = !slot.paused;
  const corners: [number, number][] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
  return (
    <group>
      <group position={[x, 0, z]}>
        {slot.stage === 'STAKED' && (
          <>
            {corners.map(([cx, cz]) => (
              <group key={`${cx}${cz}`}>
                <Box size={[0.08, 0.6, 0.08]} at={[cx, 0, cz]} color={STAKE} />
                <Box size={[0.14, 0.1, 0.14]} at={[cx, 0.55, cz]} color="#ff7a1a" shadow={false} />
              </group>
            ))}
            <Box size={[w, 0.03, 0.03]} at={[0, 0.4, d / 2]} color="#ffffff" shadow={false} />
            <Box size={[w, 0.03, 0.03]} at={[0, 0.4, -d / 2]} color="#ffffff" shadow={false} />
            <Box size={[0.03, 0.03, d]} at={[w / 2, 0.4, 0]} color="#ffffff" shadow={false} />
            <Box size={[0.03, 0.03, d]} at={[-w / 2, 0.4, 0]} color="#ffffff" shadow={false} />
          </>
        )}
        {slot.stage === 'FOUNDATION' && (
          <>
            <Box size={[w, 0.2, d]} color={CONCRETE} />
            {rebar(w).flatMap((rx) =>
              [-d / 4, d / 4].map((rz) => <Cyl key={`${rx}${rz}`} r={0.03} h={0.5} at={[rx, 0.2, rz]} color="#5b4a3a" low shadow={false} />),
            )}
          </>
        )}
        {slot.stage === 'FRAME' && (
          <>
            <Box size={[w, 0.2, d]} color={CONCRETE} />
            <group position={[0, 0.2, 0]}>{partial}</group>
            <Scaffold w={w + 0.3} d={d + 0.3} h={h} />
          </>
        )}
        {/* paused: the work is covered over, the tarp draped from the top and pegged to the ground */}
        {slot.paused && slot.stage === 'FOUNDATION' && <Tarp w={w + 0.1} d={d + 0.1} top={0.72} drop={0.5} />}
        {slot.paused && slot.stage === 'FRAME' && <Tarp w={w + 0.4} d={d + 0.4} top={h + 0.25} drop={h * 0.55} />}
        {/* building materials stacked by the site */}
        <group position={[w / 2 - 0.4, 0, d / 2 + 0.35]}>
          <Box size={[0.8, 0.12, 0.3]} color="#c8935a" />
          <Box size={[0.8, 0.12, 0.3]} at={[0, 0.12, 0]} color="#b98450" />
        </group>
        {working && (
          <Workers
            lanes={[
              [-w / 2 + 0.2, d / 2 + 0.25, w / 2 - 0.9, d / 2 + 0.25],
              [-w / 2 - 0.25, -d / 2, -w / 2 - 0.25, d / 2],
            ]}
            max={3}
            min={2}
          />
        )}
      </group>
      {(slot.stage === 'FRAME' || slot.stage === 'FOUNDATION') && <TowerCrane at={[crane[0], 0, crane[1]]} height={h + 3} working={working} />}
    </group>
  );
}

/** An empty pad waiting for its building: pale gravel with corner pegs, so the room to grow is visible. */
function ReservedPad({ at, w, d }: { at: [number, number]; w: number; d: number }) {
  const pegs: [number, number][] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
  return (
    <group position={[at[0], 0, at[1]]}>
      <Box size={[w, 0.03, d]} color="#e4dccb" shadow={false} />
      {pegs.map(([px, pz]) => (
        <Box key={`${px}${pz}`} size={[0.1, 0.25, 0.1]} at={[px, 0, pz]} color="#c9b27a" shadow={false} />
      ))}
    </group>
  );
}

/** x positions of rebar stubs across a foundation of width w. */
function rebar(w: number): number[] {
  const n = Math.max(2, Math.round(w / 0.8));
  return Array.from({ length: n }, (_, i) => -w / 2 + 0.3 + ((w - 0.6) * i) / (n - 1));
}

/** Poles at the corners and along the visible faces, with rails at each level. */
function Scaffold({ w, d, h }: { w: number; d: number; h: number }) {
  const poles: [number, number][] = [];
  const nx = Math.max(1, Math.round(w / 1.1));
  for (let i = 0; i <= nx; i++) {
    poles.push([-w / 2 + (w * i) / nx, d / 2], [-w / 2 + (w * i) / nx, -d / 2]);
  }
  poles.push([w / 2, 0], [-w / 2, 0]);
  const levels = Math.max(1, Math.round(h / 0.7));
  return (
    <group position={[0, 0.2, 0]}>
      {poles.map(([px, pz]) => (
        <Box key={`${px}${pz}`} size={[0.06, h, 0.06]} at={[px, 0, pz]} color={SCAFFOLD} shadow={false} />
      ))}
      {Array.from({ length: levels }, (_, i) => {
        const y = ((i + 1) * h) / levels - 0.03;
        return (
          <group key={i}>
            <Box size={[w, 0.05, 0.05]} at={[0, y, d / 2]} color={SCAFFOLD} shadow={false} />
            <Box size={[w, 0.05, 0.05]} at={[0, y, -d / 2]} color={SCAFFOLD} shadow={false} />
            <Box size={[0.05, 0.05, d]} at={[w / 2, y, 0]} color={SCAFFOLD} shadow={false} />
            <Box size={[0.05, 0.05, d]} at={[-w / 2, y, 0]} color={SCAFFOLD} shadow={false} />
          </group>
        );
      })}
    </group>
  );
}

/** Yellow tower crane. The jib slews and the hook bobs while work is on. */
export function TowerCrane({ at, height, working }: { at: Vec3; height: number; working: boolean }) {
  const motion = useMotion();
  const jib = useRef<Group>(null);
  const hook = useRef<Group>(null);
  useFrame(() => {
    if (!working || !jib.current || !hook.current) return;
    jib.current.rotation.y = Math.sin(motion.t * 0.25) * 1.2;
    hook.current.position.y = -1.2 - Math.sin(motion.t * 0.6) * 0.5;
  });
  return (
    <group position={at}>
      <Box size={[0.7, 0.25, 0.7]} color="#6d675f" />
      <Box size={[0.32, height, 0.32]} at={[0, 0.25, 0]} color="#f2b632" />
      {Array.from({ length: Math.floor(height / 0.8) }, (_, i) => (
        <Box key={i} size={[0.36, 0.05, 0.36]} at={[0, 0.5 + i * 0.8, 0]} color="#c98e1f" shadow={false} />
      ))}
      <group ref={jib} position={[0, height + 0.25, 0]}>
        <Box size={[0.45, 0.45, 0.45]} at={[0, 0, 0]} color="#f2b632" />
        <Box size={[3.4, 0.18, 0.22]} at={[1.5, 0.3, 0]} color="#f2b632" />
        <Box size={[1.2, 0.18, 0.22]} at={[-0.7, 0.3, 0]} color="#f2b632" />
        <Box size={[0.45, 0.35, 0.4]} at={[-1.2, 0.05, 0]} color="#8a8174" />
        <group position={[2.6, 0.3, 0]}>
          <Box size={[0.02, 1.2, 0.02]} at={[0, -1.2, 0]} color="#3a3a3a" shadow={false} />
          <group ref={hook} position={[0, -1.2, 0]}>
            <Box size={[0.14, 0.14, 0.14]} color="#d94b3d" shadow={false} />
          </group>
        </group>
      </group>
    </group>
  );
}
