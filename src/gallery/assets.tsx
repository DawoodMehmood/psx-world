import { useMemo, type ReactNode } from 'react';
import { ARCHETYPES } from '../world/buildings';
import { Exchange } from '../world/buildings/Exchange';
import { ToLet } from '../world/buildings/shared';
import { Scaffold, TowerCrane } from '../world/construction/ConstructionSlot';
import { LightPool } from '../world/effects/LightPool';
import { CashVan, MixerTruck, OfficeWorker, Tanker, Van, Worker } from '../world/agents';
import { Box, Car, Tree, Trees, type TreeSpec } from '../world/kit';
import { Static } from '../world/Static';
import { COMPANIES, SITE_TIERS, type Archetype } from '../config/companies';
import { SECTOR_BY_ID } from '../config/sectors';
import { LOT_SIZE } from '../config/layout';
import type { Activity, Direction, Health, SlotStage, SlotState, Volatility } from '../engine/types';

/**
 * The registry behind the asset gallery (`?assets`, dev only). Each entry names
 * the component, where its source lives (so the panel can show file and line)
 * and the knobs worth turning. Add a new asset here and it shows up in the list.
 */

/** The state every asset can be shown in. Only the parts an asset reads matter (a worker ignores Health). */
export interface StateCtx {
  health: Health;
  activity: Activity;
  volatility: Volatility;
  direction: Direction;
  halted: boolean;
  tier: number;
  slotStage: SlotStage;
  upgradeStage: SlotStage;
  paused: boolean;
  /** Site assets only: whose scale and accent the building takes. */
  company: string;
  scale: number;
  accent: string;
}

export type Values = Record<string, string | number | boolean>;

export type Param =
  | { key: string; label: string; type: 'color'; def: string }
  | { key: string; label: string; type: 'range'; min: number; max: number; step: number; def: number }
  | { key: string; label: string; type: 'select'; options: string[]; def: string }
  | { key: string; label: string; type: 'bool'; def: boolean };

export type Group = 'Buildings' | 'People and vehicles' | 'Construction' | 'Props';

export interface AssetDef {
  id: string;
  name: string;
  group: Group;
  /** Vite glob key of the file the component lives in. */
  file: string;
  /** Exported name to look for in that file. */
  symbol: string;
  /** A company site: shows the company, tier and construction controls. */
  site?: Archetype;
  /** Reads the plot's motion clock (Activity, Volatility, Halt, Direction), so those controls apply. */
  animated?: boolean;
  /** Wrap in a StaticScope, as a company plot does. Not for assets that make their own (the Exchange). */
  scope?: boolean;
  params?: Param[];
  render: (v: Values, ctx: StateCtx) => ReactNode;
}

const num = (v: Values, k: string) => v[k] as number;
const str = (v: Values, k: string) => v[k] as string;

const SITE_NAMES: Record<Archetype, { name: string; file: string; symbol: string }> = {
  bank: { name: 'Bank complex', file: '/src/world/buildings/BankComplex.tsx', symbol: 'BankComplex' },
  oil: { name: 'Oil field', file: '/src/world/buildings/OilField.tsx', symbol: 'OilField' },
  cement: { name: 'Cement plant', file: '/src/world/buildings/CementPlant.tsx', symbol: 'CementPlant' },
  tech: { name: 'Tech campus', file: '/src/world/buildings/TechCampus.tsx', symbol: 'TechCampus' },
};

