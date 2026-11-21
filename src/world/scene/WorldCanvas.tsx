import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MapControls, OrthographicCamera } from '@react-three/drei';
import type { MapControls as MapControlsImpl } from 'three-stdlib';
import { MOUSE, TOUCH } from 'three';
import { COMPANIES, COMPANY_BY_TICKER } from '../../config/companies';
import { lotCenter, WORLD_HALF } from '../../config/layout';
import { useWorldStore } from '../../store/useWorldStore';
import { Exchange } from '../buildings/Exchange';
import { CompanyPlot } from '../CompanyPlot';
import { Ground } from './Ground';
import { Scenery } from './Scenery';
import { Weather } from './Weather';
import { LabelProjector } from '../labels';

/** Camera sits on the (1, 1, 1) diagonal: a true isometric view. */
const CAM_DIST = 100;
const PAN_LIMIT = WORLD_HALF - 6;

/** Zoom at which the whole island fits. At this angle its screen footprint is about 2.9 × 1.85 world-half-widths. */
export const fitZoom = (width: number, height: number) => Math.min(width / (WORLD_HALF * 2.9), height / (WORLD_HALF * 1.85));

export function WorldCanvas() {
  const select = useWorldStore((s) => s.select);
  const selectSector = useWorldStore((s) => s.selectSector);
  return (
    <Canvas shadows="percentage" dpr={[1, 2]} gl={{ antialias: true, alpha: true }} onPointerMissed={() => {
        select(null);
        selectSector(null);
      }}>
      <OrthographicCamera makeDefault position={[CAM_DIST, CAM_DIST, CAM_DIST]} near={1} far={500} />
      <FitOnResize />
      {import.meta.env.DEV && <DebugHandle />}
      <IsoControls />
      <CameraFly />
      <Weather />
      <Ground />
      <Exchange />
      {COMPANIES.map((c, i) => (
        <CompanyPlot key={c.ticker} company={c} index={i} />
      ))}
      <Scenery />
      <LabelProjector />
    </Canvas>
  );
}

/** Zoom so the whole island fits the viewport. */
function FitOnResize() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.zoom = fitZoom(size.width, size.height);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/** Pan and zoom only. Rotation is locked so the isometric angle never changes. The pan limit grows with zoom. */
function IsoControls() {
  const controls = useRef<MapControlsImpl>(null);
  const { size } = useThree();
  const fit = fitZoom(size.width, size.height);
  return (
    <MapControls
      ref={controls}
      makeDefault
      enableRotate={false}
      enableDamping
      dampingFactor={0.12}
      screenSpacePanning={false}
      minZoom={fit * 0.8}
      maxZoom={fit * 6}
      zoomToCursor
      zoomSpeed={1.6}
      mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      onChange={() => {
        const c = controls.current;
        if (!c) return;
        const t = c.target;
        // The pan limit grows with zoom: fully zoomed out the city stays near the middle, closer in you can pan to any edge.
        const zoomed = ((c.object as { zoom: number }).zoom / fit - 0.8) / 0.7;
        const limit = PAN_LIMIT * (0.25 + 0.75 * Math.max(0, Math.min(1, zoomed)));
        const cx = Math.max(-limit, Math.min(limit, t.x));
        const cz = Math.max(-limit, Math.min(limit, t.z));
        t.set(cx, 0, cz);
        // Keep the camera at its fixed isometric offset. Zoom-to-cursor also nudges an orthographic
        // camera's position, and over many zooms that drift carried the city past the far plane.
        c.object.position.set(cx + CAM_DIST, CAM_DIST, cz + CAM_DIST);
      }}
    />
  );
}

/** Dev only: exposes the camera and controls as window.__psx for inspection. */
function DebugHandle() {
  const state = useThree();
  useEffect(() => {
    (window as unknown as { __psx: unknown }).__psx = state;
  }, [state]);
  return null;
}

/** How close the camera gets when it flies to a company, as a multiple of the whole-island zoom. */
const FLY_ZOOM = 3.4;

/**
 * Flies the camera to a company when asked (the lab does): the view glides to
 * the lot and zooms in, and hands control back the moment you pan or zoom.
 */
function CameraFly() {
  const request = useWorldStore((s) => s.focus);
  const { camera, controls, size } = useThree();
  const goal = useRef<{ x: number; z: number; zoom: number } | null>(null);
  useEffect(() => {
    if (!request) return;
    const c = COMPANY_BY_TICKER[request.ticker];
    if (!c) return;
    const [x, z] = lotCenter(c.sectorId, c.plot);
    goal.current = { x, z, zoom: fitZoom(size.width, size.height) * FLY_ZOOM };
  }, [request, size.width, size.height]);
  useEffect(() => {
    // the user taking the controls cancels the flight
    const el = (controls as unknown as { domElement?: HTMLElement } | null)?.domElement;
    if (!el) return;
    const stop = () => {
      goal.current = null;
    };
    el.addEventListener('pointerdown', stop);
    el.addEventListener('wheel', stop);
    return () => {
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('wheel', stop);
    };
  }, [controls]);
  useFrame((_, frameDt) => {
    const g = goal.current;
    const c = controls as unknown as MapControlsImpl | null;
    if (!g || !c) return;
    const k = 1 - Math.exp(-Math.min(frameDt, 0.1) * 4);
    const t = c.target;
    const ortho = camera as unknown as { zoom: number; updateProjectionMatrix: () => void };
    const x = t.x + (g.x - t.x) * k;
    const z = t.z + (g.z - t.z) * k;
    t.set(x, 0, z);
    camera.position.set(x + CAM_DIST, CAM_DIST, z + CAM_DIST);
    ortho.zoom += (g.zoom - ortho.zoom) * k;
    ortho.updateProjectionMatrix();
    c.update();
    if (Math.hypot(g.x - x, g.z - z) < 0.05 && Math.abs(g.zoom - ortho.zoom) < 0.01 * g.zoom) goal.current = null;
  });
  return null;
}
