import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { MapControls, OrthographicCamera } from '@react-three/drei';
import type { MapControls as MapControlsImpl } from 'three-stdlib';
import { MOUSE, TOUCH } from 'three';
import { COMPANIES } from '../../config/companies';
import { WORLD_HALF } from '../../config/layout';
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
