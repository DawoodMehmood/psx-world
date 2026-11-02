import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Object3D, SRGBColorSpace, type Group, type InstancedMesh } from 'three';
import { createRng } from '../../engine/rng';
import { HEALTH, type SlotState } from '../../engine/types';
import { CREW, movingVehicles, openBayCount, runningCount } from '../../engine/visual';
import { ConstructionSlot } from '../construction/ConstructionSlot';
import { Box, Cone, Cyl, GEO, mat, type Vec3 } from '../kit';
import { useMotion } from '../motion';
import { BAY_Z, BUILD_W, DOCK_X, STREET_X, TIER_BAYS } from './sitePlan';
import type { ArchetypeProps } from './types';

/*
 * Pieces every site archetype shares: the expansion-slot list, decline rules,
 * bay vehicles, closed bays, "to let" boards, weeds and activity-lit windows.
 *
 * Every archetype uses the same site plan (SPEC §3), in site coordinates:
 * origin at the lot's back corner (farthest from the camera), x and z growing
 * toward the camera. The site spans the lot's full width and grows in depth:
 *
 *   rows (z):   tier 1 = 0 … 6 · tier 2 adds 6 … 10 · tier 3 adds 10 … 14
 *   build area: x 0 … BUILD_W · vehicle strip: x BUILD_W … 14, along the side street
 *
 * Height rule: from this camera a tall thing only hides what is behind it,
 * toward the back corner. So tall buildings stand along the two back edges
 * (small x or small z), where nothing is behind them; everything low goes in
 * the middle and front. New land is added at the front, so new buildings
 * always appear in front of old ones.
 */

export { BAY_Z, BUILD_W, DOCK_X, STREET_X, TIER_BAYS };

// ── expansion slots ──────────────────────────────────────────────────────────

export interface SlotDesign {
  /** Footprint center, width along x, depth along z, finished height. */
  at: [number, number];
  w: number;
  d: number;
  h: number;
  /** Where the tower crane stands during FRAME. */
  crane: [number, number];
  /** Finished building, in site coordinates. */
  built: (p: ArchetypeProps) => ReactNode;
  /** Half-built version, in site coordinates. */
  partial: (p: ArchetypeProps) => ReactNode;
}

/** Slots unlocked by each tier: tier 1 has slot 0, tier 2 slots 1–2, tier 3 slots 3–5 (SITE_TIERS). */
export const SLOTS_UNLOCKED = [1, 3, 6];

export const isBuilt = (slots: SlotState[], i: number) => slots[i]?.stage === 'COMPLETE';

/** Whether upgrade `i` (0 = level 3, 1 = level 6, 2 = level 10) is finished. */
export const upgradeDone = (p: Pick<ArchetypeProps, 'upgrades'>, i: number) => p.upgrades[i]?.stage === 'COMPLETE';

/** The tier's expansion slots: reserved pads, building sites or finished buildings. */
export function Slots({ designs, props }: { designs: SlotDesign[]; props: ArchetypeProps }) {
  return (
    <>
      {designs.slice(0, SLOTS_UNLOCKED[props.tier - 1]).map((design, i) => (
        <ConstructionSlot
          key={i}
          slot={props.slots[i] ?? { stage: 'EMPTY', paused: false }}
          at={design.at}
          w={design.w}
          d={design.d}
          h={design.h}
          crane={design.crane}
          partial={<group position={[-design.at[0], -0.2, -design.at[1]]}>{design.partial(props)}</group>}
        >
          {design.built(props)}
        </ConstructionSlot>
      ))}
    </>
  );
}

// ── decline (SPEC §8) ────────────────────────────────────────────────────────
// Nothing is demolished. The newest capacity is idled first.

export { CREW, runningCount };

/**
 * Whether a finished slot building is closed by decline, for sites where the
 * buildings themselves close (banks, tech). As many close as runningCount
 * idles (the HQ, counted first, never closes), picked in `closeOrder`: a list
 * of slot indices, front of the site first, so the first closure is in view.
 */
export function closedByDecline(p: ArchetypeProps, slot: number, closeOrder: number[]): boolean {
  const built = closeOrder.filter((i) => isBuilt(p.slots, i));
  const closing = built.length + 1 - runningCount(HEALTH.indexOf(p.health), built.length + 1);
  return built.slice(0, closing).includes(slot);
}

/** Bays still open, from the front; the rest are coned off. */
export function openBays<T>(h: number, bays: T[]): T[] {
  return bays.slice(0, openBayCount(h, bays.length));
}

