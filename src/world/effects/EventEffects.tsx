import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, CylinderGeometry, MeshBasicMaterial, MeshStandardMaterial, Object3D, RingGeometry, TorusGeometry, type Group, type InstancedMesh, type Mesh } from 'three';
import { createRng } from '../../engine/rng';
import type { EventType, MarketEvent } from '../../engine/types';
import { Ball, Box, Cyl, GEO, mat } from '../kit';

/** Effects are placed in coordinates centered on the site; `size` is the site's side. */
type EffectProps = { magnitude: number; top: number; accent: string; seed: number; size: number };

const EFFECTS: Partial<Record<EventType, (p: EffectProps) => React.JSX.Element>> = {
  BIG_UP: Fireworks,
  BIG_DOWN: Alarm,
  VOLUME_SPIKE: Spotlights,
  NEW_HIGH: GoldRing,
  NEW_LOW: RainCloud,
  RESUME: ResumePulse,
  DIVIDEND: CoinShower,
};

/**
 * Temporary effects for the company's active events (SPEC §10). Each one is
 * mounted while its event is active and sized by the event's magnitude.
 * HALT has no entry here: the plot draws barrier tape and freezes instead.
 */
export function EventEffects({ events, top, accent, size }: { events: MarketEvent[]; top: number; accent: string; size: number }) {
  return (
    <>
      {events.map((e) => {
        const Effect = EFFECTS[e.type];
        return Effect ? <Effect key={e.id} magnitude={e.magnitude} top={top} accent={accent} seed={e.startIndex} size={size} /> : null;
      })}
    </>
  );
}

/** Age in seconds since the effect mounted. */
function useAge() {
  const start = useRef<number | null>(null);
  return (now: number) => {
    if (start.current === null) start.current = now;
    return now - start.current;
  };
}

const dummy = new Object3D();
const glowMaterial = () => new MeshBasicMaterial({ toneMapped: false });
const CONFETTI = ['#ff5a5f', '#ffd23f', '#3ec1d3', '#7bd389', '#ff9f43', '#b388ff', '#ffffff'];

/** Big jump up: confetti bursts over the plot, bigger for bigger moves. */
function Fireworks({ magnitude, top, seed }: EffectProps) {
  const count = Math.round(24 + magnitude * 40);
  const mesh = useRef<InstancedMesh>(null);
  const material = useMemo(glowMaterial, []);
  const dirs = useMemo(() => {
    const rng = createRng(seed + 11);
    return Array.from({ length: count }, () => {
      const a = rng() * Math.PI * 2;
      const up = 0.3 + rng() * 0.9;
      const r = Math.sqrt(Math.max(0, 1 - up * up));
      const s = 0.7 + rng() * 0.6;
      return [Math.cos(a) * r * s, up * s, Math.sin(a) * r * s];
    });
  }, [count, seed]);
  useLayoutEffect(() => {
    const c = new Color();
    for (let i = 0; i < count; i++) mesh.current?.setColorAt(i, c.set(CONFETTI[i % CONFETTI.length]));
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    // The material may already be compiled without instance colors; recompile with them.
    material.needsUpdate = true;
  }, [count, material]);
  const age = useAge();
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const CYCLE = 1.8;
    const a = age(clock.elapsedTime);
    const burst = Math.floor(a / CYCLE);
    const t = a % CYCLE;
    const ox = Math.sin(burst * 2.3) * 1.6;
    const oz = Math.cos(burst * 1.7) * 1.6;
    const oy = top + 1.2 + (burst % 2) * 0.8;
    const speed = 3 + magnitude * 2.5;
    for (let i = 0; i < count; i++) {
      const [dx, dy, dz] = dirs[i];
      dummy.position.set(ox + dx * speed * t, oy + dy * speed * t - 2.2 * t * t, oz + dz * speed * t);
      dummy.rotation.set(t * 6 + i, t * 4, 0);
      dummy.scale.setScalar(0.3 * Math.max(0, 1 - t / CYCLE));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[GEO.box, material, count]} frustumCulled={false} />;
}

/** Big drop: a warning siren on a post and dark smoke rising from the plant. */
function Alarm({ magnitude, top, size }: EffectProps) {
  const edge = size / 2 - 0.6;
  const lamp = useMemo(() => new MeshStandardMaterial({ color: '#ff3b2f', emissive: '#ff2a1a', emissiveIntensity: 1, flatShading: true }), []);
  const beams = useRef<Group>(null);
  const puffs = useRef<(Mesh | null)[]>([]);
  const n = Math.round(3 + magnitude * 4);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lamp.emissiveIntensity = Math.sin(t * 10) > 0 ? 1.6 : 0.2;
    if (beams.current) beams.current.rotation.y = t * 5;
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const p = (t * 0.3 + i / n) % 1;
      m.position.set(p * 0.8, p * 3.2, -p * 0.4);
      m.scale.setScalar((0.3 + p * 0.7) * Math.sin(Math.PI * Math.min(1, p * 1.1)));
    });
  });
  return (
    <>
      <group position={[-edge, 0, edge]}>
        <Cyl r={0.06} h={2.2} color="#7a7a7a" low />
        <Box size={[0.4, 0.14, 0.4]} at={[0, 2.2, 0]} color="#3a3a3a" />
        <mesh geometry={GEO.ball} material={lamp} position={[0, 2.5, 0]} scale={0.22} />
        <group ref={beams} position={[0, 2.5, 0]}>
          <Box size={[1.6, 0.05, 0.2]} at={[0.9, 0, 0]} color="#ff6a4a" glow={1.2} shadow={false} />
          <Box size={[1.6, 0.05, 0.2]} at={[-0.9, 0, 0]} color="#ff6a4a" glow={1.2} shadow={false} />
        </group>
      </group>
      <group position={[-1.5, top * 0.75, -1.5]}>
        {Array.from({ length: n }, (_, i) => (
          <mesh
            key={i}
            ref={(el) => {
              puffs.current[i] = el;
            }}
            geometry={GEO.blob}
            material={mat('#4a4744')}
          />
        ))}
      </group>
    </>
  );
}

