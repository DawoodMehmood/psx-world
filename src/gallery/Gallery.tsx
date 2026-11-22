import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box3, Color, InstancedMesh, Mesh, Sphere, Vector3, type DirectionalLight, type Object3D } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { COMPANIES, COMPANY_BY_TICKER } from '../config/companies';
import { ACTIVITY, DIRECTION, HEALTH, SLOT_STAGES, VOLATILITY } from '../engine/types';
import { ACTIVITY_INTENSITY, JITTER, POOL, pace } from '../engine/visual';
import { createMotion, MotionContext } from '../world/motion';
import { StaticScope } from '../world/Static';
import { EditingContext } from '../world/editing';
import { Inspector } from './editor/Inspector';
import { gizmo, Selection, srcOf } from './editor/Selection';
import { persist, redo, saved, select, undo, useEditor, watchHot } from './editor/store';
import { ASSETS, GROUPS, paramDefaults, type AssetDef, type Param, type StateCtx, type Values } from './assets';
import { locate, type SourceRef } from './source';
import './gallery.css';

/*
 * The asset gallery (dev only, open with ?assets): every asset alone on a
 * turntable, with the state controls that apply to it and the file and line
 * it lives in. Nothing here touches the simulation or the city.
 */

const nice = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ');

interface Stats {
  meshes: number;
  triangles: number;
}

interface View {
  turntable: boolean;
  grid: boolean;
  paused: boolean;
  /** Bumped by the Refit button. */
  fit: number;
}

function startCtx(): StateCtx {
  return {
    health: 'STEADY',
    activity: 'NORMAL',
    volatility: 'CALM',
    direction: 'FLAT',
    halted: false,
    tier: 1,
    slotStage: 'COMPLETE',
    upgradeStage: 'EMPTY',
    paused: false,
    company: '',
    scale: 0.5,
    accent: '#2c5fb8',
  };
}

/** The company a site asset starts on: the first of its archetype. */
function withCompany(ctx: StateCtx, ticker: string): StateCtx {
  const c = COMPANY_BY_TICKER[ticker];
  return { ...ctx, company: ticker, scale: c.scale, accent: `#${new Color(c.accent).getHexString()}` };
}

function initialAsset(): AssetDef {
  const id = new URLSearchParams(location.search).get('assets') || (saved.asset as string | undefined);
  return ASSETS.find((a) => a.id === id) ?? ASSETS[0];
}