/** A company's site on its pad, as CompanyPlot draws it, centered on the origin. */
function SitePreview({ archetype, ctx }: { archetype: Archetype; ctx: StateCtx }) {
  const Buildings = ARCHETYPES[archetype];
  const depth = SITE_TIERS[archetype][ctx.tier - 1].depth;
  const pad = SECTOR_BY_ID[COMPANIES.find((c) => c.archetype === archetype)!.sectorId].pad;
  const slots = useMemo<SlotState[]>(() => Array.from({ length: 6 }, () => ({ stage: ctx.slotStage, paused: ctx.paused })), [ctx.slotStage, ctx.paused]);
  const upgrades = useMemo<SlotState[]>(() => Array.from({ length: 3 }, () => ({ stage: ctx.upgradeStage, paused: ctx.paused })), [ctx.upgradeStage, ctx.paused]);
  const buildings = useMemo(
    () => <Buildings scale={ctx.scale} accent={ctx.accent} seed={3} health={ctx.health} tier={ctx.tier} slots={slots} upgrades={upgrades} />,
    [Buildings, ctx.scale, ctx.accent, ctx.health, ctx.tier, slots, upgrades],
  );
  return (
    <group position={[-LOT_SIZE / 2, 0, -depth / 2]}>
      <LightPool at={[LOT_SIZE / 2, 0.215, depth / 2]} w={LOT_SIZE} d={depth} />
      <Static>
        <Box size={[LOT_SIZE, 0.14, depth]} at={[LOT_SIZE / 2, 0, depth / 2]} color="#d6cdb8" rounded={0.06} shadow={false} />
        <Box size={[LOT_SIZE - 0.4, 0.06, depth - 0.4]} at={[LOT_SIZE / 2, 0.12, depth / 2]} color={pad} shadow={false} />
      </Static>
      <group position={[0, 0.18, 0]}>{buildings}</group>
    </group>
  );
}

const siteAsset = (archetype: Archetype): AssetDef => ({
  id: archetype,
  ...SITE_NAMES[archetype],
  group: 'Buildings',
  site: archetype,
  animated: true,
  scope: true,
  render: (_v, ctx) => <SitePreview archetype={archetype} ctx={ctx} />,
});

/** A small stand of trees on a grid, in the greens the scenery uses, drawn the way the city draws its forest (instanced). */
const FOREST: TreeSpec[] = Array.from({ length: 25 }, (_, i) => ({
  at: [(i % 5) * 2.2 - 4.4, 0, Math.floor(i / 5) * 2.2 - 4.4],
  size: 0.75 + ((i * 7) % 5) * 0.1,
  color: ['#4fa83d', '#5cb84a', '#3f9a3a', '#6cc04f'][i % 4],
}));

