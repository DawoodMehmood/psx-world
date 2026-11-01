import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Low-poly building kit. Every shape shares a unit geometry and a cached
 * flat-color material, so a city of hundreds of parts stays cheap.
 * Positions are given with y at the shape's *base*, which makes stacking easy.
 */

export type Vec3 = [number, number, number];

const materials = new Map<string, THREE.MeshStandardMaterial>();

export function mat(color: string, glow = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${glow}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0,
      flatShading: true,
      emissive: glow > 0 ? new THREE.Color(color) : new THREE.Color(0),
      emissiveIntensity: glow,
    });
    materials.set(key, m);
  }
  return m;
}

/** Neutral base for instanced meshes that take their color per instance. */
const WHITE = mat('#ffffff');

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  cylLow: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.CylinderGeometry(0, 1, 1, 18),
  blob: new THREE.IcosahedronGeometry(1, 0),
  dome: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  ball: new THREE.SphereGeometry(1, 14, 10),
  /** Triangular prism along z, apex up: for gabled roofs. */
  prism: new THREE.CylinderGeometry(1, 1, 1, 3).rotateX(Math.PI / 2).rotateZ(Math.PI),
};

interface ShapeProps {
  at?: Vec3;
  color: string;
  glow?: number;
  rot?: Vec3;
  shadow?: boolean;
}

export function Box({ size, at = [0, 0, 0], color, glow, rot, shadow = true, rounded = 0 }: ShapeProps & { size: Vec3; rounded?: number }) {
  const [w, h, d] = size;
  const pos: Vec3 = [at[0], at[1] + h / 2, at[2]];
  if (rounded > 0) {
    return (
      <RoundedBox args={size} radius={rounded} smoothness={2} position={pos} rotation={rot} material={mat(color, glow)} castShadow={shadow} receiveShadow />
    );
  }
  return <mesh geometry={GEO.box} material={mat(color, glow)} position={pos} rotation={rot} scale={[w, h, d]} castShadow={shadow} receiveShadow />;
}

/** Cylinder standing on `at`. Pass `center` when rotating it (pipes, axles) so `at` is its middle. */
export function Cyl({ r, h, at = [0, 0, 0], color, glow, rot, shadow = true, low = false, center = false }: ShapeProps & { r: number; h: number; low?: boolean; center?: boolean }) {
  return (
    <mesh
      geometry={low ? GEO.cylLow : GEO.cyl}
      material={mat(color, glow)}
      position={[at[0], at[1] + (center ? 0 : h / 2), at[2]]}
      rotation={rot}
      scale={[r, h, r]}
      castShadow={shadow}
      receiveShadow
    />
  );
}

export function Cone({ r, h, at = [0, 0, 0], color, rot }: ShapeProps & { r: number; h: number }) {
  return <mesh geometry={GEO.cone} material={mat(color)} position={[at[0], at[1] + h / 2, at[2]]} rotation={rot} scale={[r, h, r]} castShadow receiveShadow />;
}

export function Dome({ r, at = [0, 0, 0], color, glow }: ShapeProps & { r: number }) {
  return <mesh geometry={GEO.dome} material={mat(color, glow)} position={at} scale={[r, r, r]} castShadow receiveShadow />;
}

export function Ball({ r, at = [0, 0, 0], color, glow, shadow = true }: ShapeProps & { r: number }) {
  return <mesh geometry={GEO.ball} material={mat(color, glow)} position={at} scale={[r, r, r]} castShadow={shadow} />;
}

/** Gabled roof sitting on top of a w×d footprint, ridge along z. */
export function Roof({ w, d, h, at = [0, 0, 0], color }: ShapeProps & { w: number; d: number; h: number }) {
  return <mesh geometry={GEO.prism} material={mat(color)} position={[at[0], at[1] + h / 3, at[2]]} scale={[w / 1.732, h / 1.5, d]} castShadow receiveShadow />;
}

/** Round cartoon tree. */
export function Tree({ at, size = 1, color = '#4fa83d' }: { at: Vec3; size?: number; color?: string }) {
  return (
    <group position={at} scale={size}>
      <Cyl r={0.12} h={0.6} color="#8a5a34" low />
      <mesh geometry={GEO.blob} material={mat(color)} position={[0, 1.05, 0]} scale={[0.6, 0.65, 0.6]} castShadow />
      <mesh geometry={GEO.blob} material={mat(color)} position={[0.15, 1.45, 0.05]} scale={[0.38, 0.4, 0.38]} rotation={[0.4, 0.6, 0]} castShadow />
    </group>
  );
}