export function Gallery() {
  const [asset, setAsset] = useState(initialAsset);
  const [values, setValues] = useState<Values>(() => (saved.asset === asset.id && saved.values ? (saved.values as Values) : paramDefaults(asset)));
  const [ctx, setCtx] = useState<StateCtx>(() => {
    if (saved.asset === asset.id && saved.ctx) return saved.ctx as StateCtx;
    return asset.site ? withCompany(startCtx(), COMPANIES.find((c) => c.archetype === asset.site)!.ticker) : startCtx();
  });
  const [view, setView] = useState<View>(() => ({ turntable: !useEditor.getState().enabled, grid: false, paused: false, fit: 0, ...((saved.view as Partial<View>) ?? {}) }));
  const editing = useEditor((s) => s.enabled);
  const [stats, setStats] = useState<Stats>({ meshes: 0, triangles: 0 });
  const [source, setSource] = useState<SourceRef | null>(null);

  const pick = useCallback((a: AssetDef) => {
    void select(null);
    setAsset(a);
    setValues(paramDefaults(a));
    if (a.site) setCtx((c) => (COMPANY_BY_TICKER[c.company]?.archetype === a.site ? c : withCompany(c, COMPANIES.find((x) => x.archetype === a.site)!.ticker)));
    history.replaceState(null, '', `?assets=${a.id}`);
  }, []);

  // survive a full reload, and follow hot updates while editing
  useEffect(() => persist({ asset: asset.id, values, ctx, view: { grid: view.grid, paused: view.paused, turntable: view.turntable } }), [asset.id, values, ctx, view]);
  useEffect(() => watchHot(), []);
  useEffect(() => {
    if (useEditor.getState().selected) void select(useEditor.getState().selected);
  }, []);
  // editing holds the view still, and Cmd/Ctrl+Z undoes the last save
  useEffect(() => {
    if (editing) setView((v) => ({ ...v, turntable: false }));
  }, [editing]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!useEditor.getState().enabled || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Escape') void select(null);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void (e.shiftKey ? redo() : undo());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let live = true;
    setSource(null);
    locate(asset.file, asset.symbol).then((s) => live && setSource(s));
    return () => {
      live = false;
    };
  }, [asset]);

  const patch = (p: Partial<StateCtx>) => setCtx((c) => ({ ...c, ...p }));
  const where = source ? `${source.path}${source.line ? `:${source.line}` : ''}` : '…';

  return (
    <div className="g-root">
      <nav className="g-list">
        <div className="g-title">Asset gallery</div>
        <a className="g-back" href={import.meta.env.BASE_URL}>
          ← Back to the city
        </a>
        {GROUPS.map((g) => (
          <section key={g}>
            <h3>{g}</h3>
            {ASSETS.filter((a) => a.group === g).map((a) => (
              <button key={a.id} className={a.id === asset.id ? 'on' : ''} onClick={() => pick(a)}>
                {a.name}
              </button>
            ))}
          </section>
        ))}
      </nav>

      <main className="g-stage">
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          orthographic
          camera={{ position: [60, 60, 60], zoom: 20, near: 0.1, far: 2000 }}
          gl={{ alpha: true, antialias: true }}
          onPointerMissed={() => {
            if (!gizmo.busy) void select(null);
          }}
        >
          <Stage asset={asset} values={values} ctx={ctx} view={view} onStats={setStats} />
        </Canvas>
      </main>

      <aside className="g-panel">
        <h2>{asset.name}</h2>
        <div className="g-source">
          <code>{where}</code>
          <button onClick={() => navigator.clipboard?.writeText(where)}>Copy</button>
        </div>
        <div className="g-stats">
          {stats.meshes} meshes · {stats.triangles.toLocaleString()} triangles
        </div>

        <Inspector />

        <h3>View</h3>
        <div className="g-row">
          <Toggle label="Turntable" on={view.turntable} set={(turntable) => setView((v) => ({ ...v, turntable }))} />
          <Toggle label="Grid" on={view.grid} set={(grid) => setView((v) => ({ ...v, grid }))} />
          <Toggle label="Freeze motion" on={view.paused} set={(paused) => setView((v) => ({ ...v, paused }))} />
          <button className="g-btn" onClick={() => setView((v) => ({ ...v, fit: v.fit + 1 }))}>
            Refit
          </button>
        </div>

        {asset.params && (
          <>
            <h3>Look</h3>
            {asset.params.map((p) => (
              <ParamRow key={p.key} p={p} value={values[p.key]} set={(v) => setValues((o) => ({ ...o, [p.key]: v }))} />
            ))}
          </>
        )}

        {asset.site && (
          <>
            <h3>Company</h3>
            <label className="g-field">
              <span>Company</span>
              <select value={ctx.company} onChange={(e) => setCtx((c) => withCompany(c, e.target.value))}>
                {COMPANIES.filter((c) => c.archetype === asset.site).map((c) => (
                  <option key={c.ticker} value={c.ticker}>
                    {c.ticker} · {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="g-field">
              <span>Scale {ctx.scale.toFixed(2)}</span>
              <input type="range" min={0} max={1} step={0.01} value={ctx.scale} onChange={(e) => patch({ scale: +e.target.value })} />
            </label>
            <label className="g-field">
              <span>Accent</span>
              <input type="color" value={ctx.accent} onChange={(e) => patch({ accent: e.target.value })} />
            </label>
            <Segments label="Site tier" options={[1, 2, 3]} value={ctx.tier} set={(tier) => patch({ tier })} />
            <Segments label="Expansion slots" options={SLOT_STAGES} value={ctx.slotStage} set={(slotStage) => patch({ slotStage })} format={nice} />
            <Segments label="Upgrades" options={SLOT_STAGES} value={ctx.upgradeStage} set={(upgradeStage) => patch({ upgradeStage })} format={nice} />
            <Toggle label="Work wound down (tarped)" on={ctx.paused} set={(paused) => patch({ paused })} />
            <Segments label="Health" options={HEALTH} value={ctx.health} set={(health) => patch({ health })} format={nice} />
          </>
        )}

        {asset.animated && (
          <>
            <h3>Motion</h3>
            <Segments label="Activity" options={ACTIVITY} value={ctx.activity} set={(activity) => patch({ activity })} format={nice} />
            <Segments label="Volatility" options={VOLATILITY} value={ctx.volatility} set={(volatility) => patch({ volatility })} format={nice} />
            {asset.site && <Segments label="Today" options={DIRECTION} value={ctx.direction} set={(direction) => patch({ direction })} format={nice} />}
            <Toggle label="Halted" on={ctx.halted} set={(halted) => patch({ halted })} />
          </>
        )}
        {asset.id === 'exchange' && <p className="g-note">The Exchange follows the whole market, not one company, so it shows the simulation's current mood.</p>}
      </aside>
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="g-toggle">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );
}

function Segments<T extends string | number>({ label, options, value, set, format = String }: { label: string; options: readonly T[]; value: T; set: (v: T) => void; format?: (v: T) => string }) {
  return (
    <div className="g-seg">
      <span>{label}</span>
      <div>
        {options.map((o) => (
          <button key={String(o)} className={o === value ? 'on' : ''} onClick={() => set(o)}>
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ParamRow({ p, value, set }: { p: Param; value: string | number | boolean; set: (v: string | number | boolean) => void }) {
  if (p.type === 'bool') return <Toggle label={p.label} on={!!value} set={set} />;
  return (
    <label className="g-field">
      <span>
        {p.label}
        {p.type === 'range' ? ` ${value}` : ''}
      </span>
      {p.type === 'color' && <input type="color" value={value as string} onChange={(e) => set(e.target.value)} />}
      {p.type === 'range' && <input type="range" min={p.min} max={p.max} step={p.step} value={value as number} onChange={(e) => set(+e.target.value)} />}
      {p.type === 'select' && (
        <select value={value as string} onChange={(e) => set(e.target.value)}>
          {p.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )}
    </label>
  );
}

// ── the 3D side ──────────────────────────────────────────────────────────────

/** Counts what is actually drawn: visible meshes, and triangles with instances counted. */
function measure(root: Object3D): Stats {
  let meshes = 0;
  let triangles = 0;
  const walk = (o: Object3D) => {
    if (!o.visible) return;
    if ((o as Mesh).isMesh) {
      const m = o as Mesh;
      const g = m.geometry;
      const per = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      meshes += 1;
      triangles += per * ((o as InstancedMesh).isInstancedMesh ? (o as InstancedMesh).count : 1);
    }
    o.children.forEach(walk);
  };
  walk(root);
  return { meshes, triangles: Math.round(triangles) };
}

function Stage({ asset, values, ctx, view, onStats }: { asset: AssetDef; values: Values; ctx: StateCtx; view: View; onStats: (s: Stats) => void }) {
  const content = useRef<Object3D>(null);
  const sun = useRef<DirectionalLight>(null);
  const { camera, size } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const [bounds, setBounds] = useState({ x: 0, z: 0, r: 8 });

  // Motion eases toward the chosen state the way a plot does, so an Activity switch looks like it does in the city.
  const motion = useMemo(createMotion, []);
  const target = useRef({ ctx, view });
  target.current = { ctx, view };
  const clock = useRef(0);
  useFrame((_, frameDt) => {
    const { ctx: c, view: v } = target.current;
    const dt = Math.min(frameDt, 0.1);
    const k = 1 - Math.exp(-dt * 2.5);
    motion.intensity += (ACTIVITY_INTENSITY[c.activity] - motion.intensity) * k;
    motion.jitter += (JITTER[c.volatility] - motion.jitter) * k;
    motion.pool += ((c.halted ? 0 : POOL[c.direction]) - motion.pool) * (1 - Math.exp(-dt * 1.6));
    motion.halted = c.halted;
    const speed = c.halted || v.paused ? 0 : (0.3 + motion.intensity * 1.2) * pace(motion.jitter);
    motion.speed += (speed - motion.speed) * (1 - Math.exp(-dt * 6));
    motion.t += dt * motion.speed;
    clock.current += dt;
    if (clock.current > 0.5 && content.current) {
      clock.current = 0;
      onStats(measure(content.current));
    }
  });

  // Frame the asset: a pause first, because merged groups rebuild a moment after mount.
  const fitKey = `${asset.id}|${asset.site ? ctx.tier : ''}|${view.fit}`;
  useEffect(() => {
    const id = setTimeout(() => {
      if (!content.current || !controls) return;
      const box = new Box3().setFromObject(content.current);
      if (box.isEmpty()) return;
      const center = box.getCenter(new Vector3());
      const r = Math.max(box.getBoundingSphere(new Sphere()).radius, 0.5);
      const dir = camera.position.clone().sub(controls.target);
      if (dir.lengthSq() < 1e-6) dir.set(1, 1, 1);
      dir.normalize();
      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(dir, 300);
      (camera as unknown as { zoom: number }).zoom = Math.min(size.width, size.height) / (r * 2 * 1.12);
      camera.updateProjectionMatrix();
      controls.update();
      setBounds({ x: center.x, z: center.z, r });
      const light = sun.current;
      if (light) {
        light.position.set(center.x + 0.5 * (r * 3 + 30), r * 3 + 30, center.z + 0.3 * (r * 3 + 30));
        light.target.position.copy(center);
        light.target.updateMatrixWorld();
        const cam = light.shadow.camera;
        cam.left = cam.bottom = -r * 1.6;
        cam.right = cam.top = r * 1.6;
        cam.far = r * 8 + 120;
        cam.updateProjectionMatrix();
      }
    }, 450);
    return () => clearTimeout(id);
    // size is read once per fit on purpose: resizing the window should not move the view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, controls]);

  const editing = useEditor((s) => s.enabled);
  const gridSize = Math.max(4, Math.ceil(bounds.r * 2.6 / 2) * 2);
  const body = asset.render(values, ctx);
  return (
    <>
      <hemisphereLight args={['#fff6e0', '#7fa86a', 1.1]} />
      <directionalLight ref={sun} position={[40, 70, 25]} intensity={2.1} color="#fff1d6" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} autoRotate={view.turntable} autoRotateSpeed={2.2} />
      <mesh position={[bounds.x, -0.02, bounds.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[bounds.r * 1.15, 48]} />
        <meshStandardMaterial color="#bfe3a8" roughness={1} />
      </mesh>
      {view.grid && <gridHelper args={[gridSize, gridSize, '#2b2a33', '#2b2a33']} position={[Math.round(bounds.x), 0.01, Math.round(bounds.z)]} material-opacity={0.25} material-transparent />}
      {/* while editing, parts are drawn unmerged (and the group remounts to switch) so each can be clicked */}
      <EditingContext.Provider value={editing}>
        <MotionContext.Provider value={motion}>
          <group
            key={String(editing)}
            ref={content}
            onClick={
              editing
                ? (e) => {
                    e.stopPropagation();
                    if (!gizmo.busy) void select(srcOf(e.object));
                  }
                : undefined
            }
          >
            {asset.scope ? <StaticScope>{body}</StaticScope> : body}
          </group>
        </MotionContext.Provider>
      </EditingContext.Provider>
      {editing && <Selection root={content} />}
    </>
  );
}
