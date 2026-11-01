import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { siteTier, type CompanyDefinition } from '../config/companies';
import { SECTOR_BY_ID } from '../config/sectors';
import { LOT_SIZE, lotBackCorner } from '../config/layout';
import { effectiveCompany, useCompanyVisual, useSimStore } from '../store/useSimStore';
import { useWorldStore } from '../store/useWorldStore';
import { ARCHETYPES, archetypeHeight } from './buildings';
import { EventEffects } from './effects/EventEffects';
import { HaltTape } from './effects/HaltTape';
import { LightPool } from './effects/LightPool';
import { Box } from './kit';
import { pace } from '../engine/visual';
import { createMotion, MotionContext } from './motion';
import { ReservedLand, SiteExpansion } from './site';

/**
 * One company's lot: its current site (as deep as its tier) with buildings,
 * light pool, effects and selection ring, plus the reserved land in front of it that
 * it can grow into. Everything is drawn in site coordinates: origin at the
 * lot's back corner, the site in +x and +z (toward the camera).
 */
export function CompanyPlot({ company, index }: { company: CompanyDefinition; index: number }) {
  const sector = SECTOR_BY_ID[company.sectorId];
  const [bx, bz] = lotBackCorner(company.sectorId, company.plot);
  const Buildings = ARCHETYPES[company.archetype];
  const selected = useWorldStore((s) => s.selectedTicker === company.ticker);
  const hovered = useWorldStore((s) => s.hoveredTicker === company.ticker);
  const select = useWorldStore((s) => s.select);
  const hover = useWorldStore((s) => s.hover);

  const visual = useCompanyVisual(company.ticker);
  // Lists are rebuilt only when their keys change, so the plot doesn't re-render every tick.
  const events = useMemo(() => effectiveCompany(useSimStore.getState(), company.ticker).events, [company.ticker, visual.eventsKey]);
  const slots = useMemo(() => effectiveCompany(useSimStore.getState(), company.ticker).slots, [company.ticker, visual.slotsKey]);
  const upgrades = useMemo(() => effectiveCompany(useSimStore.getState(), company.ticker).upgrades, [company.ticker, visual.upgradesKey]);
  const depth = siteTier(company, visual.tier).depth;
  const nextDepth = siteTier(company, visual.tier + 1).depth;
  const grading = visual.expansionStage === 'FOUNDATION' || visual.expansionStage === 'FRAME';

  const seed = index * 17 + 3;
  const motion = useMemo(createMotion, []);
  if (import.meta.env.DEV) ((window as unknown as { __motion: Record<string, unknown> }).__motion ??= {})[company.ticker] = motion;
  const target = useRef(visual);
  target.current = visual;

  useFrame((_, frameDt) => {
    const dt = Math.min(frameDt, 0.1);
    const v = target.current;
    const k = 1 - Math.exp(-dt * 2.5);
    motion.intensity += (v.intensity - motion.intensity) * k;
    motion.jitter += (v.jitter - motion.jitter) * k;
    // A halt freezes Direction too: nothing traded, so no sunlit or shaded patch.
    motion.pool += ((v.halted ? 0 : v.pool) - motion.pool) * (1 - Math.exp(-dt * 1.6));
    motion.halted = v.halted;
    // Frantic plots run: people and vehicles move faster, the more irregular the price.
    const speed = v.halted ? 0 : (0.3 + motion.intensity * 1.2) * pace(motion.jitter);
    motion.speed += (speed - motion.speed) * (1 - Math.exp(-dt * 6));
    motion.t += dt * motion.speed;
  });

  const buildings = useMemo(
    () => <Buildings scale={company.scale} accent={company.accent} seed={seed} health={visual.health} tier={visual.tier} slots={slots} upgrades={upgrades} />,
    [Buildings, company.scale, company.accent, seed, visual.health, visual.tier, slots, upgrades],
  );
  const top = archetypeHeight(company.archetype, company.scale);

  return (
    <MotionContext.Provider value={motion}>
      <group position={[bx, 0, bz]}>
        <ReservedLand depth={depth} clearTo={grading ? nextDepth : depth} seed={seed} />
        {visual.expansionStage && <SiteExpansion from={depth} to={nextDepth} stage={visual.expansionStage} paused={visual.expansionPaused} />}
        <group
          onClick={(e) => {
            e.stopPropagation();
            select(company.ticker);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            hover(company.ticker);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            hover(null);
            document.body.style.cursor = '';
          }}
        >
          <LightPool at={[LOT_SIZE / 2, 0.215, depth / 2]} w={LOT_SIZE} d={depth} />
          {/* site pad with a curb */}
          <Box size={[LOT_SIZE, 0.14, depth]} at={[LOT_SIZE / 2, 0, depth / 2]} color="#d6cdb8" rounded={0.06} shadow={false} />
          <Box size={[LOT_SIZE - 0.4, 0.06, depth - 0.4]} at={[LOT_SIZE / 2, 0.12, depth / 2]} color={sector.pad} shadow={false} />
          <group position={[0, 0.18, 0]}>
            {buildings}
            <group position={[LOT_SIZE / 2, 0, depth / 2]}>
              <EventEffects events={events} top={top} accent={company.accent} size={Math.min(depth, LOT_SIZE)} archetype={company.archetype} />
              {visual.halted && <HaltTape w={LOT_SIZE} d={depth} />}
            </group>
          </group>
        </group>
        {(selected || hovered) && <SelectionRing w={LOT_SIZE} d={depth} strong={selected} />}
      </group>
    </MotionContext.Provider>
  );
}

function SelectionRing({ w, d, strong }: { w: number; d: number; strong: boolean }) {
  const ring = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.position.y = 0.2 + (strong ? Math.sin(clock.elapsedTime * 4) * 0.05 : 0);
  });
  const hx = w / 2 + 0.15;
  const hz = d / 2 + 0.15;
  const color = strong ? '#ffd23f' : '#ffffff';
  const t = 0.25;
  return (
    <group ref={ring} position={[w / 2, 0.2, d / 2]}>
      <Box size={[w + 0.6, 0.12, t]} at={[0, 0, hz]} color={color} glow={0.5} shadow={false} />
      <Box size={[w + 0.6, 0.12, t]} at={[0, 0, -hz]} color={color} glow={0.5} shadow={false} />
      <Box size={[t, 0.12, d + 0.6]} at={[hx, 0, 0]} color={color} glow={0.5} shadow={false} />
      <Box size={[t, 0.12, d + 0.6]} at={[-hx, 0, 0]} color={color} glow={0.5} shadow={false} />
    </group>
  );
}
