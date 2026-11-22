import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { collectParts, partsSignature } from '../src/world/instances';

const geo = new BoxGeometry(1, 1, 1);
const tint = new MeshStandardMaterial({ color: '#ffffff' });
const brown = new MeshStandardMaterial({ color: '#8a5a34' });

function model(crownY = 1.05) {
  const g = new Group();
  const trunk = new Mesh(geo, brown);
  trunk.position.set(0, 0.3, 0);
  trunk.scale.set(0.12, 0.6, 0.12);
  trunk.castShadow = trunk.receiveShadow = true;
  trunk.userData.src = 'src/world/kit.tsx#1';
  const crown = new Mesh(geo, tint);
  crown.position.set(0, crownY, 0);
  crown.castShadow = true;
  g.add(trunk, crown);
  return g;
}

describe('reading a model for instancing', () => {
  it('reads each shape: where it sits, its own color or the tree tint, its shadow flags', () => {
    const [trunk, crown] = collectParts(model(), tint);
    expect(trunk.color).toBe('#8a5a34');
    expect(crown.color).toBeNull();
    expect(trunk.matrix.elements[13]).toBeCloseTo(0.3);
    expect(trunk.matrix.elements[5]).toBeCloseTo(0.6);
    expect([trunk.cast, trunk.receive, crown.cast, crown.receive]).toEqual([true, true, true, false]);
    expect(trunk.src).toBe('src/world/kit.tsx#1');
    expect(crown.src).toBeUndefined();
  });

  it('gives the same signature until a shape changes', () => {
    const a = partsSignature(collectParts(model(), tint));
    expect(partsSignature(collectParts(model(), tint))).toBe(a);
    expect(partsSignature(collectParts(model(1.3), tint))).not.toBe(a);
  });

  it('reads shapes relative to the model, not the world', () => {
    const parent = new Group();
    parent.position.set(50, 0, -20);
    const g = model();
    parent.add(g);
    const [trunk] = collectParts(g, tint);
    expect(trunk.matrix.elements[12]).toBeCloseTo(0);
    expect(trunk.matrix.elements[13]).toBeCloseTo(0.3);
  });

  it('reads a shape nested in a moved group in model space', () => {
    const g = new Group();
    const inner = new Group();
    inner.position.set(1, 2, 3);
    inner.add(new Mesh(geo, tint));
    g.add(inner);
    const [part] = collectParts(g, tint);
    expect([part.matrix.elements[12], part.matrix.elements[13], part.matrix.elements[14]]).toEqual([1, 2, 3]);
  });
});
