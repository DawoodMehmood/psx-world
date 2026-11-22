import { Matrix4, type BufferGeometry, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';

/**
 * Reading a model's shapes so many copies of it can be drawn as instances.
 * The instanced forest (`Trees` in kit.tsx) renders one real tree model off-screen
 * and builds its instances from what that came out as, so changing the model
 * (in the code or in the asset editor) changes every tree in the forest too.
 */
export interface InstancePart {
  geometry: BufferGeometry;
  /** Where the part sits in the model, model space. */
  matrix: Matrix4;
  /** The part's own color, or null when it takes each instance's color (it was drawn with the tint material). */
  color: string | null;
  cast: boolean;
  receive: boolean;
  /** Dev only: the editor id of the element that drew it. */
  src?: string;
}

export function collectParts(model: Object3D, tint: Material): InstancePart[] {
  model.updateWorldMatrix(true, true);
  // positions are relative to the model's own origin, wherever the model itself happens to sit
  const toModel = new Matrix4().copy(model.matrixWorld).invert();
  const parts: InstancePart[] = [];
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as MeshStandardMaterial;
    parts.push({
      geometry: mesh.geometry,
      matrix: new Matrix4().multiplyMatrices(toModel, mesh.matrixWorld),
      color: material === tint ? null : `#${material.color.getHexString()}`,
      cast: mesh.castShadow,
      receive: mesh.receiveShadow,
      src: typeof mesh.userData.src === 'string' ? mesh.userData.src : undefined,
    });
  });
  return parts;
}

/** Same string when nothing about the parts changed, so a re-collect that finds nothing new causes no work. */
export const partsSignature = (parts: InstancePart[]) =>
  parts.map((p) => `${p.geometry.uuid}|${p.matrix.elements.map((e) => +e.toFixed(5)).join(',')}|${p.color}|${p.cast}|${p.receive}|${p.src ?? ''}`).join(';');
