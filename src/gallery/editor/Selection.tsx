import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { BoxHelper, Euler, Vector3, type InstancedMesh, type Object3D } from 'three';
import { useDraftStore } from '../../world/editDraft';
import { FIELDS, readScalar, readVec, setDraft, setDraftVec, useEditor } from './store';

/** True while a gizmo is being dragged (and a moment after), so the click that ends a drag does not count as clicking empty space. */
export const gizmo = { busy: false };

/** The part a mesh belongs to: its own `src`, or the nearest parent's. */
export function srcOf(o: Object3D | null): string | null {
  for (let n = o; n; n = n.parent) if (typeof n.userData?.src === 'string') return n.userData.src;
  return null;
}

const round = (n: number) => +n.toFixed(4);

/** Not inside a hidden group (the instanced forest keeps its tree model in one, to read from). */
const shown = (o: Object3D) => {
  for (let n: Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
  return true;
};

/**
 * Outlines every mesh drawn from the selected element (a part made in a loop
 * has several) and puts a move or rotate gizmo on the first. Dropping the
 * gizmo writes a draft, which the shape then draws, so the gizmo never leaves
 * a mesh where its props do not say it is.
 */
export function Selection({ root }: { root: RefObject<Object3D | null> }) {
  const selected = useEditor((s) => s.selected);
  const mode = useEditor((s) => s.mode);
  const info = useEditor((s) => s.info);
  const scene = useThree((s) => s.scene);
  const [target, setTarget] = useState<Object3D | null>(null);
  const found = useRef<Object3D[]>([]);
  const helpers = useRef<BoxHelper[]>([]);
  const frames = useRef(0);
  const start = useRef({ pos: new Vector3(), rot: new Euler() });

  const clear = () => {
    helpers.current.forEach((h) => {
      scene.remove(h);
      h.dispose();
    });
    helpers.current = [];
  };
  useEffect(() => clear, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const r = root.current;
    if (frames.current++ % 5 === 0) {
      const list: Object3D[] = [];
      if (selected && r) r.traverse((o) => o.userData?.src === selected && shown(o) && list.push(o));
      const same = list.length === found.current.length && list.every((o, i) => o === found.current[i]);
      if (!same) {
        found.current = list;
        clear();
        // the instanced forest is one mesh for hundreds of trees: no outline round it all, and no gizmo (it would move the whole forest)
        const solid = list.filter((o) => !o.userData.instanced);
        helpers.current = solid.map((o) => {
          const h = new BoxHelper(o, 0xffd23f);
          scene.add(h);
          return h;
        });
        setTarget(solid[0] ?? null);
        let parent: string | null = null;
        for (let n = (solid[0] ?? list[0])?.parent; n && !parent; n = n.parent) {
          const src = n.userData?.src;
          if (typeof src === 'string' && src !== selected) parent = src;
        }
        const copies = list.reduce((n, o) => n + ((o as InstancedMesh).isInstancedMesh ? (o as InstancedMesh).count : 1), 0);
        useEditor.setState({ copies, parent, instancedOnly: list.length > 0 && solid.length === 0 });
      }
    }
    helpers.current.forEach((h) => h.update());
  });

  if (!target || !selected || !info) return null;
  const draft = useDraftStore.getState().drafts[selected];
  const slotsOf = (key: 'at' | 'rot') => {
    const f = (FIELDS[info.name] ?? []).find((x) => x.key === key);
    return f ? readVec(f, info, draft) : { slots: [] };
  };
  // a Car turns about y only (its heading), everything else about all three axes; a Tree does not turn
  const turn = info.name === 'Car' ? 'rotY' : 'rot';
  const fields = FIELDS[info.name] ?? [];
  if (mode === 'rotate' && !fields.some((f) => f.key === turn)) return null;
  // a position or rotation computed as a whole in the source cannot be dragged
  if (mode === 'translate' ? slotsOf('at').whole !== undefined : turn === 'rot' && slotsOf('rot').whole !== undefined) return null;
  const heading = fields.find((f) => f.key === 'rotY');
  const headingOpen = !heading || readScalar(heading, info, draft).editable;
  if (mode === 'rotate' && turn === 'rotY' && !headingOpen) return null;

  return (
    <TransformControls
      object={target}
      mode={mode}
      size={0.8}
      translationSnap={0.05}
      rotationSnap={Math.PI / 12}
      onMouseDown={() => {
        gizmo.busy = true;
        start.current.pos.copy(target.position);
        start.current.rot.copy(target.rotation);
      }}
      onMouseUp={() => {
        setTimeout(() => (gizmo.busy = false), 80);
        const { pos, rot } = start.current;
        if (mode === 'translate') {
          const delta = target.position.clone().sub(pos);
          target.position.copy(pos);
          const { slots } = slotsOf('at');
          if (delta.length() > 1e-6) setDraftVec('at', slots.map((s, i) => (s.editable ? round(s.value + delta.toArray()[i]) : null)));
        } else if (turn === 'rotY') {
          const was = rot.y;
          const now = target.rotation.y;
          target.rotation.copy(rot);
          if (Math.abs(now - was) > 1e-6) setDraft('rotY', round(now));
        } else {
          const now = [target.rotation.x, target.rotation.y, target.rotation.z];
          const before = [rot.x, rot.y, rot.z];
          target.rotation.copy(rot);
          const { slots } = slotsOf('rot');
          if (now.some((v, i) => Math.abs(v - before[i]) > 1e-6)) setDraftVec('rot', slots.map((s, i) => (s.editable ? round(now[i]) : null)));
        }
      }}
    />
  );
}
