import { create } from 'zustand';
import type { PartInfo } from '../../../tools/editorParts';
import { useDraftStore } from '../../world/editDraft';

/*
 * State and actions of the visual asset editor. The server side (reading and
 * rewriting source files) is tools/assetEditor.ts; changes you make here are
 * drafts that the shapes draw live (src/world/editDraft.ts) until you Save.
 */

const base = `${import.meta.env.BASE_URL}__editor/`;

async function call<T>(route: string, body?: unknown): Promise<T> {
  const res = await fetch(base + route, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

const KEY = 'psx-gallery';
/** Gallery state survives a full reload (editing a file that is not a React component reloads the page). */
export const saved: Record<string, unknown> = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
})();
export function persist(patch: Record<string, unknown>) {
  Object.assign(saved, patch);
  sessionStorage.setItem(KEY, JSON.stringify(saved));
}

export type Mode = 'translate' | 'rotate';

interface EditorState {
  enabled: boolean;
  mode: Mode;
  selected: string | null;
  info: PartInfo | null;
  /** How many meshes in the scene come from the selected element (a part made in a loop has several). */
  copies: number;
  /** The part that contains the selected one (a tree's crown sits in a Tree), if that has a source of its own. */
  parent: string | null;
  /** Everything picked is part of the instanced forest, so there is no single mesh to put a gizmo on. */
  instancedOnly: boolean;
  message: string;
  busy: boolean;
}

export const useEditor = create<EditorState>(() => ({
  enabled: (saved.editing as boolean) ?? false,
  mode: 'translate',
  selected: (saved.selected as string | null) ?? null,
  info: null,
  copies: 0,
  parent: null,
  instancedOnly: false,
  message: '',
  busy: false,
}));

const set = useEditor.setState;
const get = useEditor.getState;
const say = (message: string) => set({ message });
const fail = (e: unknown) => set({ message: `⚠ ${(e as Error).message}`, busy: false });

export function setEnabled(enabled: boolean) {
  set({ enabled, ...(enabled ? {} : { selected: null, info: null }) });
  persist({ editing: enabled, selected: enabled ? get().selected : null });
}

export async function select(id: string | null) {
  set({ selected: id, info: null, message: '' });
  persist({ selected: id });
  if (id) await refreshInfo();
}

export async function refreshInfo() {
  const id = get().selected;
  if (!id) return;
  try {
    const info = await call<PartInfo>(`part?id=${encodeURIComponent(id)}`);
    if (get().selected === id) set({ info });
  } catch {
    // the part is gone (a deleted or undone line): drop the selection
    if (get().selected === id) set({ selected: null, info: null });
  }
}

// ── drafts ───────────────────────────────────────────────────────────────────

const drafts = () => useDraftStore.getState().drafts;

export function setDraft(key: string, value: unknown) {
  const id = get().selected;
  if (!id) return;
  useDraftStore.setState((s) => ({ drafts: { ...s.drafts, [id]: { ...s.drafts[id], [key]: value } } }));
}

/** Sets some axes of a vector draft, keeping axes already drafted (null leaves an axis as it is). */
export function setDraftVec(key: string, values: (number | null)[]) {
  const id = get().selected;
  if (!id) return;
  const old = drafts()[id]?.[key];
  const prev = Array.isArray(old) ? (old as (number | null)[]) : [];
  setDraft(key, values.map((v, i) => v ?? prev[i] ?? null));
}

export function revert() {
  useDraftStore.setState({ drafts: {} });
  say('Reverted');
}

// ── writing the source ───────────────────────────────────────────────────────

/** Once the file change has hot-reloaded, the real source carries the values and the drafts can go. */
function settle() {
  useDraftStore.setState({ drafts: {} });
  void refreshInfo();
}
let settleTimer: ReturnType<typeof setTimeout> | undefined;
const settleSoon = () => {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settle, 1500);
};

export function watchHot(): () => void {
  const hot = import.meta.hot;
  if (!hot) return () => {};
  const onUpdate = () => {
    clearTimeout(settleTimer);
    settle();
  };
  hot.on('vite:afterUpdate', onUpdate);
  return () => hot.off('vite:afterUpdate', onUpdate);
}

async function run(fn: () => Promise<string>) {
  set({ busy: true });
  try {
    say(await fn());
    set({ busy: false });
    settleSoon();
  } catch (e) {
    fail(e);
  }
}

export const save = () =>
  run(async () => {
    const edits = Object.entries(drafts()).map(([id, changes]) => ({ id, changes }));
    if (!edits.length) return 'Nothing to save';
    const { changed } = await call<{ changed: number }>('save', { edits });
    return changed ? `Saved ${changed} part${changed === 1 ? '' : 's'} to the source` : 'Nothing to save: the source already has these values';
  });

export const duplicate = () =>
  run(async () => {
    const id = get().selected!;
    const res = await call<{ id: string }>('duplicate', { id, offset: [1, 0, 0] });
    await select(res.id);
    return 'Duplicated (the copy is selected, one unit along x)';
  });

export const remove = () =>
  run(async () => {
    await call('delete', { id: get().selected! });
    await select(null);
    return 'Deleted from the source';
  });

export const undo = () => run(async () => (await call<{ label: string }>('undo', {})).label);
export const redo = () => run(async () => (await call<{ label: string }>('redo', {})).label);