/** Cones and a striped bar across the mouth of a closed bay (the bay runs along x, its mouth faces the street). */
export function ClosedBay({ z, x = 13.95 }: { z: number; x?: number }) {
  return (
    <group position={[x, 0, z]}>
      {[-0.45, 0.45].map((cz) => (
        <group key={cz}>
          <Cone r={0.13} h={0.38} at={[0, 0, cz]} color="#ff7a1a" />
          <Cyl r={0.1} h={0.06} at={[0, 0.16, cz]} color="#ffffff" low shadow={false} />
        </group>
      ))}
      <Box size={[0.06, 0.08, 0.9]} at={[0, 0.3, 0]} color="#e8463a" shadow={false} />
      <Box size={[0.07, 0.085, 0.2]} at={[0, 0.3, 0]} color="#ffffff" shadow={false} />
    </group>
  );
}

/** Painted lines of one parking or loading bay along the street edge. */
export function BayLines({ z, color = '#f2c94c' }: { z: number; color?: string }) {
  return (
    <group>
      <Box size={[2.3, 0.02, 0.06]} at={[BUILD_W + 1.25, 0, z + 0.55]} color={color} shadow={false} />
      <Box size={[2.3, 0.02, 0.06]} at={[BUILD_W + 1.25, 0, z - 0.55]} color={color} shadow={false} />
      <Box size={[0.06, 0.02, 1.16]} at={[BUILD_W + 0.1, 0, z]} color={color} shadow={false} />
    </group>
  );
}

/** Tufts of grass pushing up through the yard (struggling only). */
export function Weeds({ depth, seed, colors = ['#79a845', '#8fbd52', '#6a9a3c'] }: { depth: number; seed: number; colors?: string[] }) {
  const tufts = useMemo(() => {
    const rng = createRng(seed * 7 + depth);
    return Array.from({ length: Math.round(depth * 2.5) }, () => ({ x: 0.3 + rng() * (BUILD_W - 0.6), z: 0.3 + rng() * (depth - 0.6), s: 0.7 + rng() * 0.6 }));
  }, [depth, seed]);
  return (
    <>
      {tufts.map(({ x, z, s }, i) => (
        <group key={i} position={[x, 0, z]} scale={s}>
          <Cone r={0.09} h={0.28} at={[0, 0, 0]} color={colors[0]} />
          <Cone r={0.07} h={0.2} at={[0.1, 0, 0.05]} color={colors[1]} />
          <Cone r={0.06} h={0.18} at={[-0.06, 0, 0.09]} color={colors[2]} />
        </group>
      ))}
    </>
  );
}

// ── vehicles ─────────────────────────────────────────────────────────────────

/**
 * One vehicle per bay, each shuttling between the street and its own bay
 * (nose toward the street, +x). How many are on the move follows Activity;
 * when quiet, one waits parked in the first bay.
 */
export function BayVehicles({ bays, vehicle }: { bays: number[]; vehicle: (i: number) => ReactNode }) {
  const motion = useMotion();
  const refs = useRef<(Group | null)[]>([]);
  useFrame(() => {
    const moving = movingVehicles(motion.intensity, bays.length);
    refs.current.forEach((g, i) => {
      if (!g) return;
      if (moving === 0) {
        g.visible = i === 0;
        g.position.x = DOCK_X;
        return;
      }
      g.visible = i < moving;
      const p = (motion.t * 0.05 + i * 0.37) % 1;
      const ease = (f: number) => f * f * (3 - 2 * f);
      let x = STREET_X;
      if (p < 0.3) x = STREET_X + (DOCK_X - STREET_X) * ease(p / 0.3);
      else if (p < 0.6) x = DOCK_X;
      else if (p < 0.9) x = DOCK_X + (STREET_X - DOCK_X) * ease((p - 0.6) / 0.3);
      else g.visible = false;
      g.position.x = x;
    });
  });
  return (
    <>
      {bays.map((z, i) => (
        <group
          key={z}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[DOCK_X, 0, z]}
        >
          {vehicle(i)}
        </group>
      ))}
    </>
  );
}

// ── signs ────────────────────────────────────────────────────────────────────

const textures = new Map<string, CanvasTexture>();

/** A cached canvas texture with one word in bold white on a color. */
function wordTexture(text: string, bg: string): CanvasTexture {
  const key = `${text}|${bg}`;
  let t = textures.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 64px Fredoka, system-ui, sans-serif';
  ctx.fillText(text, 128, 70, 236);
  t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  textures.set(key, t);
  document.fonts?.load('700 64px Fredoka').then(() => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 128, 70, 236);
    t!.needsUpdate = true;
  });
  return t;
}