export const ASSETS: AssetDef[] = [
  siteAsset('bank'),
  siteAsset('oil'),
  siteAsset('cement'),
  siteAsset('tech'),
  {
    id: 'exchange',
    name: 'PSX Exchange',
    group: 'Buildings',
    file: '/src/world/buildings/Exchange.tsx',
    symbol: 'Exchange',
    // it follows the market, not a company, so the company state controls do not reach it
    render: () => <Exchange />,
  },

  {
    id: 'worker',
    name: 'Worker',
    group: 'People and vehicles',
    file: '/src/world/agents.tsx',
    symbol: 'Worker',
    params: [{ key: 'helmet', label: 'Helmet', type: 'color', def: '#ffcf3a' }],
    render: (v) => <Worker helmet={str(v, 'helmet')} />,
  },
  {
    id: 'office-worker',
    name: 'Office worker',
    group: 'People and vehicles',
    file: '/src/world/agents.tsx',
    symbol: 'OfficeWorker',
    params: [
      { key: 'shirt', label: 'Shirt', type: 'color', def: '#4f7fd1' },
      { key: 'hair', label: 'Hair', type: 'color', def: '#3a2a20' },
    ],
    render: (v) => <OfficeWorker shirt={str(v, 'shirt')} hair={str(v, 'hair')} />,
  },
  {
    id: 'car',
    name: 'Car',
    group: 'People and vehicles',
    file: '/src/world/kit.tsx',
    symbol: 'Car',
    params: [{ key: 'color', label: 'Paint', type: 'color', def: '#d94b3d' }],
    render: (v) => <Car color={str(v, 'color')} />,
  },
  {
    id: 'van',
    name: 'Courier van',
    group: 'People and vehicles',
    file: '/src/world/agents.tsx',
    symbol: 'Van',
    params: [{ key: 'color', label: 'Stripe', type: 'color', def: '#2c5fb8' }],
    render: (v) => <Van color={str(v, 'color')} />,
  },
  {
    id: 'cash-van',
    name: 'Cash van',
    group: 'People and vehicles',
    file: '/src/world/agents.tsx',
    symbol: 'CashVan',
    params: [{ key: 'stripe', label: 'Stripe', type: 'color', def: '#2f8f5b' }],
    render: (v) => <CashVan stripe={str(v, 'stripe')} />,
  },
  {
    id: 'tanker',
    name: 'Tanker truck',
    group: 'People and vehicles',
    file: '/src/world/agents.tsx',
    symbol: 'Tanker',
    params: [{ key: 'cab', label: 'Cab', type: 'color', def: '#e0682b' }],
    render: (v) => <Tanker cab={str(v, 'cab')} />,
  },
  {
    id: 'mixer',
    name: 'Mixer truck',
    group: 'People and vehicles',
    file: '/src/world/agents.tsx',
    symbol: 'MixerTruck',
    animated: true,
    params: [{ key: 'cab', label: 'Cab', type: 'color', def: '#f2b632' }],
    render: (v) => <MixerTruck cab={str(v, 'cab')} />,
  },

  {
    id: 'tower-crane',
    name: 'Tower crane',
    group: 'Construction',
    file: '/src/world/construction/ConstructionSlot.tsx',
    symbol: 'TowerCrane',
    animated: true,
    scope: true,
    params: [
      { key: 'height', label: 'Height', type: 'range', min: 3, max: 14, step: 0.5, def: 8 },
      { key: 'working', label: 'Working', type: 'bool', def: true },
    ],
    render: (v) => <TowerCrane at={[0, 0, 0]} height={num(v, 'height')} working={!!v.working} />,
  },
  {
    id: 'scaffold',
    name: 'Scaffold',
    group: 'Construction',
    file: '/src/world/construction/ConstructionSlot.tsx',
    symbol: 'Scaffold',
    scope: true,
    params: [
      { key: 'w', label: 'Width', type: 'range', min: 1, max: 8, step: 0.5, def: 4 },
      { key: 'd', label: 'Depth', type: 'range', min: 1, max: 8, step: 0.5, def: 3 },
      { key: 'h', label: 'Height', type: 'range', min: 1, max: 10, step: 0.5, def: 5 },
    ],
    render: (v) => <Scaffold w={num(v, 'w')} d={num(v, 'd')} h={num(v, 'h')} />,
  },

  {
    id: 'tree',
    name: 'Tree',
    group: 'Props',
    file: '/src/world/kit.tsx',
    symbol: 'Tree',
    params: [
      { key: 'size', label: 'Size', type: 'range', min: 0.4, max: 2.5, step: 0.1, def: 1 },
      { key: 'color', label: 'Leaves', type: 'color', def: '#4fa83d' },
    ],
    render: (v) => <Tree at={[0, 0, 0]} size={num(v, 'size')} color={str(v, 'color')} />,
  },
  {
    id: 'forest',
    name: 'Forest (instanced trees)',
    group: 'Props',
    file: '/src/world/kit.tsx',
    symbol: 'Trees',
    // the same tree model as above, so editing a tree here (trunk, crowns) changes every tree in the city's forest
    render: () => <Trees trees={FOREST} />,
  },
  {
    id: 'to-let',
    name: 'TO LET board',
    group: 'Props',
    file: '/src/world/buildings/shared.tsx',
    symbol: 'ToLet',
    params: [
      { key: 'w', label: 'Width', type: 'range', min: 0.6, max: 3, step: 0.1, def: 1.2 },
      { key: 'face', label: 'Faces', type: 'select', options: ['z', 'x'], def: 'z' },
    ],
    render: (v) => <ToLet at={[0, 0.5, 0]} w={num(v, 'w')} face={str(v, 'face') as 'x' | 'z'} />,
  },
];

export const GROUPS: Group[] = ['Buildings', 'People and vehicles', 'Construction', 'Props'];

export const paramDefaults = (a: AssetDef): Values => Object.fromEntries((a.params ?? []).map((p) => [p.key, p.def]));
