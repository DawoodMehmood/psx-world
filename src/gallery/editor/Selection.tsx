import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { BoxHelper, Euler, Vector3, type Object3D } from 'three';
import { useDraftStore } from '../../world/editDraft';
import { FIELDS, readVec, setDraftVec, useEditor } from './store';

/** True while a gizmo is being dragged (and a moment after), so the click that ends a drag does not count as clicking empty space. */
export const gizmo = { busy: false };

/** The part a mesh belongs to: its own `src`, or the nearest parent's. */
export function srcOf(o: Object3D | null): string | null {
  for (let n = o; n; n = n.parent) if (typeof n.userData?.src === 'string') return n.userData.src;
  return null;
}

const round = (n: number) => +n.toFixed(4);

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
      if (selected && r) r.traverse((o) => o.userData?.src === selected && list.push(o));
      const same = list.length === found.current.length && list.every((o, i) => o === found.current[i]);
      if (!same) {
        found.current = list;
        clear();
        helpers.current = list.map((o) => {
          const h = new BoxHelper(o, 0xffd23f);
          scene.add(h);
          return h;
        });
        setTarget(list[0] ?? null);
        useEditor.setState({ copies: list.length });
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
  // a position or rotation computed as a whole in the source cannot be dragged
  const movable = slotsOf(mode === 'translate' ? 'at' : 'rot').whole === undefined;
  if (!movable) return null;

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
