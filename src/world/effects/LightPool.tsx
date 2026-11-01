import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, MeshBasicMaterial, SRGBColorSpace, type Mesh } from 'three';
import { useMotion } from '../motion';

/*
 * Direction on the ground (DESIGN.md §6): a soft patch of sunlight when the
 * price is up, a patch of cloud shadow when it is down, nothing when flat. It
 * is a flat decal with a radial fade, so it reads from the zoomed-out view and
 * costs two quads per plot.
 */

let fade: CanvasTexture | null = null;
/** A white disc that fades to transparent at the edge, shared by every pool. */
function fadeTexture(): CanvasTexture {
  if (fade) return fade;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.65, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  fade = new CanvasTexture(canvas);
  fade.colorSpace = SRGBColorSpace;
  return fade;
}

const MAX_LIGHT = 0.5;
const MAX_SHADE = 0.45;

/**
 * Sunlit or shaded ground over a `w` × `d` area centered at `at`. Reads the
 * enclosing plot's `motion.pool` (−1…+1), which the plot eases each frame.
 */
export function LightPool({ at, w, d }: { at: [number, number, number]; w: number; d: number }) {
  const motion = useMotion();
  const light = useRef<Mesh>(null);
  const shade = useRef<Mesh>(null);
  const map = useMemo(fadeTexture, []);
  const lightMat = useMemo(() => new MeshBasicMaterial({ map, color: '#fff0b0', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }), [map]);
  const shadeMat = useMemo(() => new MeshBasicMaterial({ map, color: '#1b2540', transparent: true, opacity: 0, depthWrite: false }), [map]);
  useFrame(() => {
    const p = motion.pool;
    lightMat.opacity = Math.max(0, p) * MAX_LIGHT;
    shadeMat.opacity = Math.max(0, -p) * MAX_SHADE;
    if (light.current) light.current.visible = lightMat.opacity > 0.004;
    if (shade.current) shade.current.visible = shadeMat.opacity > 0.004;
  });
  return (
    <group position={at} rotation={[-Math.PI / 2, 0, 0]} scale={[w * 1.15, d * 1.15, 1]}>
      <mesh ref={light} material={lightMat} renderOrder={2} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={shade} material={shadeMat} position={[0, 0, 0.002]} renderOrder={2} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}