/** Volume spike: two searchlights sweeping the sky from the plot's corners. */
function Spotlights({ magnitude, size }: EffectProps) {
  const edge = size / 2 - 0.6;
  const geo = useMemo(() => new CylinderGeometry(1.1, 0.1, 9, 18, 1, true).translate(0, 4.5, 0), []);
  const material = useMemo(
    () => new MeshBasicMaterial({ color: '#fff3a8', transparent: true, opacity: 0.18 + magnitude * 0.15, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    [magnitude],
  );
  const a = useRef<Group>(null);
  const b = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (a.current) a.current.rotation.set(Math.sin(t * 0.9) * 0.45, 0, -0.3 + Math.sin(t * 0.7) * 0.25);
    if (b.current) b.current.rotation.set(Math.cos(t * 0.8) * 0.45, 0, 0.3 + Math.cos(t * 0.6) * 0.25);
  });
  return (
    <>
      {[
        { ref: a, at: [-edge, 0, edge] as const },
        { ref: b, at: [edge, 0, -edge] as const },
      ].map(({ ref, at }, i) => (
        <group key={i} position={[at[0], 0, at[2]]}>
          <Cyl r={0.3} h={0.4} color="#3a3a3a" />
          <group ref={ref} position={[0, 0.4, 0]}>
            <mesh geometry={geo} material={material} />
          </group>
        </group>
      ))}
    </>
  );
}

/** New 20-day high: a slowly turning golden crown above the plot. */
function GoldRing({ top }: EffectProps) {
  const ring = useRef<Group>(null);
  const geo = useMemo(() => new TorusGeometry(1.3, 0.12, 8, 32), []);
  const gold = useMemo(() => new MeshStandardMaterial({ color: '#ffcf3a', emissive: '#ffb300', emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.4 }), []);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    ring.current.rotation.y = clock.elapsedTime * 0.8;
    ring.current.position.y = top + 1 + Math.sin(clock.elapsedTime * 2) * 0.15;
  });
  return (
    <group ref={ring}>
      <mesh geometry={geo} material={gold} rotation={[Math.PI / 2, 0, 0]} />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return <Box key={i} size={[0.22, 0.22, 0.22]} at={[Math.cos(a) * 1.3, 0.1, Math.sin(a) * 1.3]} rot={[0.7, a, 0.7]} color="#fff2b0" glow={1} shadow={false} />;
      })}
    </group>
  );
}

/** New 20-day low: a small rain cloud hangs over the plot. */
function RainCloud({ top }: EffectProps) {
  const drops = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    drops.current.forEach((m, i) => {
      if (!m) return;
      const p = (clock.elapsedTime * 0.9 + i * 0.37) % 1;
      m.position.y = -p * 2.4;
    });
  });
  return (
    <group position={[0, top + 1.4, 0]}>
      <Ball r={0.8} at={[0, 0, 0]} color="#9aa3ad" />
      <Ball r={0.6} at={[0.8, -0.1, 0.2]} color="#a9b1ba" />
      <Ball r={0.55} at={[-0.8, -0.1, -0.1]} color="#8f98a2" />
      {Array.from({ length: 10 }, (_, i) => (
        <group key={i} position={[((i * 37) % 13) / 6.5 - 1, -0.5, ((i * 53) % 11) / 5.5 - 1]}>
          <mesh
            ref={(el) => {
              drops.current[i] = el;
            }}
            geometry={GEO.box}
            material={mat('#6fa8dc')}
            scale={[0.04, 0.22, 0.04]}
          />
        </group>
      ))}
    </group>
  );
}

/** Trading resumes: a green pulse ripples out from the plot. */
function ResumePulse() {
  const ring = useRef<Mesh>(null);
  const geo = useMemo(() => new RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), []);
  const material = useMemo(() => new MeshBasicMaterial({ color: '#4cd964', transparent: true, depthWrite: false, toneMapped: false }), []);
  const age = useAge();
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const p = (age(clock.elapsedTime) % 1.2) / 1.2;
    ring.current.scale.setScalar(0.5 + p * 6);
    material.opacity = 1 - p;
  });
  return <mesh ref={ring} geometry={geo} material={material} position={[0, 0.3, 0]} />;
}

/** Dividend: coins in the company's accent and gold drift down over the plot. */
function CoinShower({ magnitude, top, accent, seed, size }: EffectProps) {
  const n = Math.round(14 + magnitude * 16);
  const coins = useRef<(Group | null)[]>([]);
  const spots = useMemo(() => {
    const rng = createRng(seed + 5);
    return Array.from({ length: n }, () => [(rng() - 0.5) * (size - 3), (rng() - 0.5) * (size - 3), rng()]);
  }, [n, seed, size]);
  useFrame(({ clock }) => {
    coins.current.forEach((g, i) => {
      if (!g) return;
      const [x, z, phase] = spots[i];
      const p = (clock.elapsedTime * 0.35 + phase) % 1;
      g.position.set(x, top + 2.5 - p * (top + 2.3), z);
      g.rotation.set(clock.elapsedTime * 3 + i, 0, 0.4);
      g.visible = p < 0.97;
    });
  });
  return (
    <>
      {spots.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            coins.current[i] = el;
          }}
        >
          <Cyl r={0.2} h={0.06} rot={[Math.PI / 2, 0, 0]} color={i % 3 === 0 ? accent : '#ffcf3a'} glow={0.5} center shadow={false} />
        </group>
      ))}
    </>
  );
}