/**
 * A red "TO LET" board hung on a closed building's face. `face` is the
 * direction it looks: +x or +z (the two faces the camera sees).
 */
export function ToLet({ at, face = 'z', w = 1.2 }: { at: Vec3; face?: 'x' | 'z'; w?: number }) {
  const map = wordTexture('TO LET', '#d8433a');
  const h = w / 2;
  return (
    <group position={at} rotation={[0, face === 'x' ? Math.PI / 2 : 0, 0]}>
      <Box size={[w + 0.1, h + 0.1, 0.05]} at={[0, -0.05, 0]} color="#ffffff" shadow={false} />
      <mesh position={[0, h / 2, 0.03]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── windows ──────────────────────────────────────────────────────────────────

const WIN_DARK = '#5b6f86';
const WIN_LIT = '#ffe27a';

/**
 * Windows on the two faces the camera sees (+x and +z) that light up with
 * Activity: few lit when quiet, nearly all in a frenzy. Each window has a
 * fixed threshold, so they switch on one by one. `closed` keeps them dark.
 */
export function ActivityWindows({
  at,
  w,
  d,
  floors,
  floorHeight = 1,
  baseHeight = 0.6,
  cols = 3,
  seed = 1,
  closed = false,
  litColor = WIN_LIT,
  darkColor = WIN_DARK,
}: {
  at: Vec3;
  w: number;
  d: number;
  floors: number;
  floorHeight?: number;
  baseHeight?: number;
  cols?: number;
  seed?: number;
  closed?: boolean;
  litColor?: string;
  darkColor?: string;
}) {
  const motion = useMotion();
  const litMesh = useRef<InstancedMesh>(null);
  const darkMesh = useRef<InstancedMesh>(null);
  const windows = useMemo(() => {
    const out: { pos: Vec3; size: Vec3; threshold: number }[] = [];
    const winH = floorHeight * 0.5;
    for (const face of ['x', 'z'] as const) {
      const span = face === 'x' ? d : w;
      const step = span / cols;
      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          const offset = -span / 2 + step * (c + 0.5);
          const y = at[1] + baseHeight + f * floorHeight + winH / 2;
          const threshold = fract(Math.sin((f * 31 + c * 7 + seed * 13 + (face === 'x' ? 0 : 101)) * 12.9898) * 43758.5453);
          const pos: Vec3 = face === 'x' ? [at[0] + w / 2 + 0.01, y, at[2] + offset] : [at[0] + offset, y, at[2] + d / 2 + 0.01];
          const size: Vec3 = face === 'x' ? [0.06, winH, step * 0.55] : [step * 0.55, winH, 0.06];
          out.push({ pos, size, threshold });
        }
      }
    }
    // sorted by threshold: the lit windows are always a prefix of this order
    return out.sort((a, b) => a.threshold - b.threshold);
  }, [at, w, d, floors, floorHeight, baseHeight, cols, seed]);
  const lit = mat(litColor, 0.6);
  const dark = mat(darkColor);
  // The lit mesh holds the windows in threshold order and the dark mesh holds them in reverse, so showing the first k of
  // one and the first n - k of the other splits the set at any lit share without touching a matrix per frame.
  useLayoutEffect(() => {
    const o = new Object3D();
    windows.forEach(({ pos, size }, i) => {
      o.position.set(...pos);
      o.scale.set(...size);
      o.updateMatrix();
      litMesh.current?.setMatrixAt(i, o.matrix);
      darkMesh.current?.setMatrixAt(windows.length - 1 - i, o.matrix);
    });
    for (const m of [litMesh.current, darkMesh.current]) if (m) m.instanceMatrix.needsUpdate = true;
  }, [windows]);
  const shown = useRef(-1);
  useFrame(() => {
    // a blackout (a big move down on a tech campus) knocks out part of the lighting
    const share = closed ? 0 : (0.1 + motion.intensity * 0.85) * (1 - 0.6 * motion.blackout);
    let k = 0;
    while (k < windows.length && windows[k].threshold < share) k++;
    if (k === shown.current) return;
    shown.current = k;
    if (litMesh.current) litMesh.current.count = k;
    if (darkMesh.current) darkMesh.current.count = windows.length - k;
  });
  return (
    <>
      <instancedMesh key={`l${windows.length}`} ref={litMesh} args={[GEO.box, lit, windows.length]} frustumCulled={false} />
      <instancedMesh key={`d${windows.length}`} ref={darkMesh} args={[GEO.box, dark, windows.length]} frustumCulled={false} />
    </>
  );
}

const fract = (n: number) => n - Math.floor(n);
