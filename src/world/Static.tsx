import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeBufferGeometries as mergeGeometries } from 'three-stdlib';
import { EditingContext } from './editing';

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

interface Bucket {
  material: THREE.Material;
  cast: boolean;
  receive: boolean;
  geos: THREE.BufferGeometry[];
}

/** Adds the meshes under `root` to the buckets as geometry in `toRoot`'s space, and hides the originals. */
function collect(root: THREE.Object3D, toRoot: THREE.Matrix4, buckets: Map<string, Bucket>, single = false, cast = true) {
  const color = new THREE.Color();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || o.userData.mergedByStatic) return;
    const source = mesh.material as THREE.MeshStandardMaterial;
    // Textured meshes need their UVs, which the merge drops: leave them as they are.
    if (source.map) return;
    const plain = isPlainColor(source);
    const material = plain ? VERTEX_COLOR_MATERIAL : source;
    // `single` ignores shadow modes: one mesh per material, casting and receiving, for small things like people and cars
    const key = single ? `${material.uuid}` : `${material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material, cast: single ? cast : mesh.castShadow, receive: single || mesh.receiveShadow, geos: [] }));
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
}

/** Turns buckets into merged meshes under a new group, returning the group and the geometries it owns (to dispose). */
function build(buckets: Map<string, Bucket>) {
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
  return { merged, owned };
}

/**
 * Merges the meshes under each of `roots` into a few meshes, in the space of `toRoot`'s inverse, hiding the originals.
 * The pure core of `Static` and `StaticScope`, exported so it can be tested without React.
 */
export function mergeStatics(roots: Iterable<THREE.Object3D>, toRoot: THREE.Matrix4, single = false, cast = true) {
  const buckets = new Map<string, Bucket>();
  for (const root of roots) collect(root, toRoot, buckets, single, cast);
  return build(buckets);
}

/** Collects the fixed `<Static>`s of one plot and merges them together, once per burst of changes. */
class Scope {
  members = new Set<THREE.Group>();
  root: THREE.Group | null = null;
  private current: { merged: THREE.Group; owned: THREE.BufferGeometry[] } | null = null;
  private queued = false;
  private dead = false;

  request() {
    if (this.queued || this.dead) return;
    this.queued = true;
    // after this commit's layout effects, before the next paint
    queueMicrotask(() => {
      this.queued = false;
      if (!this.dead) this.run();
    });
  }

  private clear() {
    if (!this.current) return;
    this.root?.remove(this.current.merged);
    this.current.owned.forEach((g) => g.dispose());
    this.current = null;
  }

  private run() {
    const root = this.root;
    if (!root) return;
    this.clear();
    root.updateWorldMatrix(true, true);
    const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map<string, Bucket>();
    for (const member of this.members) collect(member, toRoot, buckets);
    this.current = build(buckets);
    root.add(this.current.merged);
  }

  dispose() {
    this.dead = true;
    this.clear();
  }
}

const ScopeContext = createContext<Scope | null>(null);

/**
 * Merges every fixed `<Static>` inside it into a few meshes for the whole
 * group (a plot, a district, the Exchange), instead of a few per `<Static>`.
 * A `<Static moving>` inside keeps its own merge, because it moves.
 */
export function StaticScope({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const scope = useMemo(() => new Scope(), []);
  useLayoutEffect(() => {
    scope.root = group.current;
    scope.request();
    return () => scope.dispose();
  }, [scope]);
  return (
    <ScopeContext.Provider value={scope}>
      <group ref={group}>{children}</group>
    </ScopeContext.Provider>
  );
}

/**
 * Draws its children as a few merged meshes instead of one mesh each: one per
 * shadow mode for plain-color parts (colors are baked into vertex colors), plus
 * one per glowing or otherwise special material. Use it only around parts that
 * never move on their own relative to the `<Static>`: no refs, no useFrame on
 * them. Everything inside still reacts to React prop changes, because the merge
 * is redone after every commit of the parent that owns the `<Static>`. Do not nest them.
 *
 * Inside a `<StaticScope>` the merge is shared by the whole scope, so a plot
 * costs a handful of meshes however many `<Static>`s it has. Anything that
 * moves (a worker, a vehicle, a crane jib) must say `moving`: it then keeps
 * its own merge and travels with its group, as before.
 *
 * `single` folds everything of one material into one mesh whatever its shadow
 * settings (people and vehicles use it with `moving`: one draw call each);
 * `cast={false}` lets a tiny thing, a person, skip the shadow pass.
 *
 * Children stay mounted but hidden, so they cost no draw calls. Textured
 * meshes are left as they are.
 */
export function Static({ children, moving = false, single = false, cast = true }: { children: ReactNode; moving?: boolean; single?: boolean; cast?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const scope = useContext(ScopeContext);
  // the asset editor shows every part as its own mesh, so each can be picked
  const editing = useContext(EditingContext);
  const shared = !!scope && !moving;
  useLayoutEffect(() => {
    const root = group.current;
    if (!root || editing) return;
    if (shared) {
      scope.members.add(root);
      scope.request();
      return () => {
        scope.members.delete(root);
        scope.request();
      };
    }
    root.updateWorldMatrix(true, true);
    const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map<string, Bucket>();
    collect(root, toRoot, buckets, single, cast);
    const { merged, owned } = build(buckets);
    root.add(merged);
    return () => {
      root.remove(merged);
      owned.forEach((g) => g.dispose());
    };
  });
  return <group ref={group}>{children}</group>;
}
