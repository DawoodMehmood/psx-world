import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeBufferGeometries as mergeGeometries } from 'three-stdlib';

/** Shared by every merged plain-color part: the part's color is baked into vertex colors. */
const VERTEX_COLOR_MATERIAL = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, flatShading: true, vertexColors: true });

/** A kit-style material whose only visual property is its color: safe to fold into vertex colors. */
function isPlainColor(m: THREE.Material): m is THREE.MeshStandardMaterial {
  const s = m as THREE.MeshStandardMaterial;
  return (
    s.isMeshStandardMaterial === true &&
    !s.map &&
    s.flatShading &&
    s.emissive.getHex() === 0 &&
    s.roughness === VERTEX_COLOR_MATERIAL.roughness &&
    s.metalness === 0 &&
    !s.transparent &&
    s.side === THREE.FrontSide
  );
}

/**
 * Draws its children as a few merged meshes instead of one mesh each: one per
 * shadow mode for plain-color parts (colors are baked into vertex colors), plus
 * one per glowing or otherwise special material. Use it only around parts that
 * never move on their own relative to the `<Static>`: no refs, no useFrame on
 * them. The `<Static>` itself may sit inside something that moves. Everything
 * inside still reacts to React prop changes, because the merge is redone after
 * every commit of the parent that owns the `<Static>`. Do not nest them.
 *
 * Children stay mounted but hidden, so they cost no draw calls. Textured
 * meshes are left as they are.
 */
export function Static({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const root = group.current;
    if (!root) return;
    root.updateWorldMatrix(true, true);
    const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; geos: THREE.BufferGeometry[] }>();
    const color = new THREE.Color();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || o.userData.mergedByStatic) return;
      const source = mesh.material as THREE.MeshStandardMaterial;
      // Textured meshes need their UVs, which the merge drops: leave them as they are.
      if (source.map) return;
      const plain = isPlainColor(source);
      const material = plain ? VERTEX_COLOR_MATERIAL : source;
      const key = `${material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [] }));
      const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
      mesh.updateWorldMatrix(true, false);
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
      if (plain) {
        const n = geo.attributes.position.count;
        const colors = new Float32Array(n * 3);
        color.copy(source.color);
        for (let i = 0; i < n; i++) color.toArray(colors, i * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      }
      b.geos.push(geo);
      mesh.visible = false;
    });
    const merged = new THREE.Group();
    merged.userData.mergedByStatic = true;
    const owned: THREE.BufferGeometry[] = [];
    for (const b of buckets.values()) {
      const geometry = mergeGeometries(b.geos);
      b.geos.forEach((g) => g.dispose());
      if (!geometry) continue;
      owned.push(geometry);
      const m = new THREE.Mesh(geometry, b.material);
      m.castShadow = b.cast;
      m.receiveShadow = b.receive;
      m.userData.mergedByStatic = true;
      merged.add(m);
    }
    root.add(merged);
    return () => {
      root.remove(merged);
      owned.forEach((g) => g.dispose());
    };
  });
  return <group ref={group}>{children}</group>;
}