export interface TreeSpec {
  at: Vec3;
  size?: number;
  color?: string;
}

/**
 * Many static trees as three instanced meshes (trunks, lower crowns, upper crowns)
 * instead of three meshes per tree. Same shapes as `Tree`. Per-tree color goes in
 * instance colors over a white material.
 */
export function Trees({ trees }: { trees: TreeSpec[] }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const low = useRef<THREE.InstancedMesh>(null);
  const high = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    const place = (mesh: THREE.InstancedMesh | null, i: number, t: TreeSpec, pos: Vec3, scale: Vec3, rot: Vec3, color?: string) => {
      if (!mesh) return;
      const s = t.size ?? 1;
      o.position.set(t.at[0] + pos[0] * s, t.at[1] + pos[1] * s, t.at[2] + pos[2] * s);
      o.rotation.set(rot[0], rot[1], rot[2]);
      o.scale.set(scale[0] * s, scale[1] * s, scale[2] * s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      if (color) mesh.setColorAt(i, c.set(color));
    };
    trees.forEach((t, i) => {
      const green = t.color ?? '#4fa83d';
      place(trunks.current, i, t, [0, 0.3, 0], [0.12, 0.6, 0.12], [0, 0, 0], '#8a5a34');
      place(low.current, i, t, [0, 1.05, 0], [0.6, 0.65, 0.6], [0, 0, 0], green);
      place(high.current, i, t, [0.15, 1.45, 0.05], [0.38, 0.4, 0.38], [0.4, 0.6, 0], green);
    });
    for (const m of [trunks.current, low.current, high.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [trees]);
  const key = trees.length;
  return (
    <>
      <instancedMesh key={`t${key}`} ref={trunks} args={[GEO.cylLow, WHITE, trees.length]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh key={`l${key}`} ref={low} args={[GEO.blob, WHITE, trees.length]} castShadow frustumCulled={false} />
      <instancedMesh key={`h${key}`} ref={high} args={[GEO.blob, WHITE, trees.length]} castShadow frustumCulled={false} />
    </>
  );
}

/** Small parked/driving car, nose along +x. */
export function Car({ color, at = [0, 0, 0], rotY = 0 }: { color: string; at?: Vec3; rotY?: number }) {
  return (
    <group position={at} rotation={[0, rotY, 0]}>
      <Box size={[1.1, 0.35, 0.6]} at={[0, 0.12, 0]} color={color} rounded={0.08} />
      <Box size={[0.6, 0.28, 0.52]} at={[-0.08, 0.45, 0]} color="#dff3ff" rounded={0.06} />
      <Cyl r={0.13} h={0.64} at={[0.32, 0.13, 0]} rot={[Math.PI / 2, 0, 0]} color="#2c2c34" low center shadow={false} />
      <Cyl r={0.13} h={0.64} at={[-0.32, 0.13, 0]} rot={[Math.PI / 2, 0, 0]} color="#2c2c34" low center shadow={false} />
    </group>
  );
}

export interface WindowGridProps {
  /** Building footprint center and size. */
  at: Vec3;
  w: number;
  d: number;
  floors: number;
  floorHeight?: number;
  baseHeight?: number;
  cols?: number;
  /** Share of windows lit, 0–1. Activity will drive this from M2 on. */
  lit?: number;
  litColor?: string;
  darkColor?: string;
  seed?: number;
}

/**
 * Windows on the two faces the camera can see (+x and +z). Each window has a
 * fixed pseudo-random threshold, so changing `lit` turns windows on and off
 * one by one instead of reshuffling.
 */
export function WindowGrid({ at, w, d, floors, floorHeight = 1, baseHeight = 0.6, cols = 3, lit = 0.5, litColor = '#ffe27a', darkColor = '#5b6f86', seed = 1 }: WindowGridProps) {
  const out: ReactNode[] = [];
  const winH = floorHeight * 0.5;
  for (const face of ['x', 'z'] as const) {
    const span = face === 'x' ? d : w;
    const step = span / cols;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const offset = -span / 2 + step * (c + 0.5);
        const y = at[1] + baseHeight + f * floorHeight;
        const threshold = fract(Math.sin((f * 31 + c * 7 + seed * 13 + (face === 'x' ? 0 : 101)) * 12.9898) * 43758.5453);
        const on = threshold < lit;
        const color = on ? litColor : darkColor;
        const pos: Vec3 = face === 'x' ? [at[0] + w / 2 + 0.01, y, at[2] + offset] : [at[0] + offset, y, at[2] + d / 2 + 0.01];
        const size: Vec3 = face === 'x' ? [0.06, winH, step * 0.55] : [step * 0.55, winH, 0.06];
        out.push(<Box key={`${face}-${f}-${c}`} size={size} at={pos} color={color} glow={on ? 0.6 : 0} shadow={false} />);
      }
    }
  }
  return <>{out}</>;
}

const fract = (n: number) => n - Math.floor(n);

const UP = new THREE.Vector3(0, 1, 0);

/** A thin line between two points: guy ropes, tie-downs. */
export function Rope({ from, to, color = '#3a3328', r = 0.025 }: { from: Vec3; to: Vec3; color?: string; r?: number }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
  const mid = a.add(b).multiplyScalar(0.5);
  return <mesh geometry={GEO.cylLow} material={mat(color)} position={mid} quaternion={q} scale={[r, len, r]} />;
}

export const TARP_BLUE = '#3d7fd9';

/**
 * A tarp thrown over a w×d block whose top is at `top`: a sheet across the
 * top, skirts hanging `drop` down every side with a darker hem, tie-down
 * ropes across it and, if `pegs`, guy ropes from each corner to a ground peg.
 */
export function Tarp({ w, d, top, drop, at = [0, 0, 0], color = TARP_BLUE, hem = '#2c62b0', pegs = true }: { w: number; d: number; top: number; drop: number; at?: Vec3; color?: string; hem?: string; pegs?: boolean }) {
  const t = 0.05;
  const skirtY = top - drop;
  const bands = Math.max(2, Math.round(Math.max(w, d) / 1.6));
  const alongX = w >= d;
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  return (
    <group position={at}>
      <Box size={[w + t * 2, 0.07, d + t * 2]} at={[0, top, 0]} color={color} rounded={0.03} />
      {/* skirts, with a darker hem */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[w, drop, t]} at={[0, skirtY, s * (d / 2 + t / 2)]} color={color} shadow={false} />
          <Box size={[w, 0.08, t + 0.02]} at={[0, skirtY, s * (d / 2 + t / 2)]} color={hem} shadow={false} />
          <Box size={[t, drop, d]} at={[s * (w / 2 + t / 2), skirtY, 0]} color={color} shadow={false} />
          <Box size={[t + 0.02, 0.08, d]} at={[s * (w / 2 + t / 2), skirtY, 0]} color={hem} shadow={false} />
        </group>
      ))}
      {/* tie-downs over the top and down both skirts */}
      {Array.from({ length: bands }, (_, i) => {
        const f = -0.5 + (i + 0.5) / bands;
        return alongX ? (
          <group key={i}>
            <Box size={[0.05, 0.02, d + t * 2 + 0.02]} at={[f * w, top + 0.07, 0]} color="#e8dcc0" shadow={false} />
            {[-1, 1].map((s) => (
              <Box key={s} size={[0.05, drop, 0.02]} at={[f * w, skirtY, s * (d / 2 + t + 0.01)]} color="#e8dcc0" shadow={false} />
            ))}
          </group>
        ) : (
          <group key={i}>
            <Box size={[w + t * 2 + 0.02, 0.02, 0.05]} at={[0, top + 0.07, f * d]} color="#e8dcc0" shadow={false} />
            {[-1, 1].map((s) => (
              <Box key={s} size={[0.02, drop, 0.05]} at={[s * (w / 2 + t + 0.01), skirtY, f * d]} color="#e8dcc0" shadow={false} />
            ))}
          </group>
        );
      })}
      {pegs &&
        corners.map(([sx, sz]) => {
          const peg: Vec3 = [sx * (w / 2 + 0.45), 0, sz * (d / 2 + 0.45)];
          return (
            <group key={`${sx}${sz}`}>
              <Rope from={[sx * (w / 2 + t), skirtY + 0.05, sz * (d / 2 + t)]} to={[peg[0], 0.08, peg[2]]} color="#e8dcc0" r={0.02} />
              <Box size={[0.08, 0.14, 0.08]} at={peg} color="#8a5a34" shadow={false} />
            </group>
          );
        })}
    </group>
  );
}
