import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Object3D, type DirectionalLight, type HemisphereLight, type InstancedMesh } from 'three';
import { WORLD_HALF } from '../../config/layout';
import type { MarketMood } from '../../engine/types';
import { useMarketVisual } from '../../store/useSimStore';

/**
 * The sky and the light follow the market (SPEC §11): brighter and warmer in
 * a broad rally, hazy when quiet, overcast in a broad selloff, darker with
 * rain when stormy. Subtle, and always eased, never switched.
 */
interface Look {
  skyTop: string;
  skyBottom: string;
  sun: string;
  sunIntensity: number;
  hemiSky: string;
  hemiIntensity: number;
}

const LOOKS: Record<MarketMood | 'STORMY', Look> = {
  NORMAL: { skyTop: '#8fd3f4', skyBottom: '#d9f1fb', sun: '#fff1d6', sunIntensity: 2.1, hemiSky: '#fff6e0', hemiIntensity: 1.1 },
  QUIET: { skyTop: '#a3d3e8', skyBottom: '#e6eff2', sun: '#fbf1e2', sunIntensity: 1.9, hemiSky: '#f6f2e8', hemiIntensity: 1.05 },
  BROAD_RALLY: { skyTop: '#62c0f5', skyBottom: '#fff0c4', sun: '#ffe2a8', sunIntensity: 2.45, hemiSky: '#fff0cc', hemiIntensity: 1.2 },
  BROAD_SELLOFF: { skyTop: '#8f9cab', skyBottom: '#cfd5da', sun: '#e8edf2', sunIntensity: 1.35, hemiSky: '#e6ebf0', hemiIntensity: 0.95 },
  STORMY: { skyTop: '#6d7886', skyBottom: '#aeb6be', sun: '#dde4ea', sunIntensity: 1.0, hemiSky: '#dfe5ea', hemiIntensity: 0.85 },
};

export function Weather() {
  const { mood, stormy } = useMarketVisual();
  const look = LOOKS[stormy ? 'STORMY' : mood];
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const current = useMemo(
    () => ({ top: new Color(LOOKS.NORMAL.skyTop), bottom: new Color(LOOKS.NORMAL.skyBottom), written: '' }),
    [],
  );
  const target = useMemo(() => ({ top: new Color(), bottom: new Color(), sun: new Color(), hemi: new Color() }), []);

  useFrame((_, frameDt) => {
    const k = 1 - Math.exp(-Math.min(frameDt, 0.1) * 1.2);
    current.top.lerp(target.top.set(look.skyTop), k);
    current.bottom.lerp(target.bottom.set(look.skyBottom), k);
    const css = `${current.top.getHexString()}${current.bottom.getHexString()}`;
    if (css !== current.written) {
      const root = document.documentElement.style;
      root.setProperty('--sky-top', `#${current.top.getHexString()}`);
      root.setProperty('--sky-bottom', `#${current.bottom.getHexString()}`);
      current.written = css;
    }
    if (sun.current) {
      sun.current.color.lerp(target.sun.set(look.sun), k);
      sun.current.intensity += (look.sunIntensity - sun.current.intensity) * k;
    }
    if (hemi.current) {
      hemi.current.color.lerp(target.hemi.set(look.hemiSky), k);
      hemi.current.intensity += (look.hemiIntensity - hemi.current.intensity) * k;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[LOOKS.NORMAL.hemiSky, '#7fa86a', LOOKS.NORMAL.hemiIntensity]} />
      <directionalLight
        ref={sun}
        position={[36, 60, 22]}
        intensity={LOOKS.NORMAL.sunIntensity}
        color={LOOKS.NORMAL.sun}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-62}
        shadow-camera-right={62}
        shadow-camera-top={62}
        shadow-camera-bottom={-62}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <Rain on={stormy} />
    </>
  );
}

const DROPS = 700;
const RAIN_TOP = 30;

/** Light rain over the island: thin streaks that fade in and out with the storm. */
function Rain({ on }: { on: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const drops = useMemo(
    () =>
      Array.from({ length: DROPS }, (_, i) => ({
        x: (fract(Math.sin(i * 12.9898) * 43758.5453) * 2 - 1) * WORLD_HALF,
        z: (fract(Math.sin(i * 78.233) * 43758.5453) * 2 - 1) * WORLD_HALF,
        y: fract(Math.sin(i * 39.425) * 43758.5453) * RAIN_TOP,
        speed: 26 + fract(Math.sin(i * 7.31) * 43758.5453) * 10,
      })),
    [],
  );
  const dummy = useMemo(() => new Object3D(), []);
  const amount = useRef(0);
  useFrame((_, frameDt) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(frameDt, 0.1);
    amount.current += ((on ? 1 : 0) - amount.current) * (1 - Math.exp(-dt * 1.5));
    const visible = Math.round(amount.current * DROPS);
    m.visible = visible > 0;
    m.count = visible;
    for (let i = 0; i < visible; i++) {
      const d = drops[i];
      d.y -= d.speed * dt;
      if (d.y < 0) d.y += RAIN_TOP;
      dummy.position.set(d.x, d.y, d.z);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, DROPS]} frustumCulled={false}>
      <boxGeometry args={[0.04, 0.9, 0.04]} />
      <meshBasicMaterial color="#dbe8f4" transparent opacity={0.6} />
    </instancedMesh>
  );
}

const fract = (n: number) => n - Math.floor(n);
