import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { signSpot } from '../../config/layout';
import type { SectorDefinition } from '../../config/sectors';
import { Ball, Box, Cyl } from '../kit';

const BOARD_W = 3.6;
const BOARD_H = 1.2;
const BOARD_Y = 0.55;
const PX_PER_UNIT = 280;

/**
 * Small wooden signboard on two posts in the district park, at street scale
 * like any other prop: read it by zooming in. It is turned to face the fixed
 * isometric camera, so the name reads straight on.
 */
export function SectorSign({ sector }: { sector: SectorDefinition }) {
  const [x, z] = signSpot(sector.id);
  const texture = useSignTexture(sector.name);
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI / 4, 0]}>
      {/* posts and stone footings */}
      {[-BOARD_W / 2 + 0.35, BOARD_W / 2 - 0.35].map((px) => (
        <group key={px}>
          <Ball r={0.16} at={[px, 0.05, 0]} color="#a9a397" />
          <Cyl r={0.07} h={BOARD_Y + BOARD_H + 0.12} at={[px, 0, -0.04]} color="#8a5a34" low />
        </group>
      ))}
      {/* frame and board */}
      <Box size={[BOARD_W + 0.16, BOARD_H + 0.16, 0.1]} at={[0, BOARD_Y - 0.08, 0]} color="#7a4b2a" rounded={0.04} />
      <Box size={[BOARD_W, BOARD_H, 0.14]} at={[0, BOARD_Y, 0]} color={sector.color} rounded={0.05} />
      <mesh position={[0, BOARD_Y + BOARD_H / 2, 0.075]}>
        <planeGeometry args={[BOARD_W - 0.15, BOARD_H - 0.15]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Draws the name in the UI font, on one line or two, sized to fill the board. */
function useSignTexture(text: string): CanvasTexture {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = (BOARD_W - 0.15) * PX_PER_UNIT;
    c.height = (BOARD_H - 0.15) * PX_PER_UNIT;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [canvas]);

  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      drawSign(canvas, text);
      texture.needsUpdate = true;
    };
    draw();
    // Redraw once the web font has loaded, in case the first pass used a fallback.
    document.fonts.load('700 100px Fredoka').then(draw, () => {});
    return () => {
      cancelled = true;
    };
  }, [canvas, texture, text]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function drawSign(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  const maxW = w * 0.92;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const font = (size: number) => `700 ${size}px Fredoka, system-ui, sans-serif`;

  // One line, shrunk to fit; wrap to two lines only if that gets too small.
  let size = h * 0.8;
  ctx.font = font(size);
  let lines = [text];
  const oneLine = Math.min(size, (size * maxW) / ctx.measureText(text).width);
  if (oneLine >= h * 0.4) {
    size = oneLine;
  } else {
    lines = splitInTwo(text);
    size = h * 0.45;
  }
  ctx.font = font(size);
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  if (widest > maxW) {
    size *= maxW / widest;
    ctx.font = font(size);
  }

  const lineH = size * 1.05;
  const top = h / 2 - ((lines.length - 1) * lineH) / 2;
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    const y = top + i * lineH + size * 0.04;
    ctx.strokeText(line, w / 2, y);
    ctx.fillText(line, w / 2, y);
  });
}

/** Split at the space closest to the middle. */
function splitInTwo(text: string): string[] {
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}
