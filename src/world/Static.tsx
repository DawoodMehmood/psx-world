import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeBufferGeometries as mergeGeometries } from 'three-stdlib';

/**
 * Draws its children as a few merged meshes (one per material and shadow mode)
 * instead of one mesh each. Use it only around parts that never move on their
 * own: no refs, no useFrame, no per-tick transforms. Everything inside still
 * reacts to React prop changes, because the merge is redone after every commit
 * of the parent that owns the `<Static>`.
 *
 * Children stay mounted but hidden, so they cost no draw calls.
 */
export function Static({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const root = group.current;
    if (!root) return;
    root.updateWorldMatrix(true, true);
    const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; geos: THREE.BufferGeometry[] }>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || o.userData.mergedByStatic) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      // Textured meshes need their UVs, which the merge drops: leave them as they are.
      if (material.map) return;
      const key = `${material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [] }));
      const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
      mesh.updateWorldMatrix(true, false);
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
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