// ── what the inspector shows ─────────────────────────────────────────────────

export interface Field {
  key: string;
  label: string;
  kind: 'vec' | 'num' | 'color' | 'bool';
  def: number | string | boolean | number[];
  step?: number;
  min?: number;
  /** Shown in degrees, stored in radians. */
  angle?: boolean;
  /** Whole numbers only (a count of floors or columns). */
  int?: boolean;
}

const POS: Field = { key: 'at', label: 'Position', kind: 'vec', def: [0, 0, 0], step: 0.05 };
const ROT: Field = { key: 'rot', label: 'Rotation (°)', kind: 'vec', def: [0, 0, 0], step: 5, angle: true };
const COLOR: Field = { key: 'color', label: 'Color', kind: 'color', def: '#cccccc' };
const GLOW: Field = { key: 'glow', label: 'Glow', kind: 'num', def: 0, step: 0.05, min: 0 };
const SHADOW: Field = { key: 'shadow', label: 'Casts shadow', kind: 'bool', def: true };
const num = (key: string, label: string): Field => ({ key, label, kind: 'num', def: 1, step: 0.05, min: 0.01 });

export const FIELDS: Record<string, Field[]> = {
  Box: [{ key: 'size', label: 'Size (w, h, d)', kind: 'vec', def: [1, 1, 1], step: 0.05, min: 0.01 }, POS, ROT, COLOR, GLOW, { key: 'rounded', label: 'Rounded', kind: 'num', def: 0, step: 0.02, min: 0 }, SHADOW],
  Cyl: [num('r', 'Radius'), num('h', 'Height'), POS, ROT, COLOR, GLOW, SHADOW, { key: 'low', label: 'Low poly', kind: 'bool', def: false }, { key: 'center', label: 'Centered on its position', kind: 'bool', def: false }],
  Cone: [num('r', 'Radius'), num('h', 'Height'), POS, ROT, COLOR],
  Dome: [num('r', 'Radius'), POS, COLOR, GLOW],
  Ball: [num('r', 'Radius'), POS, COLOR, GLOW, SHADOW],
  Roof: [num('w', 'Width'), num('d', 'Depth'), num('h', 'Height'), POS, COLOR],
  Blob: [{ key: 'size', label: 'Radii (x, y, z)', kind: 'vec', def: [1, 1, 1], step: 0.05, min: 0.01 }, POS, ROT, COLOR, GLOW, SHADOW],
  Tree: [POS, { key: 'size', label: 'Size', kind: 'num', def: 1, step: 0.05, min: 0.1 }, { key: 'color', label: 'Leaves', kind: 'color', def: '#4fa83d' }],
  Car: [COLOR, POS, { key: 'rotY', label: 'Heading (°)', kind: 'num', def: 0, step: 5, angle: true }],
  ActivityWindows: [
    POS,
    num('w', 'Width (x)'),
    num('d', 'Depth (z)'),
    { key: 'floors', label: 'Floors', kind: 'num', def: 1, step: 1, min: 0, int: true },
    { key: 'cols', label: 'Columns per face', kind: 'num', def: 3, step: 1, min: 1, int: true },
    { key: 'floorHeight', label: 'Floor height', kind: 'num', def: 1, step: 0.05, min: 0.1 },
    { key: 'baseHeight', label: 'First floor at', kind: 'num', def: 0.6, step: 0.05, min: 0 },
    { key: 'litColor', label: 'Lit color', kind: 'color', def: '#ffe27a' },
    { key: 'darkColor', label: 'Dark color', kind: 'color', def: '#5b6f86' },
    { key: 'seed', label: 'Lighting order seed', kind: 'num', def: 1, step: 1, int: true },
    { key: 'closed', label: 'Closed (always dark)', kind: 'bool', def: false },
  ],
};

export interface Slot {
  value: number;
  /** A plain value that can be rewritten in the source. */
  editable: boolean;
  /** Computed: the expression as written. */
  text?: string;
}

/** What a field shows now: the source value (or the default if absent) with any draft laid over it. */
export function readVec(f: Field, info: PartInfo, draft?: Record<string, unknown>): { slots: Slot[]; whole?: string } {
  const attr = info.attrs[f.key];
  const def = f.def as number[];
  let slots: Slot[];
  if (!attr) slots = def.map((value) => ({ value, editable: true }));
  else if (attr.kind === 'array') slots = attr.items.map((it, i) => (it.kind === 'const' ? { value: it.value, editable: true } : { value: def[i] ?? 0, editable: false, text: it.text }));
  else return { slots: [], whole: attr.kind === 'expr' ? attr.text : '?' };
  const d = draft?.[f.key];
  if (Array.isArray(d)) slots = slots.map((s, i) => (d[i] != null && s.editable ? { ...s, value: d[i] as number } : s));
  return { slots };
}

export function readScalar<T extends number | string | boolean>(f: Field, info: PartInfo, draft?: Record<string, unknown>): { value: T; editable: boolean; text?: string } {
  if (draft && f.key in draft) return { value: draft[f.key] as T, editable: true };
  const attr = info.attrs[f.key];
  if (!attr) return { value: f.def as T, editable: true };
  if (attr.kind === 'expr') return { value: f.def as T, editable: false, text: attr.text };
  if (attr.kind === 'array') return { value: f.def as T, editable: false, text: '[…]' };
  return { value: attr.value as T, editable: true };
}
