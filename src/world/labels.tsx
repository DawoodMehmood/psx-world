import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

/**
 * World-anchored DOM labels without nested React roots. The DOM side
 * registers an element with a world position; a projector inside the canvas
 * moves each element to its screen position every frame.
 */
interface Anchor {
  pos: Vector3;
  el: HTMLElement;
}

const anchors = new Map<string, Anchor>();

export function anchorRef(id: string, pos: [number, number, number]) {
  return (el: HTMLElement | null) => {
    if (el) anchors.set(id, { pos: new Vector3(...pos), el });
    else anchors.delete(id);
  };
}

const v = new Vector3();

export function LabelProjector() {
  useFrame(({ camera, size }) => {
    anchors.forEach(({ pos, el }) => {
      v.copy(pos).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    });
  });
  return null;
}
