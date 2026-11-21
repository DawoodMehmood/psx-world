import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergeStatics } from '../src/world/Static';

const plain = (hex: number) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, metalness: 0, flatShading: true });
const box = (x: number, hex: number, cast = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), plain(hex));
  m.position.set(x, 0, 0);
  m.castShadow = cast;
  m.receiveShadow = cast;
  return m;
};
const group = (...meshes: THREE.Mesh[]) => {
  const g = new THREE.Group();
  meshes.forEach((m) => g.add(m));
  g.updateWorldMatrix(true, true);
  return g;
};
const meshesOf = (g: THREE.Group) => g.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
const identity = new THREE.Matrix4();

describe('mergeStatics', () => {
  it('folds the plain-colour meshes of many groups into one mesh per shadow mode, whatever their colours', () => {
    const a = group(box(0, 0xff0000), box(2, 0x00ff00), box(4, 0x0000ff, false));
    const b = group(box(6, 0xffff00), box(8, 0x00ffff, false));
    const { merged } = mergeStatics([a, b], identity);
    expect(meshesOf(merged)).toHaveLength(2);
    const casting = meshesOf(merged).find((m) => m.castShadow)!;
    expect(casting.geometry.attributes.position.count).toBe(3 * 36);
  });

  it('hides the originals and keeps their world positions in the merged geometry', () => {
    const m = box(5, 0xff0000);
    const g = group(m);
    const { merged } = mergeStatics([g], identity);
    expect(m.visible).toBe(false);
    const geo = meshesOf(merged)[0].geometry;
    geo.computeBoundingBox();
    expect(geo.boundingBox!.min.x).toBeCloseTo(4.5, 6);
    expect(geo.boundingBox!.max.x).toBeCloseTo(5.5, 6);
  });

  it('bakes each part’s colour into vertex colours', () => {
    const { merged } = mergeStatics([group(box(0, 0xff0000), box(2, 0x00ff00))], identity);
    const colors = meshesOf(merged)[0].geometry.attributes.color;
    expect(colors).toBeTruthy();
    expect(new Set(Array.from({ length: colors.count }, (_, i) => `${colors.getX(i).toFixed(2)},${colors.getY(i).toFixed(2)}`)).size).toBe(2);
  });

  it('`single` makes one mesh whatever the shadow modes, with the shadow setting asked for', () => {
    const g = group(box(0, 0xff0000), box(2, 0x00ff00, false));
    const person = mergeStatics([g], identity, true, false).merged;
    expect(meshesOf(person)).toHaveLength(1);
    expect(meshesOf(person)[0].castShadow).toBe(false);
    const g2 = group(box(0, 0xff0000), box(2, 0x00ff00, false));
    expect(meshesOf(mergeStatics([g2], identity, true, true).merged)[0].castShadow).toBe(true);
  });

  it('leaves textured meshes alone, and glowing ones in a mesh of their own', () => {
    const tex = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), Object.assign(plain(0xffffff), { map: new THREE.Texture() }));
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), Object.assign(plain(0xffcc00), { emissive: new THREE.Color(0xffaa00), emissiveIntensity: 1 }));
    const g = group(box(0, 0xff0000), tex, glow);
    const { merged } = mergeStatics([g], identity);
    expect(tex.visible).toBe(true);
    expect(glow.visible).toBe(false);
    expect(meshesOf(merged)).toHaveLength(2);
  });

  it('returns the geometries it owns so they can be disposed', () => {
    const { merged, owned } = mergeStatics([group(box(0, 0xff0000), box(2, 0x00ff00, false))], identity);
    expect(owned).toHaveLength(meshesOf(merged).length);
  });
});
