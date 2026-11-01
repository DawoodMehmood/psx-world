import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { LOT_SIZE } from '../config/layout';
import { createRng } from '../engine/rng';
import type { SlotState } from '../engine/types';
import { Workers } from './agents';
import { STAKE } from './construction/ConstructionSlot';
import { Box, Trees } from './kit';
import { Static } from './Static';
import { useMotion } from './motion';

/*
 * Site coordinates: the origin is the lot's back corner; the site covers
 * x ∈ [0, LOT_SIZE] and z ∈ [0, depth]. A bigger tier adds a strip of new land
 * along the front (toward the camera), from the old depth to the new one.
 */

/**
 * Site expansion in progress (SPEC §8): stakes along the new boundary, then
 * the land is graded, then fence and gravel go in.
 */
export function SiteExpansion({ from, to, stage, paused }: { from: number; to: number; stage: SlotState['stage']; paused: boolean }) {
  const posts = useMemo(() => {
    const pts: [number, number][] = [];
    for (let x = 0; x <= LOT_SIZE; x += 1.6) pts.push([x, to]);
    for (let z = from + 1.6; z < to; z += 1.6) pts.push([0, z], [LOT_SIZE, z]);
    return pts;
  }, [from, to]);
  const ground = stage === 'FOUNDATION' ? '#b08d63' : stage === 'FRAME' ? '#d4cab4' : null;
  const mid = (from + to) / 2;
  const deep = to - from;
  return (
    <group>
      <Static>
      {ground && <Box size={[LOT_SIZE, 0.05, deep]} at={[LOT_SIZE / 2, 0, mid]} color={ground} shadow={false} />}
      {stage === 'STAKED' && (
        <>
          {posts.map(([x, z]) => (
            <group key={`${x}${z}`}>
              <Box size={[0.08, 0.6, 0.08]} at={[x, 0, z]} color={STAKE} />
              <Box size={[0.14, 0.1, 0.14]} at={[x, 0.55, z]} color="#ff7a1a" shadow={false} />
            </group>
          ))}
          <Box size={[LOT_SIZE, 0.03, 0.03]} at={[LOT_SIZE / 2, 0.4, to]} color="#ffffff" shadow={false} />
          <Box size={[0.03, 0.03, deep]} at={[0, 0.4, mid]} color="#ffffff" shadow={false} />
          <Box size={[0.03, 0.03, deep]} at={[LOT_SIZE, 0.4, mid]} color="#ffffff" shadow={false} />
        </>
      )}
      {stage === 'FRAME' && (
        <>
          {posts.map(([x, z]) => (
            <Box key={`${x}${z}`} size={[0.1, 0.9, 0.1]} at={[x, 0, z]} color="#9a948a" />
          ))}
          <Box size={[LOT_SIZE, 0.06, 0.04]} at={[LOT_SIZE / 2, 0.75, to]} color="#9a948a" shadow={false} />
          <Box size={[0.04, 0.06, deep]} at={[0, 0.75, mid]} color="#9a948a" shadow={false} />
          <Box size={[0.04, 0.06, deep]} at={[LOT_SIZE, 0.75, mid]} color="#9a948a" shadow={false} />
        </>
      )}
      </Static>
      {stage === 'FOUNDATION' && <Grader at={[LOT_SIZE / 2, mid]} travel={LOT_SIZE - 3} working={!paused} />}
      {!paused && stage !== 'STAKED' && (
        <Workers
          lanes={[
            [1, from + 0.6, LOT_SIZE - 1, from + 0.6],
            [1, to - 0.6, LOT_SIZE - 1, to - 0.6],
          ]}
          max={4}
          min={3}
        />
      )}
    </group>
  );
}

/** A little yellow grader working back and forth across the new land. */
function Grader({ at, travel, working }: { at: [number, number]; travel: number; working: boolean }) {
  const motion = useMotion();
  const g = useRef<Group>(null);
  useFrame(() => {
    if (!g.current || !working) return;
    const f = (motion.t * 0.06) % 1;
    const s = f < 0.5 ? f * 2 : 2 - f * 2;
    g.current.position.x = at[0] - travel / 2 + s * travel;
    g.current.rotation.y = f < 0.5 ? 0 : Math.PI;
  });
  return (
    <group ref={g} position={[at[0], 0, at[1]]}>
      <Static>
        <Box size={[1.4, 0.4, 0.8]} at={[0, 0.15, 0]} color="#f2b632" rounded={0.06} />
        <Box size={[0.6, 0.5, 0.7]} at={[-0.3, 0.55, 0]} color="#f2b632" rounded={0.06} />
        <Box size={[0.1, 0.35, 1.1]} at={[0.8, 0.05, 0]} color="#6d675f" />
      </Static>
    </group>
  );
}

const TREE_GREENS = ['#4fa83d', '#5cb84a', '#3f9a3a', '#6cc04f'];

/**
 * The part of the lot the company hasn't grown into yet: a strip of grass at
 * the front with a few trees. Trees stay clear of new land being graded.
 */
export function ReservedLand({ depth, clearTo, seed }: { depth: number; clearTo: number; seed: number }) {
  const trees = useMemo(() => {
    const rng = createRng(seed * 31 + 7);
    const out: { x: number; z: number; s: number; c: string }[] = [];
    for (let tries = 0; out.length < 14 && tries < 600; tries++) {
      const x = 0.7 + rng() * (LOT_SIZE - 1.4);
      const z = 0.7 + rng() * (LOT_SIZE - 1.4);
      if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 1.6)) continue;
      out.push({ x, z, s: 0.7 + rng() * 0.4, c: TREE_GREENS[Math.floor(rng() * TREE_GREENS.length)] });
    }
    return out;
  }, [seed]);
  const lawn = Math.max(depth, clearTo);
  const shown = useMemo(() => trees.filter((t) => t.z > lawn + 0.8).map((t) => ({ at: [t.x, 0, t.z] as [number, number, number], size: t.s, color: t.c })), [trees, lawn]);
  return (
    <>
      {lawn < LOT_SIZE && <Box size={[LOT_SIZE, 0.04, LOT_SIZE - lawn]} at={[LOT_SIZE / 2, 0, (lawn + LOT_SIZE) / 2]} color="#9fd16a" shadow={false} />}
      <Trees trees={shown} />
    </>
  );
}
